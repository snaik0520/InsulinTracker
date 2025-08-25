import { useState, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { type Medication } from "@shared/schema";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { ArrowRightLeft, Minus, Plus, Check } from "lucide-react";

interface MoveModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  medication: Medication | null;
}

export function MoveModal({ open, onOpenChange, medication }: MoveModalProps) {
  const [moveQuantity, setMoveQuantity] = useState("");
  const [destinationLocation, setDestinationLocation] = useState("");
  const [selectedExistingLocation, setSelectedExistingLocation] = useState("");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: allMedications = [] } = useQuery({
    queryKey: ["/api/medications"],
    enabled: open,
  });

  const existingLocations = useMemo(() => {
    const locations = new Set<string>();
    allMedications.forEach((med: Medication) => {
      if (med.location?.trim() && med.location !== medication?.location) {
        locations.add(med.location.trim());
      }
    });
    return Array.from(locations);
  }, [allMedications, medication?.location]);

  const moveMutation = useMutation({
    mutationFn: async (data: {
      medicationId: string;
      quantity: number;
      destinationLocation: string;
    }) => {
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
      setDestinationLocation("");
      setSelectedExistingLocation("");
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
    const qtyNumber = typeof moveQuantity === "number" ? moveQuantity : parseInt(moveQuantity, 10);
    if (!moveQuantity || isNaN(qtyNumber) || qtyNumber < 1) {
      toast({
        title: "Error",
        description: "Please enter a quantity of at least 1",
        variant: "destructive",
      });
      return;
    }
    if (qtyNumber > medication.quantity) {
      toast({
        title: "Error",
        description: "Cannot move more than available stock",
        variant: "destructive",
      });
      return;
    }
    const finalDestination = destinationLocation.trim() || selectedExistingLocation;
    if (!finalDestination) {
      toast({
        title: "Error",
        description: "Please select or enter a destination location",
        variant: "destructive",
      });
      return;
    }
    if (finalDestination === medication.location) {
      toast({
        title: "Error",
        description: "Destination location cannot be the same as current location",
        variant: "destructive",
      });
      return;
    }
    moveMutation.mutate({
      medicationId: medication.id,
      quantity: qtyNumber,
      destinationLocation: finalDestination,
    });
  };

  const incrementQuantity = () => {
    if (!medication) return;
    const current =
      moveQuantity === ""
        ? 0
        : typeof moveQuantity === "number"
        ? moveQuantity
        : parseInt(moveQuantity, 10);
    if (current < medication.quantity) setMoveQuantity(current + 1);
  };

  const decrementQuantity = () => {
    const current =
      moveQuantity === ""
        ? 0
        : typeof moveQuantity === "number"
        ? moveQuantity
        : parseInt(moveQuantity, 10);
    if (current > 1) setMoveQuantity(current - 1);
  };

  const capitalizeWords = (str: string) => str.replace(/\b\w/g, (c) => c.toUpperCase());

  if (!medication) return null;

  const qtyNumber =
    typeof moveQuantity === "number" ? moveQuantity : moveQuantity ? parseInt(moveQuantity, 10) : 0;
  const decrementDisabled = qtyNumber <= 1;
  const incrementDisabled = qtyNumber >= medication.quantity;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ArrowRightLeft className="h-5 w-5 text-emerald-600" />
            Move Medication
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="text-sm space-y-1">
            <div className="font-medium text-emerald-600">
              {medication.medicalName} ({medication.genericName})
            </div>
            <div className="text-muted-foreground">Available: {medication.quantity}</div>
            <div className="text-muted-foreground">Current Location: {medication.location}</div>
            <div className="text-muted-foreground">Dose: {medication.dose}</div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="move-quantity" className="text-sm font-medium">
              Quantity to Dispense
            </Label>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={decrementQuantity} disabled={decrementDisabled}>
                <Minus className="h-4 w-4 text-emerald-600" />
              </Button>
              <Input
                id="move-quantity"
                type="number"
                min="1"
                max={medication.quantity}
                value={moveQuantity}
                onChange={(e) => {
                  const raw = e.target.value;
                  if (raw === "") return setMoveQuantity("");
                  const parsed = parseInt(raw, 10);
                  if (isNaN(parsed)) return setMoveQuantity("");
                  setMoveQuantity(Math.max(1, Math.min(parsed, medication.quantity)));
                }}
                className="w-20 text-center"
              />
              <Button variant="outline" size="sm" onClick={incrementQuantity} disabled={incrementDisabled}>
                <Plus className="h-4 w-4 text-emerald-600" />
              </Button>
            </div>
          </div>
          {existingLocations.length > 0 && (
            <div className="space-y-2">
              <Label className="text-sm font-medium">Select Existing Location</Label>
              <Select
                value={selectedExistingLocation}
                onValueChange={(value) => {
                  setSelectedExistingLocation(value);
                  setDestinationLocation("");
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Choose existing location" />
                </SelectTrigger>
                <SelectContent>
                  {existingLocations.map((location) => (
                    <SelectItem key={location} value={location}>
                      {location}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="destination-location" className="text-sm font-medium">
              {existingLocations.length > 0 ? "Or Enter New Location" : "Destination Location"}
            </Label>
            <Input
              id="destination-location"
              placeholder="Enter new location"
              value={destinationLocation}
              onChange={(e) => {
                const val = capitalizeWords(e.target.value);
                setDestinationLocation(val);
                if (val.trim()) setSelectedExistingLocation("");
              }}
            />
          </div>
          <div className="flex gap-3 pt-4">
            <Button
              onClick={handleMove}
              disabled={moveMutation.isPending}
              className="flex-1 bg-green-600 hover:bg-green-700"
            >
              <Check className="h-4 w-4 mr-2" />
              Confirm Move
            </Button>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
