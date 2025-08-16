import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
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
  Plus as PlusIcon,
  HandHeart,
  Syringe,
  Zap,
  Clock,
  Scale,
  HelpCircle,
  List,
  CornerRightDown,
  Check,
  Minus,
} from "lucide-react";
import logo from "../assets/noor-logo.png";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";

/**
 * Replace this stub with your real API function.
 */
const apiRequest = async (method: string, url: string, data: any) => {
  console.log(`[API] ${method} ${url}`, data);
  return {
    json: async () => ({ success: true }),
  };
};

/* -------------------- MoveModal -------------------- */
/**
 * MoveModal notes:
 * - moveQuantity starts as empty string so user can type without deleting '1'.
 * - Requires at least 1; clamps at max stock.
 * - When moving we create a brand-new independent record with a new unique id
 *   (no object identity/link to source). Source quantity is decremented.
 */
interface MoveModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  medication: Medication | null;
}
export function MoveModal({ open, onOpenChange, medication }: MoveModalProps) {
  // allow empty initial state so the input is blank; otherwise a number
  const [moveQuantity, setMoveQuantity] = useState<number | "">("");
  const [newLocation, setNewLocation] = useState("");
  const [selectedLocation, setSelectedLocation] = useState("");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // derive list of previously used locations from the meds cache
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
    mutationFn: async (payload: { medicationId: string; quantity: number; newLocation: string }) => {
      const res = await apiRequest("POST", "/api/medications/move", payload);
      return res.json();
    },
    onSuccess: () => {
      // Update cache: subtract from source (by id) and create an entirely new record for destination.
      queryClient.setQueryData<Medication[] | undefined>(["/api/medications"], (old) => {
        if (!old || !medication) return old;

        const destLocation = (selectedLocation || newLocation).trim();
        const qty = typeof moveQuantity === "number" ? moveQuantity : 0;

        // 1) subtract from source by id
        const updated = old.map((m) => (m.id === medication.id ? { ...m, quantity: Math.max(0, (m.quantity ?? 0) - qty) } : { ...m }));

        // 2) try to find an existing destination record *by exact location and exact id match is NOT used*:
        //    We prefer to keep destination separate, but if there is an exact match (same medicalName + location + dose)
        //    we increment that entry — otherwise create a brand new independent record.
        const findDestIndex = updated.findIndex(
          (m) =>
            (m.medicalName || "").trim().toLowerCase() === (medication.medicalName || "").trim().toLowerCase() &&
            ((m.location || "").trim().toLowerCase() === destLocation.toLowerCase()) &&
            (m.dose || "") === (medication.dose || "")
        );

        if (findDestIndex >= 0) {
          // increment existing destination record
          const dest = { ...updated[findDestIndex] };
          dest.quantity = (dest.quantity ?? 0) + qty;
          updated[findDestIndex] = dest;
        } else {
          // create a fully independent record (new unique id; no retained references to source)
          const destRecord: Medication = {
            ...medication,
            id: `${medication.id}-moved-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
            quantity: qty,
            location: destLocation,
            // remove any server-side linking fields if present:
            // @ts-ignore - ensure we don't copy an existing backend link field
            originalId: undefined,
            // you can also mark it as its own batch if you have that concept:
            // @ts-ignore
            batchId: `moved-${Date.now()}`,
            // Keep other descriptive fields (medicalName, genericName, dose, expirationDate, etc.)
          };
          updated.push(destRecord);
        }

        return updated;
      });

      queryClient.invalidateQueries({ queryKey: ["/api/transactions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/medications/low-stock"] });

      const adminNormalized = (
        medication?.administrationForm ||
        (medication as any)?.administrativeForm ||
        (medication as any)?.formType ||
        ""
      )
        .toString()
        .toLowerCase();
      const isPen = adminNormalized.includes("pen");
      const qtyNum = typeof moveQuantity === "number" ? moveQuantity : 0;
      const unit = qtyNum === 1 ? (isPen ? "pen" : "injection") : isPen ? "pens" : "injections";

      toast({
        title: "Success",
        description: `Successfully moved ${qtyNum} ${unit} to ${selectedLocation || newLocation}`,
        duration: 3000,
      });

      // reset modal state
      setMoveQuantity("");
      setNewLocation("");
      setSelectedLocation("");
      onOpenChange(false);
    },
    onError: (err: Error) => {
      toast({
        title: "Error",
        description: err.message,
        variant: "destructive",
      });
    },
  });

  const handleMove = () => {
    if (!medication) return;

    if (moveQuantity === "" || typeof moveQuantity !== "number" || moveQuantity < 1) {
      toast({
        title: "Error",
        description: "Please enter a quantity of at least 1",
        variant: "destructive",
      });
      return;
    }

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
    if (!medication) return;
    if (moveQuantity === "") {
      setMoveQuantity(1);
      return;
    }
    if (typeof moveQuantity === "number" && moveQuantity < (medication.quantity ?? 0)) {
      setMoveQuantity((q) => (typeof q === "number" ? q + 1 : 1));
    }
  };

  const decrementQuantity = () => {
    if (moveQuantity === "" || typeof moveQuantity !== "number") return;
    if (moveQuantity > 1) setMoveQuantity((q) => (typeof q === "number" ? q - 1 : q));
  };

  if (!medication) return null;

  const adminFormNormalized = (
    medication.administrationForm ||
    (medication as any).administrativeForm ||
    (medication as any).formType ||
    ""
  ).toString();
  const isPenForm = adminFormNormalized.toLowerCase().includes("pen");
  const adminUnitCurrent =
    (medication.quantity ?? 0) === 1 ? (isPenForm ? "pen" : "injection") : isPenForm ? "pens" : "injections";

  const qtyNumber = typeof moveQuantity === "number" ? moveQuantity : 0;
  const decrementDisabled = qtyNumber <= 1;
  const incrementDisabled = qtyNumber >= (medication.quantity ?? 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md" data-testid="modal-move-medication">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CornerRightDown className="h-5 w-5 text-blue-600" />
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
                disabled={decrementDisabled}
                data-testid="button-decrement"
              >
                <Minus className="h-4 w-4" />
              </Button>

              <Input
                id="moveQuantity"
                type="number"
                min={1}
                max={medication.quantity}
                className="w-24 text-center"
                data-testid="input-move-quantity"
                value={moveQuantity === "" ? "" : moveQuantity}
                onChange={(e) => {
                  const raw = e.target.value;
                  if (raw === "") {
                    setMoveQuantity("");
                    return;
                  }
                  const parsed = parseInt(raw, 10);
                  if (isNaN(parsed)) {
                    setMoveQuantity("");
                    return;
                  }
                  const clamped = Math.max(1, Math.min(parsed, medication.quantity ?? parsed));
                  setMoveQuantity(clamped);
                }}
              />

              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={incrementQuantity}
                disabled={incrementDisabled}
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
                  <SelectItem value="">No saved locations — enter a new one below</SelectItem>
                ) : (
                  predefinedLocations.map((loc, idx) => (
                    <SelectItem key={idx} value={loc}>
                      {loc}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center space-x-2">
            <div className="flex-grow border-t border-gray-200" />
            <span className="flex-shrink text-xs text-gray-500">OR</span>
            <div className="flex-grow border-t border-gray-200" />
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
            className="flex-1 bg-blue-600 hover:bg-blue-700 text-white sm:flex-none"
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

          <Button variant="outline" onClick={() => onOpenChange(false)} data-testid="button-cancel-move" className="sm:flex-none">
            Cancel
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* -------------------- Inventory (rest of file) -------------------- */

const typeIcons = {
  rapid: Zap,
  long: Clock,
  intermediate: Scale,
  other: HelpCircle,
} as const;

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
  other: "bg-amber-100 text-amber-100 border-amber-200",
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

const calculateDaysUntilExpiration = (expirationDate?: string) => {
  if (!expirationDate) return Infinity;
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
  const [isMoveModalOpen, setIsMoveModalOpen] = useState(false);
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

  const handleMove = (medication: Medication) => {
    setSelectedMedication(medication);
    setIsMoveModalOpen(true);
  };

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
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-rose-400 mx-auto mb-4" />
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
                <Button onClick={scrollToTrackers} size="sm" variant="outline" className="flex items-center border-rose-200 text-rose-700 hover:bg-rose-50" data-testid="button-jump-low-outstock" title="Jump to low / out of stock trackers">
                  <List className="h-4 w-4 mr-2" />
                  Low / Out of Stock
                </Button>

                <TransactionHistory />

                <Button onClick={() => setIsAddModalOpen(true)} className="bg-rose-600 hover:bg-rose-700 text-white" data-testid="button-add-medication">
                  <PlusIcon className="h-4 w-4 mr-2" />
                  Add Medication
                </Button>
              </div>
            </div>

            <div className="mt-6">
              <Label className="block text-sm font-medium text-gray-700 mb-3">Filter by insulin type</Label>
              <div className="flex flex-wrap gap-2">
                <Button variant={selectedType === "all" ? "default" : "outline"} onClick={() => setSelectedType("all")} className={`text-sm ${selectedType === "all" ? "bg-white text-gray-700" : "text-gray-700"}`} data-testid="filter-all">
                  <List className="h-4 w-4 mr-2" /> All types
                </Button>

                {Object.entries(typeLabels).map(([type, label]) => {
                  const Icon = typeIcons[type as keyof typeof typeIcons];
                  const selectedCls = (filterSelectedClasses as any)[type];
                  const hoverCls = (filterHoverClasses as any)[type];
                  return (
                    <Button
                      key={type}
                      variant={selectedType === type ? "default" : "outline"}
                      onClick={() => setSelectedType(type)}
                      className={`text-sm ${selectedType === type ? selectedCls : "border-gray-200 " + hoverCls}`}
                      data-testid={`filter-${type}`}
                    >
                      <Icon className="h-4 w-4 mr-2" />
                      {label}
                    </Button>
                  );
                })}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg font-medium text-gray-900">Current insulin inventory</CardTitle>
            <p className="text-sm text-gray-600">Manage and track all insulin medications in your clinic</p>
          </CardHeader>

          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-sm font-medium text-gray-600">Medication</th>
                    <th className="px-6 py-3 text-left text-sm font-medium text-gray-600">Administrative form</th>
                    <th className="px-6 py-3 text-left text-sm font-medium text-gray-600">Insulin type</th>
                    <th className="px-6 py-3 text-left text-sm font-medium text-gray-600">Dose</th>
                    <th className="px-6 py-3 text-left text-sm font-medium text-gray-600">Quantity</th>
                    <th className="px-6 py-3 text-left text-sm font-medium text-gray-600">Expiration</th>
                    <th className="px-6 py-3 text-left text-sm font-medium text-gray-600">Location</th>
                    <th className="px-6 py-3 text-left text-sm font-medium text-gray-600">Actions</th>
                  </tr>
                </thead>

                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredMedications.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-6 py-12 text-center text-gray-500">
                        {searchQuery || selectedType !== "all" ? "No medications found matching your criteria." : "No medications in inventory. Add your first medication to get started."}
                      </td>
                    </tr>
                  ) : (
                    filteredMedications.map((medication) => {
                      const daysUntilExpiration = calculateDaysUntilExpiration(medication.expirationDate);
                      const Icon = typeIcons[medication.type as keyof typeof typeIcons];

                      // administrative form normalization
                      const adminFormValue = (
                        medication.administrationForm ||
                        (medication as any).administrativeForm ||
                        (medication as any).formType ||
                        ""
                      ).toString();
                      const adminFormLower = adminFormValue.toLowerCase();
                      const adminFormDisplay = adminFormLower.includes("pen") ? "Pen" : adminFormLower.includes("inject") ? "Injection" : "—";

                      const rowTint = getRowClassName(medication.type);
                      const isPen = adminFormLower.includes("pen");
                      const qtyUnit = (medication.quantity ?? 0) === 1 ? (isPen ? "pen" : "injection") : isPen ? "pens" : "injections";

                      return (
                        <tr key={medication.id} className={`${rowTint} hover:bg-gray-50`} data-testid={`row-medication-${medication.id}`}>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div>
                              <div className="text-sm font-medium text-gray-900" data-testid="text-medical-name">{medication.medicalName ?? medication.genericName ?? "—"}</div>
                              <div className="text-sm text-gray-500" data-testid="text-generic-name">{medication.genericName ? `(${medication.genericName})` : ""}</div>
                            </div>
                          </td>

                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900" data-testid="text-administrative-form">{adminFormDisplay}</td>

                          <td className="px-6 py-4 whitespace-nowrap">
                            <Badge className={(badgeColors as any)[medication.type]}>
                              <Icon className="h-3 w-3 mr-1" />
                              {(typeLabels as any)[medication.type]}
                            </Badge>
                          </td>

                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900" data-testid="text-dose">{medication.dose}</td>

                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`text-sm font-medium ${ (medication.quantity ?? 0) <= 5 ? "text-red-600" : "text-gray-900" }`} data-testid="text-quantity">
                              {medication.quantity ?? 0}
                            </span>
                            <div className="text-xs text-gray-500 mt-1">{qtyUnit}</div>
                            {(medication.quantity ?? 0) <= 5 && <div className="text-xs text-red-600">Low stock</div>}
                          </td>

                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className="text-sm text-gray-900" data-testid="text-expiration-date">{medication.expirationDate ? new Date(medication.expirationDate).toLocaleDateString() : "—"}</span>
                          </td>

                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500" data-testid="text-location">{medication.location ?? "—"}</td>

                          <td className="px-6 py-4 whitespace-nowrap space-x-2">
                            <Button onClick={() => handleDispense(medication)} size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white" disabled={(medication.quantity ?? 0) === 0} data-testid={`button-dispense-${medication.id}`}>
                              <HandHeart className="h-4 w-4 mr-1" />
                              Dispense
                            </Button>

                            {/* Move button uses blue filled style now */}
                            <Button onClick={() => handleMove(medication)} size="sm" className="bg-blue-600 hover:bg-blue-700 text-white" disabled={(medication.quantity ?? 0) === 0} data-testid={`button-move-${medication.id}`}>
                              <CornerRightDown className="h-4 w-4 mr-1" />
                              Move
                            </Button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        <div id="low-stock-ticker" className="mt-8">
          <LowStockTicker />
        </div>

        <OutOfStockTracker />
      </main>

      <AddMedicationModal open={isAddModalOpen} onOpenChange={setIsAddModalOpen} onSave={() => setIsAddModalOpen(false)} />

      <DispenseModal open={isDispenseModalOpen} onOpenChange={setIsDispenseModalOpen} medication={selectedMedication} />
      <MoveModal open={isMoveModalOpen} onOpenChange={setIsMoveModalOpen} medication={selectedMedication} />
    </div>
  );
}
