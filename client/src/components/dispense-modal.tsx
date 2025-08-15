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
  const [dispenseQuantity, setDispenseQuantity] = useState<string>(""); // start empty
  const { toast } = useToast();
  const queryClient = useQueryClient();

  if (!medication) return null;

  const isPens = medication.administrationForm === "pens";
  const singularLabel = isPens ? "pen" : "injection";
  const pluralLabel = isPens ? "pens" : "injections";

  const dispenseMutation = useMutation({
    mutationFn: async (data: { medicationId: string; quantity: number }) => {
      const response = await apiRequest("POST", "/api/medications/dispense", data);
      return response.json();
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/medications"] });
      queryClient.invalidateQueries({ queryKey: ["/api/medications/low-stock"] });
      queryClient.invalidateQueries({ queryKey: ["/api/transactions"] });
      const qty = variables.quantity;
      toast({
        title: "Success",
        description: `Successfully dispensed ${qty} ${qty === 1 ? singularLabel : pluralLabel}`,
        duration: 3000,
      });
      setDispenseQuantity("");
      onOpenChange(false);
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
        duration: 3000,
      });
    },
  });

  const handleDispense = () => {
    const qty = parseInt(dispenseQuantity, 10);
    if (!medication) return;
    if (isNaN(qty) || qty < 1) {
      toast({
        title: "Error",
        description: "Please enter a quantity of at least 1",
        variant: "destructive",
      });
      return;
    }
    if (qty > medication.quantity) {
      toast({
        title: "Error",
        description: "Cannot dispense more than available stock",
        variant: "destructive",
      });
      return;
    }
    dispenseMutation.mutate({
      medicationId: medication.id,
      quantity: qty,
    });
  };

  const incrementQuantity = () => {
    const current = parseInt(dispenseQuantity || "0", 10);
    if (medication && current < medication.quantity) {
      setDispenseQuantity(String(current + 1));
    }
  };

  const decrementQuantity = () => {
    const current = parseInt(dispenseQuantity || "0", 10);
    if (current > 1) {
      setDispenseQuantity(String(current - 1));
    }
  };

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
              Available: {medication.quantity} {medication.administrationForm}
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
                disabled={parseInt(dispenseQuantity || "0", 10) <= 1}
                data-testid="button-decrement"
              >
                <Minus className="h-4 w-4" />
              </Button>
              <Input
                id="dispenseQuantity"
                type="number"
                placeholder=" "
                min="1"
                max={medication.quantity}
                value={dispenseQuantity}
                onChange={(e) => setDispenseQuantity(e.target.value)}
                className="w-20 text-center"
                data-testid="input-dispense-quantity"
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={incrementQuantity}
                disabled={
                  parseInt(dispenseQuantity || "0", 10) >= medication.quantity
                }
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
