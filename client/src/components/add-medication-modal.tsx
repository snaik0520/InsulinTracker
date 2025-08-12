import { useMemo } from "react";
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

  // Helper to capitalize first letter of each word
  const capitalizeWords = (str: string) => {
    return str.replace(/\b\w/g, (c) => c.toUpperCase());
  };

  // Fetch existing medications for dropdown (provide queryFn)
  const { data: allMedications = [], isLoading: medsLoading, isError: medsError } = useQuery<Medication[]>({
    queryKey: ["/api/medications"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/medications");
      return res.json();
    },
    enabled: open, // only fetch when modal is opened
    staleTime: 1000 * 60 * 2, // 2 minutes
  });

  // Build unique medication list (group by generic+medical name) and sum quantity
  const existingMedications = useMemo(() => {
    const map = new Map<string, Medication & { quantity: number }>();

    for (const med of allMedications) {
      const key = `${med.genericName || ""}||${med.medicalName || ""}`;
      if (!map.has(key)) {
        map.set(key, { ...med, quantity: med.quantity ?? 0 });
      } else {
        const existing = map.get(key)!;
        existing.quantity = (existing.quantity ?? 0) + (med.quantity ?? 0);
      }
    }

    return Array.from(map.values());
  }, [allMedications]);

  // New: build unique list of storage locations
  const existingLocations = useMemo(() => {
    const locationsSet = new Set<string>();
    for (const med of allMedications) {
      if (med.location && med.location.trim() !== "") {
        locationsSet.add(med.location.trim());
      }
    }
    return Array.from(locationsSet);
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
        duration: 3000, // 3 seconds
      });
      form.reset();
      onOpenChange(false);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error?.message ?? "An error occurred",
        variant: "destructive",
        duration: 3000, // 3 seconds
      });
    },
  });

  const handleExistingMedicationSelect = (medicationId: string) => {
    const medication = existingMedications.find(med => med.id === medicationId);
    if (medication) {
      form.setValue("genericName", medication.genericName || "");
      form.setValue("medicalName", medication.medicalName || "");
      form.setValue("type", medication.type || "");
      form.setValue("dose", medication.dose || "");
      form.setValue("location", medication.location || "");
      // Reset quantity and expiration for new stock
      form.setValue("quantity", 0);
      form.setValue("expirationDate", "");
    }
  };

  const onSubmit = (data: InsertMedication) => {
    addMedicationMutation.mutate(data);
  };

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
          {/* Existing medication selector at the top */}
          {medsLoading ? (
            <div className="p-3">Loading medications...</div>
          ) : medsError ? (
            <div className="p-3 text-destructive">Failed to load existing medications.</div>
          ) : existingMedications.length > 0 ? (
            <div className="space-y-2 p-3 bg-blue-50 rounded-lg border border-blue-200">
              <Label htmlFor="existing-medication" className="text-sm font-medium text-blue-800">
                Select Existing Medication (Optional)
              </Label>
              <Select onValueChange={handleExistingMedicationSelect} defaultValue="">
                <SelectTrigger id="existing-medication" data-testid="select-existing-medication" className="w-full">
                  <SelectValue placeholder="Select" />
                </SelectTrigger>
                <SelectContent>
                  {existingMedications.map((medication) => (
                    <SelectItem key={medication.id} value={medication.id}>
                      <div className="flex items-center justify-between w-full">
                        <span>{medication.genericName} ({medication.medicalName})</span>
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
                <p className="text-sm text-destructive mt-1">
                  {form.formState.errors.genericName.message}
                </p>
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
                <p className="text-sm text-destructive mt-1">
                  {form.formState.errors.medicalName.message}
                </p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="type">Insulin Type</Label>
              <Select
                value={form.watch("type")}
                onValueChange={(value) => form.setValue("type", value)}
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
              {form.formState.errors.type && (
                <p className="text-sm text-destructive mt-1">
                  {form.formState.errors.type.message}
                </p>
              )}
            </div>

            <div>
              <Label htmlFor="dose">Dose</Label>
              <Input
                id="dose"
                placeholder="e.g., 100 units/mL"
                {...form.register("dose")}
                data-testid="input-dose"
              />
              {form.formState.errors.dose && (
                <p className="text-sm text-destructive mt-1">
                  {form.formState.errors.dose.message}
                </p>
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
                <p className="text-sm text-destructive mt-1">
                  {form.formState.errors.quantity.message}
                </p>
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
                <p className="text-sm text-destructive mt-1">
                  {form.formState.errors.expirationDate.message}
                </p>
              )}
            </div>
          </div>

          {/* Storage Location with dropdown + free typing */}
          <div>
            <Label htmlFor="existing-location-select" className="mb-1 font-medium">
              Select Existing Storage Location (Optional)
            </Label>
            {existingLocations.length > 0 ? (
              <Select
                id="existing-location-select"
                onValueChange={(value) => form.setValue("location", value)}
                defaultValue=""
              >
                <SelectTrigger>
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
              <div className="text-sm text-muted-foreground mb-2">No existing locations found.</div>
            )}

            <Label htmlFor="location" className="mt-4">
              Or Enter Storage Location
            </Label>
            <Input
              id="location"
              placeholder="e.g., Fridge A - Shelf 2"
              {...form.register("location")}
              data-testid="input-location"
            />
            {form.formState.errors.location && (
              <p className="text-sm text-destructive mt-1">
                {form.formState.errors.location.message}
              </p>
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
