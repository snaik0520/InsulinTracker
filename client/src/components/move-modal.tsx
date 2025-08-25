import { useState, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  // mirror Dispense modal state names
  const [dispenseQuantity, setDispenseQuantity] = useState("");
  const [destinationLocation, setDestinationLocation] = useState("");
  const [selectedExistingLocation, setSelectedExistingLocation] = useState("");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch all medications to list existing locations
  const { data: allMedications = [] } = useQuery({
    queryKey: ["/api/medications"],
    enabled: open,
  });

  // derive unique locations except current
  const existingLocations = useMemo(() => {
    const locations = new Set<string>();
    allMedications.forEach((med) => {
      if (med.location?.trim() && med.location !== medication?.location) {
        locations.add(med.location.trim());
      }
    });
    return Array.from(locations);
  }, [allMedications, medication?.location]);

  // mutation for move => reuse `/api/medications/move`
  const moveMutation = useMutation({
    mutationFn: async (data: { medicationId: string; quantity: number; destinationLocation: string }) => {
      const response = await apiRequest("POST", "/api/medications/move", data);
      return response.json();
    },
    onSuccess: () => {
      // invalidate same keys as dispense
      queryClient.invalidateQueries({ queryKey: ["/api/medications"] });
      queryClient.invalidateQueries({ queryKey: ["/api/medications/low-stock"] });
      queryClient.invalidateQueries({ queryKey: ["/api/transactions"] });
      toast({
        title: "Success",
        description: `Successfully moved medication`,
        duration: 3000,
      });
      // reset fields
      setDispenseQuantity("");
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
    const qty = parseInt(dispenseQuantity as any, 10);
    if (!dispenseQuantity || isNaN(qty) || qty < 1) {
      toast({ title: "Error", description: "Please enter a quantity of at least 1", variant: "destructive" });
      return;
    }
    if (qty > medication.quantity) {
      toast({ title: "Error", description: "Cannot move more than available stock", variant: "destructive" });
      return;
    }
    const finalDestination = destinationLocation.trim() || selectedExistingLocation;
    if (!finalDestination) {
      toast({ title: "Error", description: "Please select or enter a destination location", variant: "destructive" });
      return;
    }
    if (finalDestination === medication.location) {
      toast({ title: "Error", description: "Destination cannot be same as current", variant: "destructive" });
      return;
    }
    moveMutation.mutate({
      medicationId: medication.id,
      quantity: qty,
      destinationLocation: finalDestination,
    });
  };

  if (!medication) return null;

  // for enable/disable
  const qtyNumber = dispenseQuantity === "" ? 0 : parseInt(dispenseQuantity as any, 10);
  const decrementDisabled = qtyNumber <= 1;
  const incrementDisabled = qtyNumber >= medication.quantity;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Dispense Medication</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label className="block text-sm font-medium text-gray-700">
              {medication.medicalName} ({medication.genericName})
            </Label>
            <p className="text-sm text-gray-500">Available: {medication.quantity}</p>
            <p className="text-sm text-gray-500">Dose: {medication.dose}</p>
          </div>

          <div>
            <Label htmlFor="quantity" className="block text-sm font-medium text-gray-700">
              Quantity to Dispense
            </Label>
            <div className="mt-1 flex items-center space-x-2">
              <Button size="xs" onClick={() => !decrementDisabled && setDispenseQuantity((qtyNumber - 1).toString())} disabled={decrementDisabled}>
                <Minus className="h-4 w-4" />
              </Button>
              <Input
                id="quantity"
                type="text"
                value={dispenseQuantity}
                onChange={(e) => {
                  const raw = e.target.value;
                  if (raw === "") return setDispenseQuantity("");
                  const parsed = parseInt(raw, 10);
                  if (isNaN(parsed)) return setDispenseQuantity("");
                  setDispenseQuantity(Math.max(1, Math.min(parsed, medication.quantity)).toString());
                }}
                className="w-16 text-center"
                data-testid="input-dispense-quantity"
              />
              <Button size="xs" onClick={() => !incrementDisabled && setDispenseQuantity((qtyNumber + 1).toString())} disabled={incrementDisabled}>
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {existingLocations.length > 0 && (
            <div>
              <Label className="block text-sm font-medium text-gray-700">Select Existing Location</Label>
              <select
                className="mt-1 block w-full border-gray-300 rounded-md"
                value={selectedExistingLocation}
                onChange={(e) => {
                  setSelectedExistingLocation(e.target.value);
                  setDestinationLocation("");
                }}
              >
                <option value="">-- Choose a location --</option>
                {existingLocations.map((loc) => (
                  <option key={loc} value={loc}>
                    {loc}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div>
            <Label className="block text-sm font-medium text-gray-700">
              {existingLocations.length > 0 ? "Or Enter New Location" : "Destination Location"}
            </Label>
            <Input
              type="text"
              placeholder="Enter destination location"
              value={destinationLocation}
              onChange={(e) => {
                setDestinationLocation(e.target.value);
                if (e.target.value.trim()) setSelectedExistingLocation("");
              }}
            />
          </div>

          <div className="flex justify-end space-x-2 pt-4">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button className="bg-emerald-600 hover:bg-emerald-700 text-white" onClick={handleMove}>
              <Check className="h-4 w-4 mr-1" />
              Dispense
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
