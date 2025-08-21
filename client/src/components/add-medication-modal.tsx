// AddMedicationModal.tsx
import { useMemo, useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertMedicationSchema, type InsertMedication, type Medication } from "@shared/schema";
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

  // existingMedications aggregated for quick-select (unchanged)
  const existingMedications = useMemo(() => {
    const map = new Map<string, Medication & { quantity: number; locationCounts: Map<string, number> }>();
    for (const med of allMedications) {
      const key = `${med.genericName || ""}||${med.medicalName || ""}`;
      if (!map.has(key)) {
        const locationCounts = new Map();
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

  // ---------- NEW: helper functions to normalize and find exact matches ----------
  const normalizeString = (s?: string) => (s ? s.toString().trim().toLowerCase() : "");
  // normalize date to YYYY-MM-DD if possible (dates from input type="date" will already be YYYY-MM-DD)
  const normalizeDate = (d?: string) => {
    if (!d) return "";
    // pick the first 10 characters if ISO-like, otherwise trim
    return d.length >= 10 ? d.slice(0, 10) : d.trim();
  };

  // Finds an exact matching medication row in allMedications based on fields:
  // medicalName, administrativeForm, type, dose, expirationDate, location
  const findMatchingMedication = (payload: Partial<InsertMedication & { location: string }>) => {
    const mName = normalizeString(payload.medicalName);
    const admin = normalizeString(payload.administrativeForm);
    const type = normalizeString(payload.type);
    const dose = normalizeString(payload.dose);
    const exp = normalizeDate(payload.expirationDate);
    const loc = normalizeString(payload.location);

    for (const med of allMedications) {
      const medMName = normalizeString(med.medicalName);
      const medAdmin = normalizeString(med.administrativeForm ?? (med as any).formType);
      const medType = normalizeString(med.type);
      const medDose = normalizeString(med.dose);
      const medExp = normalizeDate(med.expirationDate ?? "");
      const medLoc = normalizeString(med.location ?? "");

      if (
        medMName === mName &&
        medAdmin === admin &&
        medType === type &&
        medDose === dose &&
        medExp === exp &&
        medLoc === loc
      ) {
        return med;
      }
    }
    return null;
  };
  // ------------------------------------------------------------------------------

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

    // find exact match using the helper
    const matched = findMatchingMedication(payload);

    if (matched) {
      // If matched, update existing medication's quantity by adding incoming quantity
      const updatedQuantity = (matched.quantity ?? 0) + (Number(payload.quantity) || 0);
      // Prepare update payload: send full fields if your backend expects them, or just quantity if not
      const updatePayload = {
        medicalName: payload.medicalName,
        genericName: payload.genericName,
        type: payload.type,
        dose: payload.dose,
        quantity: updatedQuantity,
        expirationDate: payload.expirationDate,
        location: payload.location,
        administrativeForm: payload.administrativeForm,
        lastModified: new Date().toISOString(),
      };

      updateMedicationMutation.mutate({ id: matched.id, body: updatePayload });
    } else {
      // No match — create a new medication entry (original behavior)
      addMedicationMutation.mutate(payload);
    }
  };

  // ---------- NEW: mutation to update an existing medication ----------
  const updateMedicationMutation = useMutation({
    mutationFn: async ({ id, body }: { id: string; body: any }) => {
      // NOTE: adjust method/endpoint if your backend expects PUT or a different path
      const res = await apiRequest("PATCH", `/api/medications/${id}`, body);
      // If server returns non-2xx, apiRequest should throw or return a non-ok response; .json() below assumes success
      return res.json();
    },
    onSuccess: async (res: any) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["/api/medications"], refetchType: 'active' }),
        queryClient.invalidateQueries({ queryKey: ["/api/medications/low-stock"], refetchType: 'active' }),
        queryClient.invalidateQueries({ queryKey: ["/api/transactions"], refetchType: 'active' })
      ]);

      toast({ title: "Success", description: "Medication updated successfully", duration: 3000 });
      form.reset();
      setLocationDropdownValue("");
      onOpenChange(false);
      onSave?.(res);
    },
    onError: (error: any) => {
      // If PATCH fails (for example server doesn't support PATCH), fallback to creating a new entry
      toast({
        title: "Update error — creating new entry instead",
        description: "Could not update existing row; attempting to create a new row.",
        variant: "destructive",
        duration: 4000,
      });
      // fallback: create new medication (you may want to refine this behavior)
      addMedicationMutation.mutate({
        ...form.getValues(),
        location: watchLocationInput.trim() !== "" ? watchLocationInput.trim() : locationDropdownValue,
        administrativeForm: (form.getValues() as any).administrativeForm,
      });
    },
  });
  // -------------------------------------------------------------------

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
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto p-0">
        <DialogHeader className="p-6 pb-2">
          <DialogTitle className="flex items-center gap-2 text-xl font-semibold">
            <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
              <Plus className="w-4 h-4 text-blue-600" />
            </div>
            Add New Medication
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(onSubmit)} className="px-6 pb-6 space-y-6">
          {/* Quick Select Section */}
          {existingMedications.length > 0 && (
            <Card className="border-blue-100 bg-blue-50/30">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-blue-700 flex items-center gap-2">
                  <Pill className="w-4 h-4" />
                  Quick Select (Optional)
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                {medsLoading ? (
                  <div className="text-sm text-gray-500">Loading existing medications...</div>
                ) : medsError ? (
                  <div className="text-sm text-red-600">Failed to load medications.</div>
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
                    <SelectTrigger className="bg-white">
                      <SelectValue placeholder="Select existing medication to auto-fill..." />
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
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-gray-700">Basic Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="medicalName" className="text-sm font-medium text-gray-700">
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
                    <p className="text-red-600 text-xs mt-1">{formErrors.medicalName.message}</p>
                  )}
                </div>

                <div>
                  <Label htmlFor="genericName" className="text-sm font-medium text-gray-700">
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
                    <p className="text-red-600 text-xs mt-1">{formErrors.genericName.message}</p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <Label htmlFor="type" className="text-sm font-medium text-gray-700">
                    Insulin Type *
                  </Label>
                  <Select onValueChange={(value) => form.setValue("type", value)} value={form.watch("type")}>
                    <SelectTrigger className="mt-1">
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="rapid">Rapid Acting</SelectItem>
                      <SelectItem value="long">Long Acting</SelectItem>
                      <SelectItem value="intermediate">Intermediate</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                  {formErrors.type && <p className="text-red-600 text-xs mt-1">{formErrors.type.message}</p>}
                </div>

                <div>
                  <Label htmlFor="administrativeForm" className="text-sm font-medium text-gray-700">
                    Form *
                  </Label>
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
                    <p className="text-red-600 text-xs mt-1">{formErrors.administrativeForm.message}</p>
                  )}
                </div>

                <div>
                  <Label htmlFor="dose" className="text-sm font-medium text-gray-700">
                    Dose *
                  </Label>
                  <Input
                    id="dose"
                    {...form.register("dose", {
                      onChange: handleDoseChange,
                    })}
                    placeholder="e.g., 100 units/mL"
                    className="mt-1"
                  />
                  {formErrors.dose && <p className="text-red-600 text-xs mt-1">{formErrors.dose.message}</p>}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Inventory Details */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-gray-700 flex items-center gap-2">
                <Hash className="w-4 h-4" />
                Inventory Details
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="quantity" className="text-sm font-medium text-gray-700">
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
                  {formErrors.quantity && <p className="text-red-600 text-xs mt-1">{formErrors.quantity.message}</p>}
                </div>

                <div>
                  <Label htmlFor="expirationDate" className="text-sm font-medium text-gray-700">
                    <Calendar className="w-4 h-4 inline mr-1" />
                    Expiration Date *
                  </Label>
                  <Input id="expirationDate" type="date" {...form.register("expirationDate")} className="mt-1" />
                  {formErrors.expirationDate && (
                    <p className="text-red-600 text-xs mt-1">{formErrors.expirationDate.message}</p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Storage Location */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-gray-700 flex items-center gap-2">
                <MapPin className="w-4 h-4" />
                Storage Location
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {existingLocations.length > 0 && (
                <div>
                  <Label className="text-sm text-gray-600">Quick Select Location</Label>
                  <Select value={locationDropdownValue} onValueChange={handleExistingLocationSelect}>
                    <SelectTrigger className="mt-1 bg-gray-50">
                      <SelectValue placeholder="Choose existing location..." />
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
                <Label htmlFor="location" className="text-sm font-medium text-gray-700">
                  {existingLocations.length > 0 ? "Or Enter New Location *" : "Storage Location *"}
                </Label>
                <Input
                  id="location"
                  {...form.register("location", {
                    onChange: handleLocationInputChange,
                  })}
                  placeholder="e.g., Refrigerator A, Shelf 2"
                  className="mt-1"
                />
                {formErrors.location && <p className="text-red-600 text-xs mt-1">{formErrors.location.message}</p>}
              </div>
            </CardContent>
          </Card>

          {/* Action Buttons */}
          <div className="flex gap-3 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="flex-1"
              size="default"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              className="flex-1 bg-blue-600 hover:bg-blue-700"
              disabled={addMedicationMutation.isPending || updateMedicationMutation.isLoading}
              size="default"
            >
              {addMedicationMutation.isPending || updateMedicationMutation.isLoading ? "Adding..." : "Add Medication"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
