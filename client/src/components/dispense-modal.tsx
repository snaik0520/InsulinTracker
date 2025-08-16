// components/dispense-modal.tsx
import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { type Medication } from "@shared/schema";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { HandHeart, Minus, Plus, Check } from "lucide-react";

interface DispenseModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  medication: Medication | null;
}

export function DispenseModal({ open, onOpenChange, medication }: DispenseModalProps) {
  // start with empty so user can type without deleting "1"
  const [dispenseQuantity, setDispenseQuantity] = useState<number | "">("");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // helper to determine pen vs injection
  const isPenForm = (med: Medication | null) =>
    !!(
      med &&
      (
        (med.administrationForm || (med as any).administrativeForm || (med as any).formType || "")
          .toString()
          .toLowerCase()
          .includes("pen")
      )
    );

  const dispenseMutation = useMutation({
    mutationFn: async (data: { medicationId: string; quantity: number }) => {
      // your server endpoint should handle decrementing the specific medication record by id
      const response = await apiRequest("POST", "/api/medications/dispense", data);
      return response.json();
    },
    onSuccess: (_res, variables) => {
      // optimistic update: subtract from this exact medication id
      queryClient.setQueryData<Medication[] | undefined>(["/api/medications"], (old) => {
        if (!old) return old;
        return old.map((m) => {
          if (m.id !== variables.medicationId) return m;
          return { ...m, quantity: Math.max(0, (m.quantity ?? 0) - variables.quantity) };
        });
      });

      // invalidate other caches that depend on transactions or low-stock
      queryClient.invalidateQueries({ queryKey: ["/api/transactions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/medications/low-stock"] });

      const qty = variables.quantity;
      const isPen = isPenForm(medication);
      const word = qty === 1 ? (isPen ? "pen" : "injection") : isPen ? "pens" : "injections";

      toast({
        title: "Success",
        description: `Successfully dispensed ${qty} ${word}`,
        duration: 3000,
      });

      // reset
      setDispenseQuantity("");
      onOpenChange(false);
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleDispense = () => {
    if (!medication) return;

    // validation
    if (dispenseQuantity === "" || typeof dispenseQuantity !== "number" || dispenseQuantity < 1) {
      toast({
        title: "Error",
        description: "Please enter a quantity of at least 1",
        variant: "destructive",
      });
      return;
    }
    if (dispenseQuantity > (medication.quantity ?? 0)) {
      toast({
        title: "Error",
        description: "Cannot dispense more than available stock",
        variant: "destructive",
      });
      return;
    }

    dispenseMutation.mutate({
      medicationId: medication.id,
      quantity: dispenseQuantity,
    });
  };

  const incrementQuantity = () => {
    if (!medication) return;
    if (dispenseQuantity === "") {
      setDispenseQuantity(1);
      return;
    }
    if (typeof dispenseQuantity === "number" && dispenseQuantity < (medication.quantity ?? 0)) {
      setDispenseQuantity((q) => (typeof q === "number" ? q + 1 : 1));
    }
  };

  const decrementQuantity = () => {
    if (dispenseQuantity === "" || typeof dispenseQuantity !== "number") return;
    if (dispenseQuantity > 1) {
      setDispenseQuantity((q) => (typeof q === "number" ? q - 1 : 1));
    }
  };

  if (!medication) return null;

  // UI derived values
  const qtyNumber = typeof dispenseQuantity === "number" ? dispenseQuantity : 0;
  const decrementDisabled = qtyNumber <= 1;
  const incrementDisabled = medication ? qtyNumber >= (medication.quantity ?? 0) : true;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md" data-testid="modal-dispense-medication">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <HandHeart className="h-5 w-5 text-green-600" />
            Dispense Medication
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <p className="text-sm text-gray-900" data-testid="text-medication-name">
              {medication.medicalName} ({medication.genericName})
            </p>
            <p className="text-xs text-gray-500 mt-1" data-testid="text-available-stock">
              Available: {medication.quantity ?? 0} {isPenForm(medication) ? "pens" : "injections"}
            </p>
          </div>

          <div>
            <Label htmlFor="dispenseQuantity">Quantity to Dispense</Label>
            <div className="flex items-center space-x-2 mt-1">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={decrementQuantity}
                disabled={decrementDisabled}
                data-testid="button-decrement"
              >
                <Minus className="h-4 w-4" />
              </Button>

              <Input
                id="dispenseQuantity"
                type="number"
                min={1}
                max={medication.quantity}
                // allow empty string for initial blank
                value={dispenseQuantity === "" ? "" : dispenseQuantity}
                onChange={(e) => {
                  const raw = e.target.value;
                  if (raw === "") {
                    setDispenseQuantity("");
                    return;
                  }
                  const parsed = parseInt(raw, 10);
                  if (isNaN(parsed)) {
                    setDispenseQuantity("");
                    return;
                  }
                  const clamped = Math.max(1, Math.min(parsed, medication.quantity ?? parsed));
                  setDispenseQuantity(clamped);
                }}
                className="w-20 text-center"
                data-testid="input-dispense-quantity"
              />

              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={incrementQuantity}
                disabled={incrementDisabled}
                data-testid="button-increment"
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div className="flex gap-3 pt-4">
            <Button
              onClick={handleDispense}
              className="flex-1 bg-green-600 hover:bg-green-700"
              disabled={dispenseMutation.isPending}
              data-testid="button-confirm-dispense"
            >
              {dispenseMutation.isPending ? (
                "Dispensing..."
              ) : (
                <>
                  <Check className="h-4 w-4 mr-2" />
                  Confirm Dispense
                </>
              )}
            </Button>

            <Button variant="outline" onClick={() => onOpenChange(false)} data-testid="button-cancel-dispense">
              Cancel
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default DispenseModal;
