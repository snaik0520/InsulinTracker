import { useMemo, useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertMedicationSchema, type InsertMedication, type Medication } from "@shared/schema";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Plus, Pill, MapPin, Calendar, Hash, Zap, Clock, Scale, HelpCircle } from "lucide-react";

// Enhanced color scheme consistent with inventory.tsx
const typeColors = {
  rapid: "bg-red-100 text-red-800 border-red-200",
  long: "bg-blue-100 text-blue-800 border-blue-200",
  intermediate: "bg-amber-100 text-amber-800 border-amber-200",
  other: "bg-gray-100 text-gray-800 border-gray-200",
};

const typeIcons = {
  rapid: Zap,
  long: Clock,
  intermediate: Scale,
  other: HelpCircle,
};

const typeLabels = {
  rapid: "Rapid Acting",
  long: "Long Acting",
  intermediate: "Intermediate",
  other: "Other",
};

interface AddMedicationModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave?: (med: Medication) => void;
}

export function AddMedicationModal({ open, onOpenChange, onSave }: AddMedicationModalProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const capitalizeWords = (str: string) => str.replace(/\b\w/g, (c) => c.toUpperCase());

  const { data: allMedications = [], isLoading: medsLoading, isError: medsError } = useQuery({
    queryKey: ["/api/medications"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/medications");
      return res.json();
    },
    enabled: open,
    staleTime: 1000 * 60 * 2,
  });

  const existingMedications = useMemo(() => {
    const map = new Map<
      string,
      Medication & { quantity: number; locationCounts: Map<string, number> }
    >();
    for (const med of allMedications) {
      const key = `${med.genericName || ""}||${med.medicalName || ""}`;
      if (!map.has(key)) {
        const locationCounts = new Map<string, number>();
        if (med.location?.trim()) locationCounts.set(med.location.trim(), med.quantity ?? 0);
        map.set(key, { ...med, quantity: med.quantity ?? 0, locationCounts });
      } else {
        const existing = map.get(key)!;
        existing.quantity = (existing.quantity ?? 0) + (med.quantity ?? 0);
        if (med.location?.trim()) {
          const loc = med.location.trim();
          existing.locationCounts.set(loc, (existing.locationCounts.get(loc) ?? 0) + (med.quantity ?? 0));
        }
      }
    }
    return Array.from(map.values());
  }, [allMedications]);

  const existingLocations = useMemo(() => {
    const set = new Set<string>();
    for (const med of allMedications) if (med.location?.trim()) set.add(med.location.trim());
    return Array.from(set);
  }, [allMedications]);

  const form = useForm({
    resolver: zodResolver(insertMedicationSchema),
    defaultValues: {
      medicalName: "",
      genericName: "",
      type: "",
      dose: "",
      quantity: 0,
      expirationDate: "",
      location: "",
      administrativeForm: "",
    } as any,
  });

  const [locationDropdownValue, setLocationDropdownValue] = useState("");

  useEffect(() => {
    if (!open) {
      form.reset();
      setLocationDropdownValue("");
    }
  }, [open, form]);

  const handleExistingMedicationSelect = (medicationId: string) => {
    const medication = existingMedications.find((med) => med.id === medicationId);
    if (medication) {
      form.setValue("medicalName", medication.medicalName || "");
      form.setValue("genericName", medication.genericName || "");
      form.setValue("type", medication.type || "");
      form.setValue("dose", medication.dose || "");
      form.setValue("quantity", 0);
      form.setValue("expirationDate", "");
      
      const adminFrom =
        (medication as any).administrativeForm ||
        (medication as any).formType ||
        "";
      const normalized =
        typeof adminFrom === "string"
          ? adminFrom.toLowerCase() === "pen"
            ? "pen"
            : adminFrom.toLowerCase() === "injection"
            ? "injection"
            : ""
          : "";
      form.setValue("administrativeForm", normalized);

      let maxLocation = "";
      let maxQty = -1;
      medication.locationCounts.forEach((qty, loc) => {
        if (qty > maxQty) {
          maxQty = qty;
          maxLocation = loc;
        }
      });
      setLocationDropdownValue(maxLocation);
      form.setValue("location", "");
    }
  };

  const handleExistingLocationSelect = (loc: string) => {
    setLocationDropdownValue(loc);
    form.setValue("location", "");
  };

  const watchLocationInput = form.watch("location");
  useEffect(() => {
    if (watchLocationInput && watchLocationInput.trim() !== "") setLocationDropdownValue("");
  }, [watchLocationInput]);

  const handleLocationInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    form.setValue("location", capitalizeWords(e.target.value));
  };

  const handleDoseChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let val = e.target.value;
    if (/^\.\d*$/.test(val)) val = "0" + val;
    if (/^\d*\.?\d*$/.test(val)) {
      const numericVal = parseFloat(val);
      if (numericVal < 1 && numericVal > 0 && !val.startsWith("0")) val = "0" + val;
    }
    form.setValue("dose", val);
  };

  const validateLocation = () => watchLocationInput.trim() !== "" || locationDropdownValue !== "";

  const onSubmit = (data: InsertMedication) => {
    if (!validateLocation()) {
      form.setError("location", { type: "manual", message: "Please select or enter a storage location" });
      return;
    }
    if (data.quantity <= 0) {
      form.setError("quantity", { type: "manual", message: "Quantity must be greater than 0" });
      return;
    }
    
    const admin = (form.getValues() as any).administrativeForm;
    if (!admin || (admin !== "pen" && admin !== "injection")) {
      form.setError("administrativeForm" as any, { type: "manual", message: "Administrative Form is required" });
      return;
    }

    const effectiveLocation = watchLocationInput.trim() !== "" ? watchLocationInput.trim() : locationDropdownValue;

    const payload = {
      ...data,
      location: effectiveLocation,
      administrativeForm: admin,
    } as any;

    addMedicationMutation.mutate(payload);
  };

  const addMedicationMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await apiRequest("POST", "/api/medications", data);
      return response.json();
    },
    onSuccess: async (res: any) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["/api/medications"], refetchType: 'active' }),
        queryClient.invalidateQueries({ queryKey: ["/api/medications/low-stock"], refetchType: 'active' }),
        queryClient.invalidateQueries({ queryKey: ["/api/transactions"], refetchType: 'active' })
      ]);
      
      toast({ title: "Success", description: "Medication added successfully", duration: 3000 });
      form.reset();
      setLocationDropdownValue("");
      onOpenChange(false);
      onSave?.(res);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error?.message ?? "An error occurred",
        variant: "destructive",
        duration: 3000,
      });
    },
  });

  const formErrors = form.formState.errors as any;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto enhanced-card">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <Plus className="h-5 w-5 text-blue-600" />
            Add New Medication
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          
          {/* Quick Select Section */}
          {existingMedications.length > 0 && (
            <Card className="border-blue-100 bg-blue-50/30">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Pill className="h-4 w-4 text-blue-600" />
                  Quick Select (Optional)
                </CardTitle>
              </CardHeader>
              <CardContent>
                {medsLoading ? (
                  <div className="loading-shimmer h-10 rounded"></div>
                ) : medsError ? (
                  <p className="text-red-600">Failed to load medications.</p>
                ) : (
                  <Select
                    value={
                      existingMedications.find(
                        (med) =>
                          med.medicalName === form.watch("medicalName") &&
                          med.genericName === form.watch("genericName")
                      )?.id ?? ""
                    }
                    onValueChange={handleExistingMedicationSelect}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select existing medication to pre-fill form" />
                    </SelectTrigger>
                    <SelectContent>
                      {existingMedications.map((medication) => (
                        <SelectItem key={medication.id} value={medication.id}>
                          <div className="flex items-center gap-2">
                            <Badge 
                              className={`${typeColors[medication.type as keyof typeof typeColors]} text-xs`}
                            >
                              {typeLabels[medication.type as keyof typeof typeLabels]}
                            </Badge>
                            <span>
                              {medication.medicalName} {medication.genericName && `(${medication.genericName})`}
                            </span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </CardContent>
            </Card>
          )}

          {/* Basic Information */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Hash className="h-4 w-4" />
                Basic Information
              </CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
              
              <div className="space-y-2">
                <Label htmlFor="medicalName" className="text-sm font-medium">
                  Medical Name *
                </Label>
                <Input
                  id="medicalName"
                  {...form.register("medicalName", {
                    onChange: (e) => form.setValue("medicalName", capitalizeWords(e.target.value)),
                  })}
                  placeholder="e.g., Humalog"
                  className="mt-1"
                />
                {formErrors.medicalName && (
                  <p className="text-red-600 text-sm">{formErrors.medicalName.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="genericName" className="text-sm font-medium">
                  Generic Name *
                </Label>
                <Input
                  id="genericName"
                  {...form.register("genericName", {
                    onChange: (e) => form.setValue("genericName", capitalizeWords(e.target.value)),
                  })}
                  placeholder="e.g., Insulin Lispro"
                  className="mt-1"
                />
                {formErrors.genericName && (
                  <p className="text-red-600 text-sm">{formErrors.genericName.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-medium">
                  Insulin Type *
                </Label>
                <Select onValueChange={(value) => form.setValue("type", value)} value={form.watch("type")}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select insulin type" />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(typeLabels).map(([type, label]) => {
                      const Icon = typeIcons[type as keyof typeof typeIcons];
                      return (
                        <SelectItem key={type} value={type}>
                          <div className="flex items-center gap-2">
                            <Icon className="h-4 w-4" />
                            <Badge className={`${typeColors[type as keyof typeof typeColors]} text-xs`}>
                              {label}
                            </Badge>
                          </div>
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
                {formErrors.type && (
                  <p className="text-red-600 text-sm">{formErrors.type.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-medium">
                  Administrative Form *
                </Label>
                <Select
                  onValueChange={(value) => form.setValue("administrativeForm" as any, value)}
                  value={form.watch("administrativeForm" as any)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select form" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pen">
                      <div className="flex items-center gap-2">
                        <Pill className="h-4 w-4" />
                        Pen
                      </div>
                    </SelectItem>
                    <SelectItem value="injection">
                      <div className="flex items-center gap-2">
                        <Pill className="h-4 w-4" />
                        Injection
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
                {formErrors.administrativeForm && (
                  <p className="text-red-600 text-sm">{formErrors.administrativeForm.message}</p>
                )}
              </div>

              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="dose" className="text-sm font-medium">
                  Dose *
                </Label>
                <Input
                  id="dose"
                  {...form.register("dose")}
                  onChange={handleDoseChange}
                  placeholder="e.g., 100 units/mL, 0.25mL"
                  className="mt-1"
                />
                {formErrors.dose && (
                  <p className="text-red-600 text-sm">{formErrors.dose.message}</p>
                )}
              </div>
              
            </CardContent>
          </Card>

          {/* Inventory Details */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Hash className="h-4 w-4" />
                Inventory Details
              </CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
              
              <div className="space-y-2">
                <Label htmlFor="quantity" className="text-sm font-medium">
                  Quantity *
                </Label>
                <Input
                  id="quantity"
                  type="number"
                  {...form.register("quantity", {
                    valueAsNumber: true,
                    validate: (value) => value > 0 || "Quantity must be greater than 0",
                  })}
                  placeholder="Enter quantity"
                  className="mt-1"
                />
                {formErrors.quantity && (
                  <p className="text-red-600 text-sm">{formErrors.quantity.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="expirationDate" className="text-sm font-medium flex items-center gap-1">
                  <Calendar className="h-4 w-4" />
                  Expiration Date *
                </Label>
                <Input
                  id="expirationDate"
                  type="date"
                  {...form.register("expirationDate")}
                  className="mt-1"
                />
                {formErrors.expirationDate && (
                  <p className="text-red-600 text-sm">{formErrors.expirationDate.message}</p>
                )}
              </div>
              
            </CardContent>
          </Card>

          {/* Storage Location */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MapPin className="h-4 w-4" />
                Storage Location
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              
              {existingLocations.length > 0 && (
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Quick Select Location</Label>
                  <Select
                    value={locationDropdownValue}
                    onValueChange={handleExistingLocationSelect}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select existing location" />
                    </SelectTrigger>
                    <SelectContent>
                      {existingLocations.map((loc) => (
                        <SelectItem key={loc} value={loc}>
                          <div className="flex items-center gap-2">
                            <MapPin className="h-4 w-4" />
                            {loc}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="location" className="text-sm font-medium">
                  {existingLocations.length > 0 ? "Or Enter New Location *" : "Storage Location *"}
                </Label>
                <Input
                  id="location"
                  {...form.register("location")}
                  onChange={handleLocationInputChange}
                  placeholder="e.g., Refrigerator A, Shelf 2"
                  className="mt-1"
                />
                {formErrors.location && (
                  <p className="text-red-600 text-sm">{formErrors.location.message}</p>
                )}
              </div>
              
            </CardContent>
          </Card>

          {/* Action Buttons */}
          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="px-6"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={addMedicationMutation.isPending}
              className="bg-blue-600 hover:bg-blue-700 text-white px-6 dispense-button-enhanced"
            >
              {addMedicationMutation.isPending ? (
                <div className="flex items-center gap-2">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  Adding...
                </div>
              ) : (
                <>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Medication
                </>
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
