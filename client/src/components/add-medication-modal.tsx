import { useMemo, useState, useEffect, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertMedicationSchema, type InsertMedication, type Medication } from "@shared/schema";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Plus } from "lucide-react";

interface AddMedicationModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AddMedicationModal({ open, onOpenChange }: AddMedicationModalProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const capitalizeWords = (str: string) => str.replace(/\b\w/g, (c) => c.toUpperCase());

  const { data: allMedications = [], isLoading: medsLoading, isError: medsError } = useQuery<Medication[]>({
    queryKey: ["/api/medications"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/medications");
      return res.json();
    },
    enabled: open,
    staleTime: 1000 * 60 * 2,
  });

  const existingMedications = useMemo(() => {
    const map = new Map<string, Medication & { quantity: number; locationCounts: Map<string, number> }>();
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
      formType: "",
      dose: "",
      quantity: 0,
      expirationDate: "",
      location: "",
    },
  });

  const [locationDropdownValue, setLocationDropdownValue] = useState("");
  // track selected existing med id explicitly
  const [selectedExistingMedId, setSelectedExistingMedId] = useState<string>("");

  useEffect(() => {
    if (!open) {
      form.reset();
      setLocationDropdownValue("");
      setSelectedExistingMedId("");
    }
  }, [open, form]);

  const handleExistingMedicationSelect = (medicationId: string) => {
    setSelectedExistingMedId(medicationId);
    const medication = existingMedications.find((med) => med.id === medicationId);
    if (medication) {
      form.setValue("medicalName", medication.medicalName || "");
      form.setValue("genericName", medication.genericName || "");

      // --- Robustly resolve "form" (injection/pen) and insulin classification ---
      // Some records might use:
      //  - med.formType (preferred new field) for injection/pen
      //  - med.insulinType for rapid/long/etc (if we store both)
      //  - older records may have used med.type for either purpose
      const possibleType = (medication as any).type as string | undefined;
      const possibleFormType = (medication as any).formType as string | undefined;
      const possibleInsulinType = (medication as any).insulinType as string | undefined;

      // Determine formType (injection | pen)
      const formValue =
        possibleFormType ||
        (possibleType && ["injection", "pen"].includes(possibleType.toLowerCase()) ? possibleType : "");

      // Determine insulin classification (rapid | long | intermediate | other)
      const insulinValue =
        possibleInsulinType ||
        (possibleType && !["injection", "pen"].includes(possibleType.toLowerCase()) ? possibleType : "") ||
        "";

      form.setValue("formType", formValue);
      form.setValue("type", insulinValue);

      form.setValue("dose", medication.dose || "");
      form.setValue("quantity", 0);
      form.setValue("expirationDate", "");
      // choose highest quantity location as before
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
    setLocationDropdownValue("");
  };

  const watchDose = form.watch("dose");
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

  // When submitting, we send:
  //  - type: <formType>  (so inventory's "type" column will show injection | pen)
  //  - insulinType: <type> (preserve insulin classification separately)
  const onSubmit = (data: InsertMedication) => {
    if (!validateLocation()) {
      form.setError("location", { type: "manual", message: "Please select or enter a storage location" });
      return;
    }
    if (data.quantity <= 0) {
      form.setError("quantity", { type: "manual", message: "Quantity must be greater than 0" });
      return;
    }
    const effectiveLocation = watchLocationInput.trim() !== "" ? watchLocationInput.trim() : locationDropdownValue;

    // Prepare payload: map formType (injection/pen) into `type` (so inventory's "type" column will reflect injection/pen)
    // and preserve insulin classification in `insulinType`.
    const payload = {
      ...data,
      location: effectiveLocation,
      // map formType into type (injection | pen) for inventory display
      type: data.formType,
      // keep insulin classification separate so we don't lose it
      insulinType: data.type,
    } as any;

    addMedicationMutation.mutate(payload);
  };

  const addMedicationMutation = useMutation({
    mutationFn: async (data: any) => {
      // POST body will include `type` (injection/pen) and `insulinType` (rapid/long/etc.)
      const response = await apiRequest("POST", "/api/medications", data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/medications"] });
      queryClient.invalidateQueries({ queryKey: ["/api/medications/low-stock"] });
      queryClient.invalidateQueries({ queryKey: ["/api/transactions"] });
      toast({ title: "Success", description: "Medication added successfully", duration: 3000 });
      form.reset();
      setLocationDropdownValue("");
      setSelectedExistingMedId("");
      onOpenChange(false);
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

  const medicalNameError = form.formState.errors.medicalName;
  const genericNameError = form.formState.errors.genericName;
  const typeError = form.formState.errors.type;
  const doseError = form.formState.errors.dose;
  const quantityError = form.formState.errors.quantity;
  const expirationDateError = form.formState.errors.expirationDate;
  const locationError = form.formState.errors.location;

  // when user edits name fields, clear selected existing med
  const handleMedicalNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    form.setValue("medicalName", capitalizeWords(e.target.value));
    if (selectedExistingMedId) setSelectedExistingMedId("");
  };
  const handleGenericNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    form.setValue("genericName", capitalizeWords(e.target.value));
    if (selectedExistingMedId) setSelectedExistingMedId("");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Plus className="h-5 w-5 text-primary" />
            Add Insulin Medication
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          {medsLoading ? (
            <div className="p-3">Loading medications...</div>
          ) : medsError ? (
            <div className="p-3 text-destructive">Failed to load existing medications.</div>
          ) : existingMedications.length > 0 ? (
            <div className="space-y-2 p-3 bg-blue-50 rounded-lg border border-blue-200">
              <Label className="text-sm font-medium text-blue-800">Select Existing Medication (Optional)</Label>
              <Select onValueChange={handleExistingMedicationSelect} value={selectedExistingMedId}>
                <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent>
                  {existingMedications.map((medication) => (
                    <SelectItem key={medication.id} value={medication.id}>
                      {medication.medicalName} {medication.genericName && `(${medication.genericName})`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : (
            <div className="p-3 text-sm text-muted-foreground">No existing medications in inventory.</div>
          )}

          {/* Medical Name then Generic Name */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>
                Medical Name <span className="text-destructive">*</span>
              </Label>
              <Input
                placeholder="e.g., Humalog"
                value={form.watch("medicalName")}
                onChange={handleMedicalNameChange}
                required
              />
              {medicalNameError && <p className="text-sm text-destructive">{medicalNameError.message}</p>}
            </div>
            <div>
              <Label>
                Generic Name <span className="text-destructive">*</span>
              </Label>
              <Input
                placeholder="e.g., Insulin Lispro"
                value={form.watch("genericName")}
                onChange={handleGenericNameChange}
                required
              />
              {genericNameError && <p className="text-sm text-destructive">{genericNameError.message}</p>}
            </div>
          </div>

          {/* Injection/Pen dropdown */}
          <div>
            <Label>
              Form <span className="text-destructive">*</span>
            </Label>
            <Select value={form.watch("formType")} onValueChange={(value) => form.setValue("formType", value)} required>
              <SelectTrigger><SelectValue placeholder="Select form..." /></SelectTrigger>
              <SelectContent>
                <SelectItem value="injection">Injection</SelectItem>
                <SelectItem value="pen">Pen</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>
                Insulin Type <span className="text-destructive">*</span>
              </Label>
              <Select value={form.watch("type")} onValueChange={(value) => form.setValue("type", value)} required>
                <SelectTrigger><SelectValue placeholder="Select type..." /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="rapid">Rapid Acting</SelectItem>
                  <SelectItem value="long">Long Acting</SelectItem>
                  <SelectItem value="intermediate">Intermediate</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
              {typeError && <p className="text-sm text-destructive">{typeError.message}</p>}
            </div>
            <div>
              <Label>
                Dose <span className="text-destructive">*</span>
              </Label>
              <Input
                placeholder="e.g., 100 units/mL"
                value={watchDose}
                onChange={handleDoseChange}
                required
              />
              {doseError && <p className="text-sm text-destructive">{doseError.message}</p>}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>
                Quantity <span className="text-destructive">*</span>
              </Label>
              <Input
                type="number"
                min="1"
                {...form.register("quantity", {
                  required: "Quantity is required",
                  valueAsNumber: true,
                  validate: (value) => value > 0 || "Quantity must be greater than 0",
                })}
                required
              />
              {quantityError && <p className="text-sm text-destructive">{quantityError.message}</p>}
            </div>
            <div>
              <Label>
                Expiration Date <span className="text-destructive">*</span>
              </Label>
              <Input
                type="date"
                {...form.register("expirationDate", { required: "Expiration date is required" })}
                required
              />
              {expirationDateError && <p className="text-sm text-destructive">{expirationDateError.message}</p>}
            </div>
          </div>

          {/* Location selector */}
          <div className="space-y-2 p-3 bg-blue-50 rounded-lg border border-blue-200">
            <Label className="text-sm font-medium text-blue-800">Select Existing Storage Location (Optional)</Label>
            {existingLocations.length > 0 ? (
              <Select onValueChange={handleExistingLocationSelect} value={locationDropdownValue}>
                <SelectTrigger><SelectValue placeholder="Select a location..." /></SelectTrigger>
                <SelectContent>
                  {existingLocations.map((loc) => (
                    <SelectItem key={loc} value={loc}>{loc}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <div className="p-3 text-sm text-muted-foreground">No existing storage locations found.</div>
            )}
          </div>

          <div>
            <Label>
              Or Type New Storage Location <span className="text-destructive">*</span>
            </Label>
            <Input
              placeholder="e.g., Fridge A - Shelf 2"
              value={watchLocationInput}
              onChange={handleLocationInputChange}
            />
            {locationError && <p className="text-sm text-destructive">{locationError.message}</p>}
          </div>

          <div className="flex gap-3 pt-4">
            <Button type="submit" className="flex-1" disabled={addMedicationMutation.isLoading}>
              {addMedicationMutation.isLoading ? "Adding..." : <><Plus className="h-4 w-4 mr-2" />Add Medication</>}
            </Button>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
