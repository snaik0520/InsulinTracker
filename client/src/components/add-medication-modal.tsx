import { useMemo, useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertMedicationSchema, type InsertMedication, type Medication } from "@shared/schema";
import { formatToISODate, parseToISODate } from "@shared/dateUtils";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Plus, Pill, MapPin, Calendar, Hash } from "lucide-react";

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

  const form = useForm<InsertMedication>({
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

  // Updated onSubmit function with date formatting
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

    // Ensure expiration date is in ISO format
    const formattedExpirationDate = formatToISODate(data.expirationDate);
    
    if (!formattedExpirationDate) {
      form.setError("expirationDate", { type: "manual", message: "Please enter a valid expiration date" });
      return;
    }

    // Check for existing medication with same properties
    const existingMedication = allMedications.find((med: Medication) => 
      med.medicalName?.toLowerCase() === data.medicalName?.toLowerCase() &&
      med.genericName?.toLowerCase() === data.genericName?.toLowerCase() &&
      med.location?.toLowerCase() === effectiveLocation?.toLowerCase() &&
      med.type === data.type &&
      med.dose === data.dose &&
      med.administrativeForm === admin &&
      formatToISODate(med.expirationDate) === formattedExpirationDate
    );

    if (existingMedication) {
      // If medication exists, update quantity instead of creating new
      const updatedPayload = {
        ...existingMedication,
        quantity: (existingMedication.quantity || 0) + data.quantity,
        // Keep the earlier expiration date for safety
        expirationDate: new Date(formatToISODate(existingMedication.expirationDate)) < new Date(formattedExpirationDate) 
          ? formatToISODate(existingMedication.expirationDate)
          : formattedExpirationDate
      };

      updateMedicationMutation.mutate({ id: existingMedication.id, data: updatedPayload });
    } else {
      // Create new medication if no match found
      const payload = {
        ...data,
        location: effectiveLocation,
        administrativeForm: admin,
        expirationDate: formattedExpirationDate, // Ensure ISO format
      } as any;

      addMedicationMutation.mutate(payload);
    }
  };

  // Mutation for updating existing medications
  const updateMedicationMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      const response = await apiRequest("PUT", `/api/medications/${id}`, data);
      return response.json();
    },
    onSuccess: async (res: any) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["/api/medications"], refetchType: 'active' }),
        queryClient.invalidateQueries({ queryKey: ["/api/medications/low-stock"], refetchType: 'active' }),
        queryClient.invalidateQueries({ queryKey: ["/api/transactions"], refetchType: 'active' })
      ]);

      toast({ 
        title: "Success", 
        description: "Medication quantity updated successfully", 
        duration: 3000 
      });
      form.reset();
      setLocationDropdownValue("");
      onOpenChange(false);
      onSave?.(res);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error?.message ?? "An error occurred updating medication",
        variant: "destructive",
        duration: 3000,
      });
    },
  });

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
      <DialogContent className="max-w-3xl max-h-[95vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Plus className="h-5 w-5" />
            Add New Medication
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          {/* Quick Select Section */}
          {existingMedications.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Pill className="h-4 w-4" />
                  Quick Select (Optional)
                </CardTitle>
              </CardHeader>
              <CardContent>
                {medsLoading ? (
                  <p className="text-sm text-muted-foreground">
                    Loading existing medications...
                  </p>
                ) : medsError ? (
                  <p className="text-sm text-red-600">
                    Failed to load medications.
                  </p>
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
                      <SelectValue placeholder="Select existing medication to autofill" />
                    </SelectTrigger>
                    <SelectContent>
                      {existingMedications.map((medication) => (
                        <SelectItem key={medication.id} value={medication.id}>
                          {medication.medicalName} {medication.genericName && `(${medication.genericName})`}
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
              <CardTitle>Basic Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="medicalName">Medical Name *</Label>
                  <Input
                    id="medicalName"
                    {...form.register("medicalName", {
                      onChange: (e) =>
                        form.setValue("medicalName", capitalizeWords(e.target.value)),
                    })}
                    placeholder="e.g., Humalog"
                    className="mt-1"
                  />
                  {formErrors.medicalName && (
                    <p className="text-sm text-red-600 mt-1">
                      {formErrors.medicalName.message}
                    </p>
                  )}
                </div>

                <div>
                  <Label htmlFor="genericName">Generic Name *</Label>
                  <Input
                    id="genericName"
                    {...form.register("genericName", {
                      onChange: (e) =>
                        form.setValue("genericName", capitalizeWords(e.target.value)),
                    })}
                    placeholder="e.g., Insulin Lispro"
                    className="mt-1"
                  />
                  {formErrors.genericName && (
                    <p className="text-sm text-red-600 mt-1">
                      {formErrors.genericName.message}
                    </p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="type">Insulin Type *</Label>
                  <Select onValueChange={(value) => form.setValue("type", value)} value={form.watch("type")}>
                    <SelectTrigger className="mt-1">
                      <SelectValue placeholder="Select insulin type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="rapid">Rapid Acting</SelectItem>
                      <SelectItem value="long">Long Acting</SelectItem>
                      <SelectItem value="intermediate">Intermediate</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                  {formErrors.type && (
                    <p className="text-sm text-red-600 mt-1">
                      {formErrors.type.message}
                    </p>
                  )}
                </div>

                <div>
                  <Label htmlFor="administrativeForm">Form *</Label>
                  <Select
                    onValueChange={(value) => form.setValue("administrativeForm" as any, value)}
                    value={form.watch("administrativeForm" as any)}
                  >
                    <SelectTrigger className="mt-1">
                      <SelectValue placeholder="Select form" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pen">Pen</SelectItem>
                      <SelectItem value="injection">Injection</SelectItem>
                    </SelectContent>
                  </Select>
                  {formErrors.administrativeForm && (
                    <p className="text-sm text-red-600 mt-1">
                      {formErrors.administrativeForm.message}
                    </p>
                  )}
                </div>
              </div>

              <div>
                <Label htmlFor="dose">Dose *</Label>
                <Input
                  id="dose"
                  {...form.register("dose")}
                  onChange={handleDoseChange}
                  placeholder="e.g., 100 units/mL or 0.5mg"
                  className="mt-1"
                />
                {formErrors.dose && (
                  <p className="text-sm text-red-600 mt-1">
                    {formErrors.dose.message}
                  </p>
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
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="quantity" className="flex items-center gap-2">
                    <Hash className="h-3 w-3" />
                    Quantity *
                  </Label>
                  <Input
                    id="quantity"
                    type="number"
                    min="1"
                    {...form.register("quantity", {
                      valueAsNumber: true,
                      validate: (value) => value > 0 || "Quantity must be greater than 0",
                    })}
                    placeholder="Enter quantity"
                    className="mt-1"
                  />
                  {formErrors.quantity && (
                    <p className="text-sm text-red-600 mt-1">
                      {formErrors.quantity.message}
                    </p>
                  )}
                </div>

                <div>
                  <Label htmlFor="expirationDate" className="flex items-center gap-2">
                    <Calendar className="h-3 w-3" />
                    Expiration Date *
                  </Label>
                  <Input
                    id="expirationDate"
                    type="date"
                    {...form.register("expirationDate")}
                    className="mt-1"
                  />
                  {formErrors.expirationDate && (
                    <p className="text-sm text-red-600 mt-1">
                      {formErrors.expirationDate.message}
                    </p>
                  )}
                </div>
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
                <div>
                  <Label htmlFor="locationSelect">Quick Select Location</Label>
                  <Select
                    value={locationDropdownValue}
                    onValueChange={handleExistingLocationSelect}
                  >
                    <SelectTrigger className="mt-1">
                      <SelectValue placeholder="Choose existing location" />
                    </SelectTrigger>
                    <SelectContent>
                      {existingLocations.map((loc) => (
                        <SelectItem key={loc} value={loc}>
                          {loc}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div>
                <Label htmlFor="location">
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
                  <p className="text-sm text-red-600 mt-1">
                    {formErrors.location.message}
                  </p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Action Buttons */}
          <div className="flex justify-end gap-2 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={addMedicationMutation.isPending || updateMedicationMutation.isPending}
            >
              {(addMedicationMutation.isPending || updateMedicationMutation.isPending) ? "Adding..." : "Add Medication"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
