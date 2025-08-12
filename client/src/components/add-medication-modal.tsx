"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";

interface DispenseModalProps {
  medicationId: string;
  medicationName: string;
  stock: number;
}

export function DispenseModal({
  medicationId,
  medicationName,
  stock,
}: DispenseModalProps) {
  const [dispenseQuantity, setDispenseQuantity] = useState(1);
  const [open, setOpen] = useState(false);
  const queryClient = useQueryClient();

  const dispenseMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/medications/${medicationId}/dispense`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ quantity: dispenseQuantity }),
      });
      if (!res.ok) {
        throw new Error(await res.text());
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/medications"] });
      queryClient.invalidateQueries({ queryKey: ["/api/medications/low-stock"] });
      queryClient.invalidateQueries({ queryKey: ["/api/transactions"] });
      toast({
        title: "Success",
        description: `Successfully dispensed ${dispenseQuantity} vial(s) of ${medicationName}`,
        duration: 3000, // 3 seconds
      });
      setDispenseQuantity(1);
      setOpen(false);
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
    if (dispenseQuantity > stock) {
      toast({
        title: "Error",
        description: "Cannot dispense more than available stock",
        variant: "destructive",
        duration: 3000, // 3 seconds
      });
      return;
    }
    dispenseMutation.mutate();
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">Dispense</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Dispense Medication</DialogTitle>
          <DialogDescription>
            Enter the quantity of <strong>{medicationName}</strong> you want to dispense.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="quantity" className="text-right">
              Quantity
            </Label>
            <Input
              id="quantity"
              type="number"
              min={1}
              value={dispenseQuantity}
              onChange={(e) => setDispenseQuantity(parseInt(e.target.value, 10))}
              className="col-span-3"
            />
          </div>
        </div>
        <Button onClick={handleDispense} disabled={dispenseMutation.isPending}>
          {dispenseMutation.isPending ? "Dispensing..." : "Dispense"}
        </Button>
      </DialogContent>
    </Dialog>
  );
}
