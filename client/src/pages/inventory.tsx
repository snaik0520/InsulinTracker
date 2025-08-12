import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export function DispenseModal({ open, onOpenChange, medication, onConfirm }) {
  const [quantity, setQuantity] = useState(1);
  const [comments, setComments] = useState("");

  useEffect(() => {
    if (medication) {
      setQuantity(1);
      setComments("");
    }
  }, [medication]);

  if (!medication) return null;

  const handleConfirm = () => {
    if (quantity > 0 && quantity <= medication.quantity) {
      onConfirm(quantity, comments);
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Dispense {medication.genericName}</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          <div>
            <Label htmlFor="dispense-quantity">Quantity to Dispense</Label>
            <Input
              id="dispense-quantity"
              type="number"
              min={1}
              max={medication.quantity}
              value={quantity}
              onChange={(e) => setQuantity(Number(e.target.value))}
            />
            <p className="text-xs text-gray-500 mt-1">
              Available: {medication.quantity}
            </p>
          </div>

          <div>
            <Label htmlFor="dispense-comments">Comments</Label>
            <Textarea
              id="dispense-comments"
              placeholder="Add any notes about this dispense..."
              value={comments}
              onChange={(e) => setComments(e.target.value)}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={quantity <= 0 || quantity > medication.quantity}
          >
            Confirm
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
