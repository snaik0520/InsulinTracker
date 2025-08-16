import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { AddMedicationModal } from "@/components/add-medication-modal";
import { DispenseModal } from "@/components/dispense-modal";
import { LowStockTicker } from "@/components/low-stock-ticker";
import { OutOfStockTracker } from "@/components/out-of-stock-tracker";
import { TransactionHistory } from "@/components/transaction-history";
import { type Medication } from "@shared/schema";
import {
  Search,
  Plus,
  HandHeart,
  Syringe,
  Zap,
  Clock,
  Scale,
  HelpCircle,
  List,
  CornerRightDown,
} from "lucide-react";
import logo from "../assets/noor-logo.png";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Check, Minus, Plus as PlusIcon } from "lucide-react";

/**
 * Simulated API call (replace with real API)
 */
const apiRequest = async (method: string, url: string, data: any) => {
  console.log(`Simulating API call: ${method} to ${url} with data:`, data);
  return {
    json: () => Promise.resolve({ success: true }),
  };
};

/**
 * MoveModal - move a quantity of a medication to a saved or new location.
 * - Shows current count and admin label (pens/injections).
 * - Pre-saved locations are derived from existing medication.location fields.
 * - On success it updates the /api/medications cache so the inventory list reflects changes immediately.
 */
