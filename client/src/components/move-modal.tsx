import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { type Medication } from "@shared/schema";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { HandHeart, Plus, Minus, Check } from "lucide-react";

interface MoveModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  medication: Medication | null;
}

export function MoveModal({ open, onOpenChange, medication }: MoveModalProps) {
  const [moveQuantity, setMoveQuantity] = useState("");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const moveMutation = useMutation({
    mutationFn: async (data: { medicationId: string; quantity: number }) => {
      const response = await apiRequest("POST", "/api/medications/move", data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/medications"] });
      queryClient.invalidateQueries({ queryKey: ["/api/medications/low-stock"] });
      queryClient.invalidateQueries({ queryKey: ["/api/transactions"] });

      toast({
        title: "Success",
        description: `Successfully moved medication`,
        duration: 3000,
      });

      setMoveQuantity("");
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

  const handleMove = () => {
    if (!medication) return;
    const qty = parseInt(moveQuantity, 10);
    if (!qty || qty < 1) {
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
        description: "Cannot move more than available stock",
        variant: "destructive",
      });
      return;
    }
    moveMutation.mutate({ medicationId: medication.id, quantity: qty });
  };

  const increment = () => {
    if (!medication) return;
    const current = moveQuantity === "" ? 0 : parseInt(moveQuantity, 10);
    if (current < medication.quantity) {
      setMoveQuantity(String(current + 1));
    }
  };

  const decrement = () => {
    const current = moveQuantity === "" ? 0 : parseInt(moveQuantity, 10);
    if (current > 1) {
      setMoveQuantity(String(current - 1));
    }
  };

  if (!medication) return null;

  const qtyNumber = moveQuantity === "" ? 0 : parseInt(moveQuantity, 10);
  const canDecrement = qtyNumber > 1;
  const canIncrement = qtyNumber < medication.quantity;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="text-rose-700">Move Medication</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Medication</Label>
            <p className="mt-1">{medication.medicalName} ({medication.genericName})</p>
          </div>
          <div>
            <Label>Available</Label>
            <p className="mt-1">{medication.quantity}</p>
          </div>
          <div>
            <Label>Quantity to Move</Label>
            <div className="flex items-center space-x-2">
              <Button
                variant="outline"
                className="p-2"
                disabled={!canDecrement}
                onClick={decrement}
              >
                <Minus className="h-4 w-4" />
              </Button>
              <Input
                value={moveQuantity}
                onChange={(e) => {
                  const val = e.target.value;
                  if (val === "" || /^\d+$/.test(val)) {
                    setMoveQuantity(val);
                  }
                }}
                className="w-16 text-center"
                data-testid="input-move-quantity"
              />
              <Button
                variant="outline"
                className="p-2"
                disabled={!canIncrement}
                onClick={increment}
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </div>
          <div className="flex justify-end space-x-2">
            <Button
              variant="outline"
              onClick={() => {
                setMoveQuantity("");
                onOpenChange(false);
              }}
            >
              Cancel
            </Button>
            <Button
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
              onClick={handleMove}
              disabled={moveMutation.isLoading}
            >
              <HandHeart className="h-4 w-4 mr-1" />
              Confirm Move
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
