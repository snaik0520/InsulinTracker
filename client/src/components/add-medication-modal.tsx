import { useMemo, useState, useEffect } from "react";
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

  // Group medications by generic + medical name, sum quantities & group locations
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

  // Extract unique locations across all meds for dropdown
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

  // Separate state for location dropdown value (selected existing location)
  const [locationDropdownValue, setLocationDropdownValue] = useState<string>("");

  // When selecting existing medication:
  // 1) Set form fields (genericName, medicalName, type, dose, quantity=0, expirationDate="")
  // 2) Find the location with highest quantity for that medication and set dropdown to that location
  // 3) Clear the text input for location (so user can type new location if they want)
  const handleExistingMedicationSelect = (medicationId: string) => {
    const medication = existingMedications.find((med) => med.id === medicationId);
    if (medication) {
      form.setValue("genericName", medication.genericName || "");
      form.setValue("medicalName", medication.medicalName || "");
      form.setValue("type", medication.type || "");
      form.setValue("dose", medication.dose || "");
      form.setValue("quantity", 0);
      form.setValue("expirationDate", "");

      // Find location with max quantity
      let maxLocation = "";
      let maxQty = -1;
      medication.locationCounts.forEach((qty, loc) => {
        if (qty > maxQty) {
          maxQty = qty;
          maxLocation = loc;
        }
      });

      // Set dropdown location to maxLocation or empty
      setLocationDropdownValue(maxLocation);

      // Clear form location input (user can type new location)
      form.setValue("location", "");
    }
  };

  // When user selects a location from dropdown, update dropdown value state and clear form input (to avoid conflict)
  const handleExistingLocationSelect = (loc: string) => {
    setLocationDropdownValue(loc);
    // Clear text input location since user picked existing location
    form.setValue("location", "");
  };

  // Watch text input location value, if user types something, clear dropdown selection (so only one source sets location)
  const watchLocationInput = form.watch("location");
  useEffect(() => {
    if (watchLocationInput && watchLocationInput.trim() !== "") {
      setLocationDropdownValue("");
    }
  }, [watchLocationInput]);

  // On submit, determine effective location:
  // If user typed new location (text input) use that, else use selected dropdown location
  const onSubmit = (data: InsertMedication) => {
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
              <Select onValueChange={handleExistingMedicationSelect} value={form.watch("genericName") ? existingMedications.find(med => med.genericName === form.watch("genericName") && med.medicalName === form.watch("medicalName"))?.id ?? "" : ""} defaultValue="">
                <SelectTrigger id="existing-medication" data-testid="select-existing-medication" className="w-full">
                  <SelectValue placeholder="Select" />
                </SelectTrigger>
                <SelectContent>
                  {existingMedications.map((medication) => (
                    <SelectItem key={medication.id} value={medication.id}>
                      <div className="flex items-center justify-between w-full">
                        <span>
                          {medication.genericName} ({medication.medicalName})
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
              <Label htmlFor="genericName">Generic Name</Label>
              <Input
                id="genericName"
                placeholder="e.g., Insulin Lispro"
                value={form.watch("genericName")}
                onChange={(e) => form.setValue("genericName", capitalizeWords(e.target.value))}
                data-testid="input-generic-name"
              />
              {form.formState.errors.genericName && (
                <p className="text-sm text-destructive mt-1">{form.formState.errors.genericName.message}</p>
              )}
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
              {form.formState.errors.medicalName && (
                <p className="text-sm text-destructive mt-1">{form.formState.errors.medicalName.message}</p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="type">Insulin Type</Label>
              <Select value={form.watch("type")} onValueChange={(value) => form.setValue("type", value)}>
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
              {form.formState.errors.type && (
                <p className="text-sm text-destructive mt-1">{form.formState.errors.type.message}</p>
              )}
            </div>

            <div>
              <Label htmlFor="dose">Dose</Label>
              <Input id="dose" placeholder="e.g., 100 units/mL" {...form.register("dose")} data-testid="input-dose" />
              {form.formState.errors.dose && (
                <p className="text-sm text-destructive mt-1">{form.formState.errors.dose.message}</p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="quantity">Quantity</Label>
              <Input
                id="quantity"
                type="number"
                min="0"
                {...form.register("quantity", { valueAsNumber: true })}
                data-testid="input-quantity"
              />
              {form.formState.errors.quantity && (
                <p className="text-sm text-destructive mt-1">{form.formState.errors.quantity.message}</p>
              )}
            </div>

            <div>
              <Label htmlFor="expirationDate">Expiration Date</Label>
              <Input
                id="expirationDate"
                type="date"
                {...form.register("expirationDate")}
                data-testid="input-expiration-date"
              />
              {form.formState.errors.expirationDate && (
                <p className="text-sm text-destructive mt-1">{form.formState.errors.expirationDate.message}</p>
              )}
            </div>
          </div>

          {/* Storage Location selection + input */}
          <div className="space-y-2 p-3 bg-green-50 rounded-lg border border-green-200">
            <Label htmlFor="existing-location" className="text-sm font-medium text-green-800">
              Select Existing Storage Location (Optional)
            </Label>

            {existingLocations.length > 0 ? (
              <Select
                onValueChange={handleExistingLocationSelect}
                value={locationDropdownValue}
                defaultValue=""
              >
                <SelectTrigger id="existing-location" data-testid="select-existing-location" className="w-full">
                  <SelectValue placeholder="Select a location or type new..." />
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

            {/* Text input for new or custom location - always enabled */}
            <Input
              id="location"
              placeholder="Or type new location here"
              value={watchLocationInput}
              onChange={(e) => form.setValue("location", e.target.value)}
              className="mt-2"
              data-testid="input-location"
            />
            {form.formState.errors.location && (
              <p className="text-sm text-destructive mt-1">{form.formState.errors.location.message}</p>
            )}
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
