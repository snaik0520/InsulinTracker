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
  // allow empty string initially so box is blank; otherwise a number
  const [dispenseQuantity, setDispenseQuantity] = useState<number | "">("");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const dispenseMutation = useMutation({
    mutationFn: async (data: { medicationId: string; quantity: number }) => {
      const response = await apiRequest("POST", "/api/medications/dispense", data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/medications"] });
      queryClient.invalidateQueries({ queryKey: ["/api/medications/low-stock"] });
      queryClient.invalidateQueries({ queryKey: ["/api/transactions"] });

      // Determine the unit for the toast message based on quantity and administration form
      const unit = isPen
        ? dispenseQuantity === 1 ? "pen" : "pens"
        : dispenseQuantity === 1 ? "injection" : "injections";
        
      toast({
        title: "Success",
        description: `Successfully dispensed ${dispenseQuantity} ${unit}`,
        duration: 3000, // 3 seconds
      });

      // reset to empty so next time user must enter a value again
      setDispenseQuantity("");
      onOpenChange(false);
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
        duration: 3000, // 3 seconds
      });
    },
  });

  const handleDispense = () => {
    if (!medication) return;

    if (dispenseQuantity === "" || typeof dispenseQuantity !== "number" || dispenseQuantity < 1) {
      toast({
        title: "Error",
        description: "Please enter a quantity of at least 1",
        variant: "destructive",
      });
      return;
    }

    if (dispenseQuantity > medication.quantity) {
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

    if (typeof dispenseQuantity === "number" && dispenseQuantity < medication.quantity) {
      setDispenseQuantity(dispenseQuantity + 1);
    }
  };

  const decrementQuantity = () => {
    if (dispenseQuantity === "" || typeof dispenseQuantity !== "number") return;
    if (dispenseQuantity > 1) {
      setDispenseQuantity(dispenseQuantity - 1);
    }
  };

  if (!medication) return null;

  // conveniences for UI disabling
  const qtyNumber = typeof dispenseQuantity === "number" ? dispenseQuantity : 0;
  const decrementDisabled = qtyNumber <= 1;
  const incrementDisabled = qtyNumber >= medication.quantity;

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
              Available: {medication.quantity}
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
                  // clamp to [1, medication.quantity]
                  const clamped = Math.max(1, Math.min(parsed, medication.quantity));
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
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              data-testid="button-cancel-dispense"
            >
              Cancel
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