interface MoveModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  medication: Medication | null;
}
export function MoveModal({ open, onOpenChange, medication }: MoveModalProps) {
  const [moveQuantity, setMoveQuantity] = useState(1);
  const [newLocation, setNewLocation] = useState("");
  const [selectedLocation, setSelectedLocation] = useState("");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // derive pre-saved locations from current medications in cache / query
  const { data: allMeds = [] } = useQuery<Medication[]>({
    queryKey: ["/api/medications"],
  });

  const predefinedLocations = useMemo(() => {
    const set = new Set<string>();
    (allMeds || []).forEach((m) => {
      const loc = (m.location || "").trim();
      if (loc) set.add(loc);
    });
    return Array.from(set);
  }, [allMeds]);

  const moveMutation = useMutation({
    mutationFn: async (data: { medicationId: string; quantity: number; newLocation: string }) => {
      const response = await apiRequest("POST", "/api/medications/move", data);
      return response.json();
    },
    onSuccess: () => {
      // --- optimistic UI update: update the /api/medications cache to reflect movement ---
      queryClient.setQueryData<Medication[] | undefined>(["/api/medications"], (old) => {
        if (!old || !medication) return old;

        const destLocation = selectedLocation || newLocation;
        const qty = moveQuantity;

        // subtract from source medication
        const updated = old.map((m) =>
          m.id === medication.id ? { ...m, quantity: (m.quantity ?? 0) - qty } : { ...m }
        );

        // try to find an existing record for the same medication at the destination
        const existingIndex = updated.findIndex(
          (m) =>
            (m.medicalName || "").trim() === (medication.medicalName || "").trim() &&
            ((m.location || "").trim() === destLocation.trim())
        );

        if (existingIndex >= 0) {
          // increment existing destination record
          const dest = { ...updated[existingIndex] };
          dest.quantity = (dest.quantity ?? 0) + qty;
          updated[existingIndex] = dest;
        } else {
          // create a new record representing the moved quantity at the destination
          const newRecord: Medication = {
            ...medication,
            id: `${medication.id}-moved-${Date.now()}`, // temporary unique id for UI
            quantity: qty,
            location: destLocation,
            // keep other fields same (you may want to adjust expiration/dose/etc in real backend logic)
          };
          updated.push(newRecord);
        }

        // filter out any meds with quantity <= 0? We'll keep zero-quantity rows for now,
        // but you can remove them if you prefer:
        // return updated.filter(m => (m.quantity ?? 0) > 0);
        return updated;
      });

      queryClient.invalidateQueries({ queryKey: ["/api/transactions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/medications/low-stock"] });

      const unit =
        (medication?.administrationForm?.toLowerCase() === "pen" ||
          medication?.administrationForm?.toLowerCase() === "pens")
          ? (moveQuantity === 1 ? "pen" : "pens")
          : (moveQuantity === 1 ? "injection" : "injections");

      toast({
        title: "Success",
        description: `Successfully moved ${moveQuantity} ${unit} to ${selectedLocation || newLocation}`,
        duration: 3000,
      });

      setMoveQuantity(1);
      setNewLocation("");
      setSelectedLocation("");
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
    if (moveQuantity > (medication.quantity ?? 0)) {
      toast({
        title: "Error",
        description: "Cannot move more than available stock",
        variant: "destructive",
      });
      return;
    }
    if (!selectedLocation && !newLocation) {
      toast({
        title: "Error",
        description: "Please select a location or enter a new one",
        variant: "destructive",
      });
      return;
    }
    moveMutation.mutate({
      medicationId: medication.id,
      quantity: moveQuantity,
      newLocation: selectedLocation || newLocation,
    });
  };

  const incrementQuantity = () => {
    if (medication && moveQuantity < (medication.quantity ?? 0)) {
      setMoveQuantity(moveQuantity + 1);
    }
  };
  const decrementQuantity = () => {
    if (moveQuantity > 1) {
      setMoveQuantity(moveQuantity - 1);
    }
  };

  if (!medication) return null;

  const isPenForm =
    (medication.administrationForm || medication.administrativeForm || medication.formType || "")
      .toString()
      .toLowerCase()
      .includes("pen");

  const adminUnitCurrent = (medication.quantity ?? 0) === 1 ? (isPenForm ? "pen" : "injection") : (isPenForm ? "pens" : "injections");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md" data-testid="modal-move-medication">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CornerRightDown className="h-5 w-5 text-indigo-600" />
            Move Medication
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <p className="text-sm text-gray-900" data-testid="text-medication-name">
              {medication.medicalName} ({medication.genericName})
            </p>
            <p className="text-xs text-gray-500 mt-1" data-testid="text-available-stock">
              Current Location: {medication.location ?? "—"}
            </p>
            <p className="text-xs text-gray-500 mt-1" data-testid="text-current-count">
              Current Count: {medication.quantity ?? 0} {adminUnitCurrent}
            </p>
          </div>

          <div>
            <Label htmlFor="moveQuantity">Quantity to Move</Label>
            <div className="flex items-center space-x-2 mt-1">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={decrementQuantity}
                disabled={moveQuantity <= 1}
                data-testid="button-decrement"
              >
                <Minus className="h-4 w-4" />
              </Button>
              <Input
                id="moveQuantity"
                type="number"
                min="1"
                max={medication.quantity}
                value={moveQuantity}
                onChange={(e) => setMoveQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                className="w-20 text-center"
                data-testid="input-move-quantity"
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={incrementQuantity}
                disabled={moveQuantity >= (medication.quantity ?? 0)}
                data-testid="button-increment"
              >
                <PlusIcon className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div>
            <Label htmlFor="location-select">Select a Destination</Label>
            <Select onValueChange={setSelectedLocation} value={selectedLocation}>
              <SelectTrigger id="location-select" className="mt-1">
                <SelectValue placeholder="Select a pre-saved location" />
              </SelectTrigger>
              <SelectContent>
                {predefinedLocations.length === 0 ? (
                  <SelectItem value="">
                    No saved locations — enter a new one below
                  </SelectItem>
                ) : (
                  predefinedLocations.map((loc, index) => <SelectItem key={index} value={loc}>{loc}</SelectItem>)
                )}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center space-x-2">
            <div className="flex-grow border-t border-gray-200"></div>
            <span className="flex-shrink text-xs text-gray-500">OR</span>
            <div className="flex-grow border-t border-gray-200"></div>
          </div>

          <div>
            <Label htmlFor="new-location-input">Enter a New Location</Label>
            <Input
              id="new-location-input"
              className="mt-1"
              placeholder="e.g., Shelf 3, Cabinet B"
              value={newLocation}
              onChange={(e) => {
                setNewLocation(e.target.value);
                setSelectedLocation("");
              }}
              disabled={!!selectedLocation}
            />
          </div>
        </div>

        <DialogFooter className="flex flex-col gap-3 pt-4 sm:flex-row sm:justify-end">
          <Button
            onClick={handleMove}
            className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white sm:flex-none"
            disabled={moveMutation.isPending}
            data-testid="button-confirm-move"
          >
            {moveMutation.isPending ? (
              "Moving..."
            ) : (
              <>
                <Check className="h-4 w-4 mr-2" />
                Confirm Move
              </>
            )}
          </Button>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            data-testid="button-cancel-move"
            className="sm:flex-none"
          >
            Cancel
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------- Inventory component and helpers (updated) ----------
const typeIcons = {
  rapid: Zap,
  long: Clock,
  intermediate: Scale,
  other: HelpCircle,
} as const;

/**
 * Muted pastel palette:
 * - rapid  -> rose / pink pastel
 * - long   -> violet pastel
 * - inter -> emerald pastel
 * - other  -> amber pastel
 */
const badgeColors = {
  rapid: "bg-rose-100 text-rose-800",
  long: "bg-violet-100 text-violet-800",
  intermediate: "bg-emerald-100 text-emerald-800",
  other: "bg-amber-100 text-amber-800",
} as const;

const rowBgClasses = {
  rapid: "bg-rose-50",
  long: "bg-violet-50",
  intermediate: "bg-emerald-50",
  other: "bg-amber-50",
} as const;

const filterSelectedClasses = {
  rapid: "bg-rose-100 text-rose-800 border-rose-200",
  long: "bg-violet-100 text-violet-800 border-violet-200",
  intermediate: "bg-emerald-100 text-emerald-800 border-emerald-200",
  other: "bg-amber-100 text-amber-800 border-amber-200",
} as const;

const filterHoverClasses = {
  rapid: "hover:bg-rose-50 hover:text-rose-700",
  long: "hover:bg-violet-50 hover:text-violet-700",
  intermediate: "hover:bg-emerald-50 hover:text-emerald-700",
  other: "hover:bg-amber-50 hover:text-amber-700",
} as const;

const typeLabels = {
  rapid: "Rapid Acting",
  long: "Long Acting",
  intermediate: "Intermediate",
  other: "Other",
} as const;

const getRowClassName = (type: string) => {
  switch (type) {
    case "rapid":
      return rowBgClasses.rapid;
    case "long":
      return rowBgClasses.long;
    case "intermediate":
      return rowBgClasses.intermediate;
    case "other":
      return rowBgClasses.other;
    default:
      return "";
  }
};

const calculateDaysUntilExpiration = (expirationDate: string) => {
  const today = new Date();
  const expiry = new Date(expirationDate);
  const diffTime = expiry.getTime() - today.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays;
};

const getExpirationClassName = (days: number) => {
  if (days < 30) return "text-red-600";
  if (days < 90) return "text-orange-600";
  return "text-green-600";
};

export default function Inventory() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedType, setSelectedType] = useState("all");
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isDispenseModalOpen, setIsDispenseModalOpen] = useState(false);
  const [isMoveModalOpen, setIsMoveModalOpen] = useState(false); // New state for Move modal
  const [selectedMedication, setSelectedMedication] = useState<Medication | null>(null);

  const { data: medications = [], isLoading } = useQuery<Medication[]>({
    queryKey: ["/api/medications"],
  });

  const filteredMedications = useMemo(() => {
    let filtered = medications;
    filtered = filtered.filter((medication) => (medication.quantity ?? 0) > 0);
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (med) =>
          (med.genericName ?? "").toLowerCase().includes(query) ||
          (med.medicalName ?? "").toLowerCase().includes(query)
      );
    }
    if (selectedType !== "all") {
      filtered = filtered.filter((med) => med.type === selectedType);
    }
    return filtered;
  }, [medications, searchQuery, selectedType]);

  const handleDispense = (medication: Medication) => {
    setSelectedMedication(medication);
    setIsDispenseModalOpen(true);
  };

  // New handler for the Move button
  const handleMove = (medication: Medication) => {
    setSelectedMedication(medication);
    setIsMoveModalOpen(true);
  };

  // Scroll target: LowStockTicker element
  const scrollToTrackers = () => {
    if (typeof document !== "undefined") {
      const el = document.getElementById("low-stock-ticker");
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "start" });
        return;
      }
      window.scrollTo({ top: document.documentElement.scrollHeight, behavior: "smooth" });
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-rose-400 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading medications…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gray-50 min-h-screen">
      <header className="bg-gradient-to-r from-rose-50 via-white to-emerald-50 shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <Syringe className="h-6 w-6 text-rose-600 mr-3" />
              <h1 className="text-xl font-semibold text-rose-700">Insulin Inventory</h1>
            </div>
            <div className="flex items-center space-x-4">
              <span className="text-lg text-gray-600 font-medium tracking-wide">SLO Noor Foundation</span>
              <img src={logo} alt="SLO Noor Foundation logo" className="h-14 w-auto object-contain" data-testid="logo" />
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Card className="mb-8">
          <CardContent className="p-6">
            <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between space-y-4 lg:space-y-0 lg:space-x-4">
              <div className="flex-1 max-w-lg">
                <Label htmlFor="medication-search" className="block text-sm font-medium text-gray-700 mb-2">
                  Search medications
                </Label>
                <div className="relative">
                  <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                  <Input
                    id="medication-search"
                    placeholder="Search by generic or medical name"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                    data-testid="input-search-medication"
                  />
                </div>
              </div>

              <div className="flex gap-3 flex-shrink-0">
                <Button
                  onClick={scrollToTrackers}
                  size="sm"
                  variant="outline"
