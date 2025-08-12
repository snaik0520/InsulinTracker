import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  insertMedicationSchema,
  type InsertMedication,
  type Medication,
} from "@shared/schema";
import {
  useMutation,
  useQueryClient,
  useQuery,
} from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Plus } from "lucide-react";

interface AddMedicationModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AddMedicationModal({
  open,
  onOpenChange,
}: AddMedicationModalProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  /* ────────────────────────────────────────────────────────────
     1. Fetch all medications ONLY while the modal is open
  ──────────────────────────────────────────────────────────── */
  const { data: allMedications = [] } = useQuery<Medication[]>({
    queryKey: ["/api/medications"],
    enabled: open,
  });

  /* ────────────────────────────────────────────────────────────
     2. Build a unique-by-name list for the dropdown with totals
        ‣ FIX: use === comparisons (not = assignments)
  ──────────────────────────────────────────────────────────── */
  const existingMedications = allMedications.reduce(
    (unique, medication) => {
      const already = unique.find(
        (m) =>
          m.genericName === medication.genericName &&
          m.medicalName === medication.medicalName
      );

      if (!already) {
        const totalQuantity = allMedications
          .filter(
            (m): m is Medication =>
              m.genericName === medication.genericName &&
              m.medicalName === medication.medicalName
          )
          .reduce((sum, m) => sum + m.quantity, 0);

        unique.push({ ...medication, quantity: totalQuantity });
      }

      return unique;
    },
    [] as Medication[]
  );

  /* ────────────────────────────────────────────────────────────
     3. React-Hook-Form setup
  ──────────────────────────────────────────────────────────── */
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

  /* ────────────────────────────────────────────────────────────
     4. Mutation to add medication
  ──────────────────────────────────────────────────────────── */
  const addMedicationMutation = useMutation({
    mutationFn: async (data: InsertMedication) => {
      const res = await apiRequest("POST", "/api/medications", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/medications"] });
      queryClient.invalidateQueries({
        queryKey: ["/api/medications/low-stock"],
      });
      queryClient.invalidateQueries({ queryKey: ["/api/transactions"] });

      toast({
        title: "Success",
        description: "Medication added successfully",
      });

      form.reset();
      onOpenChange(false);
    },
    onError: (err: Error) => {
      toast({
        title: "Error",
        description: err.message,
        variant: "destructive",
      });
    },
  });

  const handleExistingSelect = (medicationId: string) => {
    const med = existingMedications.find((m) => m.id === medicationId);
    if (med) {
      form.setValue("genericName", med.genericName);
      form.setValue("medicalName", med.medicalName);
      form.setValue("type", med.type);
      form.setValue("dose", med.dose);
      form.setValue("location", med.location);
      form.setValue("quantity", 0); // reset for new stock
      form.setValue("expirationDate", "");
    }
  };

  const onSubmit = (data: InsertMedication) =>
    addMedicationMutation.mutate(data);

  /* ────────────────────────────────────────────────────────────
     5. Render
  ──────────────────────────────────────────────────────────── */
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="sm:max-w-lg"
        data-testid="modal-add-medication"
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Plus className="h-5 w-5 text-primary" />
            Add Insulin Medication
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          {/* Existing medication selector */}
          {existingMedications.length > 0 && (
            <div className="space-y-3 p-4 bg-blue-50 rounded-lg border border-blue-200">
              <div>
                <Label
                  htmlFor="existing-medication"
                  className="text-sm font-medium text-blue-800"
                >
                  Select Existing Medication (Optional)
                </Label>
                <p className="text-xs text-blue-600 mb-2">
                  Choose from current inventory to automatically fill medication
                  details
                </p>

                <Select onValueChange={handleExistingSelect}>
                  <SelectTrigger data-testid="select-existing-medication">
                    <SelectValue placeholder="Choose from current inventory or leave blank for new medication..." />
                  </SelectTrigger>
                  <SelectContent>
                    {existingMedications.map((m) => (
                      <SelectItem key={m.id} value={m.id}>
                        <div className="flex items-center justify-between w-full">
                          <span>
                            {m.genericName} ({m.medicalName})
                          </span>
                          <span className="text-xs text-gray-500 ml-2">
                            {m.quantity} vials
                          </span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          {/* Form fields */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="genericName">Generic Name</Label>
              <Input
                id="genericName"
                placeholder="e.g., Insulin Lispro"
                {...form.register("genericName")}
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
                {...form.register("medicalName")}
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
                onValueChange={(v) => form.setValue("type", v)}
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

          <div>
            <Label htmlFor="location">Storage Location</Label>
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
              disabled={addMedicationMutation.isPending}
              data-testid="button-add-medication"
            >
              {addMedicationMutation.isPending ? (
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
