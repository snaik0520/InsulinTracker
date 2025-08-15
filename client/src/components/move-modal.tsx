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
import { MoveIcon, MapPin, MessageSquare } from "lucide-react";

interface MoveModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  medication: Medication | null;
}

// Common clinic locations - you can modify this list based on your clinic's needs
const LOCATION_OPTIONS = [
  "Pharmacy",
  "Refrigerator A",
  "Refrigerator B", 
  "Storage Room 1",
  "Storage Room 2",
  "Emergency Kit",
  "Front Desk",
  "Nurse Station",
  "Doctor's Office",
  "Supply Closet",
];

export function MoveModal({ open, onOpenChange, medication }: MoveModalProps) {
  const [newLocation, setNewLocation] = useState("");
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
        description: `Successfully moved medication to ${newLocation}`,
        duration: 3000,
      });
      setNewLocation("");
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
    if (!medication || !newLocation) return;

    if (newLocation === medication.location) {
      toast({
        title: "Error",
        description: "Please select a different location",
        variant: "destructive",
      });
      return;
    }

    moveMutation.mutate({
      medicationId: medication.id,
      newLocation,
      comment: comment.trim() || undefined,
    });
  };

  const handleClose = () => {
    setNewLocation("");
    setComment("");
    onOpenChange(false);
  };

  if (!medication) return null;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-blue-700">
            <MoveIcon className="h-5 w-5" />
            Move Medication
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Medication Info */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h4 className="font-medium text-blue-900 mb-2">
              {medication.medicalName} ({medication.genericName})
            </h4>
            <div className="text-sm text-blue-700 space-y-1">
              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4" />
                Current Location: <span className="font-medium">{medication.location}</span>
              </div>
              <div>Available: {medication.quantity} units</div>
              <div>Dose: {medication.dose}</div>
            </div>
          </div>

          {/* New Location Selection */}
          <div className="space-y-2">
            <Label htmlFor="location" className="text-sm font-medium text-gray-700">
              New Location <span className="text-red-500">*</span>
            </Label>
            <Select value={newLocation} onValueChange={setNewLocation}>
              <SelectTrigger className="border-gray-300 focus:border-blue-500 focus:ring-blue-500">
                <SelectValue placeholder="Select new location" />
              </SelectTrigger>
              <SelectContent>
                {LOCATION_OPTIONS.filter(location => location !== medication.location).map((location) => (
                  <SelectItem key={location} value={location}>
                    {location}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Optional Comment */}
          <div className="space-y-2">
            <Label htmlFor="comment" className="text-sm font-medium text-gray-700 flex items-center gap-2">
              <MessageSquare className="h-4 w-4" />
              Comment <span className="text-gray-400">(optional)</span>
            </Label>
            <Textarea
              id="comment"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Add a note about this move (e.g., reason, special instructions)"
              className="resize-none border-gray-300 focus:border-blue-500 focus:ring-blue-500"
              rows={3}
              maxLength={200}
            />
            <div className="text-xs text-gray-500 text-right">
              {comment.length}/200 characters
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button 
              variant="outline" 
              onClick={handleClose}
              className="border-gray-300 text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </Button>
            <Button
              onClick={handleMove}
              disabled={!newLocation || moveMutation.isPending}
              className="bg-blue-600 hover:bg-blue-700 text-white shadow-sm"
            >
              {moveMutation.isPending ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Moving...
                </>
              ) : (
                <>
                  <MoveIcon className="h-4 w-4 mr-2" />
                  Move Medication
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
