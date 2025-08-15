import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { type Medication } from "@shared/schema";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Package, MapPin } from "lucide-react";

interface MoveModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  medication: Medication | null;
}

const locationOptions = [
  "Pharmacy Storage A", "Pharmacy Storage B", "Refrigerator Unit 1", "Refrigerator Unit 2",
  "Emergency Stock", "Ward 1 Supply", "Ward 2 Supply", "ICU Supply", "Outpatient Clinic", "Main Storage"
];

export function MoveModal({ open, onOpenChange, medication }: MoveModalProps) {
  const [newLocation, setNewLocation] = useState("");
  const [customLocation, setCustomLocation] = useState("");
  const [comment, setComment] = useState("");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const moveMutation = useMutation({
    mutationFn: async (data: { medicationId: string; newLocation: string; comment?: string }) => {
      const response = await apiRequest("POST", "/api/medications/move", data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/medications"] });
      queryClient.invalidateQueries({ queryKey: ["/api/transactions"] });
      toast({
        title: "Success",
        description: `Successfully moved medication to ${newLocation || customLocation}`,
        duration: 3000,
      });
      setNewLocation("");
      setCustomLocation("");
      setComment("");
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
    
    const finalLocation = newLocation === "custom" ? customLocation : newLocation;
    
    if (!finalLocation.trim()) {
      toast({
        title: "Error",
        description: "Please select or enter a location",
        variant: "destructive",
      });
      return;
    }

    if (finalLocation === medication.location) {
      toast({
        title: "Error", 
        description: "New location cannot be the same as current location",
        variant: "destructive",
      });
      return;
    }

    moveMutation.mutate({
      medicationId: medication.id,
      newLocation: finalLocation,
      comment: comment.trim() || undefined,
    });
  };

  if (!medication) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MapPin className="h-5 w-5" />
            Move Medication
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <h4 className="font-medium">
              {medication.genericName} ({medication.medicalName})
            </h4>
            <p className="text-sm text-muted-foreground">
              Current location: {medication.location}
            </p>
          </div>

          <div>
            <Label htmlFor="new-location">New Location *</Label>
            <Select value={newLocation} onValueChange={setNewLocation}>
              <SelectTrigger id="new-location">
                <SelectValue placeholder="Select a location" />
              </SelectTrigger>
              <SelectContent>
                {locationOptions.map((location) => (
                  <SelectItem key={location} value={location}>
                    {location}
                  </SelectItem>
                ))}
                <SelectItem value="custom">Custom location...</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {newLocation === "custom" && (
            <div>
              <Label htmlFor="custom-location">Custom Location *</Label>
              <Input
                id="custom-location"
                value={customLocation}
                onChange={(e) => setCustomLocation(e.target.value)}
                placeholder="Enter custom location"
              />
            </div>
          )}

          <div>
            <Label htmlFor="comment">Comment (Optional)</Label>
            <Textarea
              id="comment"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Add a note about this move (optional)"
              rows={2}
            />
          </div>

          <div className="flex justify-end space-x-2">
            <Button 
              variant="outline" 
              onClick={() => onOpenChange(false)}
              disabled={moveMutation.isPending}
            >
              Cancel
            </Button>
            <Button 
              onClick={handleMove}
              disabled={moveMutation.isPending}
            >
              <Package className="h-4 w-4 mr-2" />
              {moveMutation.isPending ? "Moving..." : "Move"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
