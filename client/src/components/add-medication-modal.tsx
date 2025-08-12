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

  // Capitalize first letter of each word helper
  const capitalizeWords = (str: string) => {
    return str.replace(/\b\w/g, (c) => c.toUpperCase());
  };

  // Fetch medications
  const { data: allMedications = [], isLoading: medsLoading, isError: medsError } = useQuery<Medication[]>({
    queryKey: ["/api/medications"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/medications");
      return res.json();
    },
    enabled: open,
    staleTime: 1000 * 60 * 2,
  });

  // Group meds by generic+medical, sum quantities & location counts
  const existingMedications = useMemo(() => {
    const map = new Map<
      string,
      Medication & {
        quantity: number;
        locationCounts: Map<string, number>;
      }
    >();

    for (const med of allMedications) {
      const key = `${med.genericName || ""}||${med.medicalName || ""}`;
      if (!map.has(key)) {
        const locationCounts = new Map<string, number>();
        if (med.location?.trim()) {
          locationCounts.set(med.location.trim(), med.quantity ?? 0);
        }
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

  // Unique existing locations for dropdown
  const existingLocations = useMemo(() => {
    const set = new Set<string>();
    for (const med of allMedications) {
      if (med.location?.trim()) {
        set.add(med.location.trim());
      }
    }
    return Array.from(set);
  }, [allMedications]);

  const form = useForm<InsertMedication>({
    resolver: zodResolver(insertMedicationSchema),
    defaultValues: {
      genericName: "",
      medicalName: "",
      type: "",
      dose: "",
      quantity: 0,
      expirationDate: "",
      location: "",
    },
  });

  // Dropdown state for location
  const [locationDropdownValue, setLocationDropdownValue] = useState<string>("");

  // Reset form and dropdown state when modal closes
  useEffect(() => {
    if (!open) {
      form.reset();
      setLocationDropdownValue("");
    }
  }, [open, form]);

  // When medication selected, fill form and set dropdown location to most common location
  const handleExistingMedicationSelect = (medicationId: string) => {
    const medication = existingMedications.find((med) => med.id === medicationId);
    if (medication) {
      form.setValue("genericName", medication.genericName || "");
      form.setValue("medicalName", medication.medicalName || "");
      form.setValue("type", medication.type || "");
      form.setValue("dose", medication.dose || "");
      form.setValue("quantity", 0);
      form.setValue("expirationDate", "");

      // Find most frequent location
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

  // When user picks location from dropdown, clear text input location
  const handleExistingLocationSelect = (loc: string) => {
    setLocationDropdownValue(loc);
    form.setValue("location", "");
  };

  // Watch location input, clear dropdown if user types new location
  const watchLocationInput = form.watch("location");
  useEffect(() => {
    if (watchLocationInput && watchLocationInput.trim() !== "") {
      setLocationDropdownValue("");
    }
  }, [watchLocationInput]);

  // Auto-capitalize words as user types location input
  const handleLocationInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const capitalized = capitalizeWords(e.target.value);
    form.setValue("location", capitalized);
  };

  // Watch dose input for special formatting
  const doseRef = useRef<HTMLInputElement | null>(null);
  const watchDose = form.watch("dose");

  const handleDoseChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let val = e.target.value;

    // If val starts with '.' (like ".5"), add leading 0
    if (/^\.\d*$/.test(val)) {
      val = "0" + val;
    }

    // If val is numeric and less than 1 but does NOT start with 0, add leading zero (e.g., "0.75")
    // This also ensures user can't enter something like "00.5"
    if (/^\d*\.?\d*$/.test(val)) {
      const numericVal = parseFloat(val);
      if (numericVal < 1 && numericVal > 0 && !val.startsWith("0")) {
        val = "0" + val;
      }
    }

    form.setValue("dose", val);
  };

  // Extra local validation to ensure location (either dropdown or input) is provided
  const validateLocation = () => {
    return watchLocationInput.trim() !== "" || locationDropdownValue !== "";
  };

  // On submit use text input location if filled, else dropdown
  const onSubmit = (data: InsertMedication) => {
    if (!validateLocation()) {
      form.setError("location", {
        type: "manual",
        message: "Please select or enter a storage location",
      });
      return;
    }

    if (data.quantity <= 0) {
      form.setError("quantity", {
        type: "manual",
        message: "Quantity must be greater than 0",
      });
      return;
    }

    const effectiveLocation = watchLocationInput.trim() !== "" ? watchLocationInput.trim() : locationDropdownValue;
    addMedicationMutation.mutate({ ...data, location: effectiveLocation });
  };

  const addMedicationMutation = useMutation({
    mutationFn: async (data: InsertMedication) => {
      const response = await apiRequest("POST", "/api/medications", data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/medications"] });
      queryClient.invalidateQueries({ queryKey: ["/api/medications/low-stock"] });
      queryClient.invalidateQueries({ queryKey: ["/api/transactions"] });
      toast({
        title: "Success",
        description: "Medication added successfully",
        duration: 3000,
      });
      form.reset();
      setLocationDropdownValue("");
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

  // Helper: mark required fields with error if empty after touched
  const genericNameError = form.formState.errors.genericName;
  const typeError = form.formState.errors.type;
  const doseError = form.formState.errors.dose;
  const quantityError = form.formState.errors.quantity;
  const expirationDateError = form.formState.errors.expirationDate;
  const locationError = form.formState.errors.location;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg" data-testid="modal-add-medication">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Plus className="h-5 w-5 text-primary" />
            Add Insulin Medication
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          {/* Existing medication selector */}
          {medsLoading ? (
            <div className="p-3">Loading medications...</div>
          ) : medsError ? (
            <div className="p-3 text-destructive">Failed to load existing medications.</div>
          ) : existingMedications.length > 0 ? (
            <div className="space-y-2 p-3 bg-blue-50 rounded-lg border border-blue-200">
              <Label htmlFor="existing-medication" className="text-sm font-medium text-blue-800">
                Select Existing Medication (Optional)
              </Label>
              <Select
                onValueChange={handleExistingMedicationSelect}
                value={
                  form.watch("genericName")
                    ? existingMedications.find(
                        (med) =>
                          med.genericName === form.watch("genericName") &&
                          med.medicalName === form.watch("medicalName")
                      )?.id ?? ""
                    : ""
                }
                defaultValue=""
              >
                <SelectTrigger id="existing-medication" data-testid="select-existing-medication" className="w-full">
                  <SelectValue placeholder="Select" />
                </SelectTrigger>
                <SelectContent>
                  {existingMedications.map((medication) => (
                    <SelectItem key={medication.id} value={medication.id}>
                      <div className="flex items-center justify-between w-full">
                        <span>
                          {medication.genericName}{" "}
                          {medication.medicalName && medication.medicalName.trim() !== "" ? `(${medication.medicalName})` : ""}
                        </span>
                        <span className="text-xs text-gray-500 ml-2">{medication.quantity ?? 0} injections</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : (
            <div className="p-3 text-sm text-muted-foreground">No existing medications in inventory.</div>
          )}

          {/* Medication fields */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="genericName">
                Generic Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="genericName"
                placeholder="e.g., Insulin Lispro"
                value={form.watch("genericName")}
                onChange={(e) => form.setValue("genericName", capitalizeWords(e.target.value))}
                data-testid="input-generic-name"
                required
              />
              {genericNameError && <p className="text-sm text-destructive mt-1">{genericNameError.message}</p>}
            </div>

            <div>
              <Label htmlFor="medicalName">Brand/Medical Name</Label>
              <Input
                id="medicalName"
                placeholder="e.g., Humalog"
                value={form.watch("medicalName")}
                onChange={(e) => form.setValue("medicalName", capitalizeWords(e.target.value))}
                data-testid="input-medical-name"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="type">
                Insulin Type <span className="text-destructive">*</span>
              </Label>
              <Select
                value={form.watch("type")}
                onValueChange={(value) => form.setValue("type", value)}
                required
              >
                <SelectTrigger data-testid="select-insulin-type">
                  <SelectValue placeholder="Select type..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="rapid">Rapid Acting</SelectItem>
                  <SelectItem value="long">Long Acting</SelectItem>
                  <SelectItem value="intermediate">Intermediate</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
              {typeError && <p className="text-sm text-destructive mt-1">{typeError.message}</p>}
            </div>

            <div>
              <Label htmlFor="dose">
                Dose <span className="text-destructive">*</span>
              </Label>
              <Input
                id="dose"
                placeholder="e.g., 100 units/mL"
                value={watchDose}
                onChange={handleDoseChange}
                data-testid="input-dose"
                required
              />
              {doseError && <p className="text-sm text-destructive mt-1">{doseError.message}</p>}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="quantity">
                Quantity <span className="text-destructive">*</span>
              </Label>
              <Input
                id="quantity"
                type="number"
                min="1"
                {...form.register("quantity", {
                  required: "Quantity is required",
                  valueAsNumber: true,
                  validate: (value) => value > 0 || "Quantity must be greater than 0",
                })}
                data-testid="input-quantity"
                required
              />
              {quantityError && <p className="text-sm text-destructive mt-1">{quantityError.message}</p>}
            </div>

            <div>
              <Label htmlFor="expirationDate">
                Expiration Date <span className="text-destructive">*</span>
              </Label>
              <Input
                id="expirationDate"
                type="date"
                {...form.register("expirationDate", { required: "Expiration date is required" })}
                data-testid="input-expiration-date"
                required
              />
              {expirationDateError && <p className="text-sm text-destructive mt-1">{expirationDateError.message}</p>}
            </div>
          </div>

          {/* Storage Location dropdown inside blue box */}
          <div className="space-y-2 p-3 bg-blue-50 rounded-lg border border-blue-200">
            <Label htmlFor="existing-location" className="text-sm font-medium text-blue-800">
              Select Existing Storage Location (Optional)
            </Label>

            {existingLocations.length > 0 ? (
              <Select
                onValueChange={handleExistingLocationSelect}
                value={locationDropdownValue}
                defaultValue=""
              >
                <SelectTrigger id="existing-location" data-testid="select-existing-location" className="w-full">
                  <SelectValue placeholder="Select a location..." />
                </SelectTrigger>
                <SelectContent>
                  {existingLocations.map((loc) => (
                    <SelectItem key={loc} value={loc}>
                      {loc}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <div className="p-3 text-sm text-muted-foreground">No existing storage locations found.</div>
            )}
          </div>

          {/* Storage Location text input below blue box */}
          <div>
            <Label htmlFor="location">
              Or Type New Storage Location <span className="text-destructive">*</span>
            </Label>
            <Input
              id="location"
              placeholder="e.g., Fridge A - Shelf 2"
              value={watchLocationInput}
              onChange={handleLocationInputChange}
              data-testid="input-location"
              required={false} // handled by manual validation
            />
            {locationError && <p className="text-sm text-destructive mt-1">{locationError.message}</p>}
          </div>

          <div className="flex gap-3 pt-4">
            <Button
              type="submit"
              className="flex-1"
              disabled={addMedicationMutation.isLoading}
              data-testid="button-add-medication"
            >
              {addMedicationMutation.isLoading ? (
                "Adding..."
              ) : (
                <>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Medication
                </>
              )}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              data-testid="button-cancel"
            >
              Cancel
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
