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
import { Search, Plus, HandHeart, Syringe, Zap, Clock, Scale, HelpCircle, List } from "lucide-react";
import logo from "../assets/noor-logo.png";

/**
 * Small dialog components used for the Move modal
 * (these exist in other parts of the codebase; import them if present)
 */
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";

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

// subtle row background tints (muted pastels)
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

/**
 * Capitalize the first letter of each word (Title Case).
 * Example: "main fridge" -> "Main Fridge"
 */
const capitalizeWords = (value: string) => {
  return value.replace(/\b\w+/g, (w) => w[0].toUpperCase() + w.slice(1).toLowerCase());
};

export default function Inventory() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedType, setSelectedType] = useState("all");
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isDispenseModalOpen, setIsDispenseModalOpen] = useState(false);
  const [selectedMedication, setSelectedMedication] = useState<Medication | null>(null);

  // Move modal state (new)
  const [isMoveModalOpen, setIsMoveModalOpen] = useState(false);
  const [moveMedication, setMoveMedication] = useState<Medication | null>(null);
  const [moveToLocation, setMoveToLocation] = useState("");
  const [moveComment, setMoveComment] = useState("");
  const [moveError, setMoveError] = useState<string | null>(null);
  const [isSubmittingMove, setIsSubmittingMove] = useState(false);

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

  // Open Move modal helper
  const openMoveModal = (medication: Medication) => {
    setMoveMedication(medication);
    setMoveToLocation(""); // require user to choose/enter
    setMoveComment("");
    setMoveError(null);
    setIsMoveModalOpen(true);
  };

  // Submit move action: optimistic local update + POST to backend endpoints for persistence/transaction
  const handleMoveSubmit = async () => {
    setMoveError(null);

    if (!moveToLocation || moveToLocation.trim() === "") {
      setMoveError("Please enter the destination location (required).");
      return;
    }

    if (!moveMedication) {
      setMoveError("No medication selected.");
      return;
    }

    setIsSubmittingMove(true);

    const medicationId = moveMedication.id;
    const fromLocation = moveMedication.location ?? "—";
    const toLocation = moveToLocation.trim();
    const comment = moveComment.trim();

    // Optimistically update UI (matches pattern used elsewhere in the file)
    try {
      // update the medication in local array (note: medications comes from useQuery; this mirrors the existing pattern of local mutation)
      const localMed = medications.find((m) => m.id === medicationId);
      if (localMed) {
        localMed.location = toLocation;
      }

      // create transaction payload so transaction history component / backend can record it
      const transactionPayload = {
        medicationId,
        type: "move",
        fromLocation,
        toLocation,
        comment,
        timestamp: new Date().toISOString(),
      };

      // Attempt to persist move and transaction - endpoints are examples; adjust to match your backend
      await Promise.all([
        fetch(`/api/medications/${encodeURIComponent(String(medicationId))}/move`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ toLocation, comment }),
        }).catch(() => {
          // swallow to allow optimistic UI even if backend not present
        }),
        fetch(`/api/transactions`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(transactionPayload),
        }).catch(() => {
          // swallow
        }),
      ]);

      // close modal
      setIsMoveModalOpen(false);
      setMoveMedication(null);
      setMoveToLocation("");
      setMoveComment("");
    } catch (err) {
      console.error("Failed to move medication:", err);
      setMoveError("Something went wrong while moving the medication. Please try again.");
    } finally {
      setIsSubmittingMove(false);
    }
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

  // gather existing locations for suggestions in the Move modal
  const locationSuggestions = useMemo(() => {
    const s = new Set<string>();
    for (const m of medications) {
      if (m.location) s.add(m.location);
    }
    return Array.from(s).filter(Boolean);
  }, [medications]);

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
                  className="flex items-center border-rose-200 text-rose-700 hover:bg-rose-50"
                  data-testid="button-jump-low-outstock"
                  title="Jump to low / out of stock trackers"
                >
                  <List className="h-4 w-4 mr-2" />
                  Low / Out of Stock
                </Button>

                <TransactionHistory />

                <Button
                  onClick={() => setIsAddModalOpen(true)}
                  className="bg-rose-600 hover:bg-rose-700 text-white"
                  data-testid="button-add-medication"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add Medication
                </Button>
              </div>
            </div>

            <div className="mt-6">
              <Label className="block text-sm font-medium text-gray-700 mb-3">Filter by insulin type</Label>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant={selectedType === "all" ? "default" : "outline"}
                  onClick={() => setSelectedType("all")}
                  className={`text-sm ${selectedType === "all" ? "bg-white text-gray-700" : "text-gray-700"}`}
                  data-testid="filter-all"
                >
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
                      className={`text-sm ${selectedType === type ? selectedCls : `border-gray-200 ${hoverCls}`} `}
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

                    {/* Administrative Form column */}
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
                        {searchQuery || selectedType !== "all"
                          ? "No medications found matching your criteria."
                          : "No medications in inventory. Add your first medication to get started."}
                      </td>
                    </tr>
                  ) : (
                    filteredMedications.map((medication) => {
                      const daysUntilExpiration = calculateDaysUntilExpiration(medication.expirationDate);
                      const Icon = typeIcons[medication.type as keyof typeof typeIcons];

                      // administrative form display logic:
                      const adminFormValue =
                        (medication.administrativeForm as string | undefined) ||
                        (medication.formType as string | undefined) ||
                        "";
                      const adminFormDisplay =
                        adminFormValue.toLowerCase() === "pen" ? "Pen" : adminFormValue.toLowerCase() === "injection" ? "Injection" : "—";

                      const rowTint = getRowClassName(medication.type);

                      return (
                        <tr
                          key={medication.id}
                          className={`${rowTint} hover:bg-gray-50`}
                          data-testid={`row-medication-${medication.id}`}
                        >
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div>
                              <div className="text-sm font-medium text-gray-900" data-testid="text-medical-name">
                                {medication.medicalName ?? medication.genericName ?? "—"}
                              </div>
                              <div className="text-sm text-gray-500" data-testid="text-generic-name">
                                {medication.genericName ? `(${medication.genericName})` : ""}
                              </div>
                            </div>
                          </td>

                          {/* Administrative Form */}
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900" data-testid="text-administrative-form">
                            {adminFormDisplay}
                          </td>

                          <td className="px-6 py-4 whitespace-nowrap">
                            <Badge className={(badgeColors as any)[medication.type]}>
                              <Icon className="h-3 w-3 mr-1" />
                              {(typeLabels as any)[medication.type]}
                            </Badge>
                          </td>

                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900" data-testid="text-dose">
                            {medication.dose}
                          </td>

                          <td className="px-6 py-4 whitespace-nowrap">
                            <span
                              className={`text-sm font-medium ${
                                (medication.quantity ?? 0) <= 5 ? "text-red-600" : "text-gray-900"
                              }`}
                              data-testid="text-quantity"
                            >
                              {medication.quantity ?? 0}
                            </span>
                            {(medication.quantity ?? 0) <= 5 && <div className="text-xs text-red-600">Low stock</div>}
                          </td>

                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className="text-sm text-gray-900" data-testid="text-expiration-date">
                              {medication.expirationDate ? new Date(medication.expirationDate).toLocaleDateString() : "—"}
                            </span>
                          </td>

                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500" data-testid="text-location">
                            {medication.location ?? "—"}
                          </td>

                          <td className="px-6 py-4 whitespace-nowrap space-x-2">
                            <Button
                              onClick={() => handleDispense(medication)}
                              size="sm"
                              className="bg-emerald-600 hover:bg-emerald-700 text-white"
                              disabled={(medication.quantity ?? 0) === 0}
                              data-testid={`button-dispense-${medication.id}`}
                            >
                              <HandHeart className="h-4 w-4 mr-1" />
                              Dispense
                            </Button>

                            {/* NEW: Move button - opens modal to require destination location and optional comment */}
                            <Button
                              onClick={() => openMoveModal(medication)}
                              size="sm"
                              className="bg-amber-600 hover:bg-amber-700 text-white"
                              data-testid={`button-move-${medication.id}`}
                              title="Move medication to a different location"
                            >
                              <Syringe className="h-4 w-4 mr-1" />
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

        {/* Give the LowStockTicker a stable id so the button can scroll to it */}
        <div id="low-stock-ticker" className="mt-8">
          <LowStockTicker />
        </div>

        <OutOfStockTracker />
      </main>

      <AddMedicationModal
        open={isAddModalOpen}
        onOpenChange={setIsAddModalOpen}
        onSave={(newMed: any) => {
          // Note: replace with your backend mutation; this is only local client push
          medications.push(newMed);
          setIsAddModalOpen(false);
        }}
      />

      <DispenseModal open={isDispenseModalOpen} onOpenChange={setIsDispenseModalOpen} medication={selectedMedication} />

      {/* Move Modal */}
      <Dialog open={isMoveModalOpen} onOpenChange={setIsMoveModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Move medication</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label className="text-sm font-medium">Medication</Label>
              <div className="mt-1 text-sm text-gray-900">
                {moveMedication ? `${moveMedication.medicalName ?? moveMedication.genericName ?? "—"}` : "—"}
              </div>
            </div>

            <div>
              <Label htmlFor="move-to-location" className="text-sm font-medium">
                Destination location (required)
              </Label>
              <Input
                id="move-to-location"
                placeholder="Enter destination location"
                value={moveToLocation}
                onChange={(e) => setMoveToLocation(capitalizeWords(e.target.value))}
                className="mt-1"
                data-testid="input-move-to-location"
                list="location-suggestions"
              />
              <datalist id="location-suggestions">
                {locationSuggestions.map((loc) => (
                  <option key={loc} value={loc} />
                ))}
              </datalist>
            </div>

            <div>
              <Label htmlFor="move-comment" className="text-sm font-medium">
                Comment (optional)
              </Label>
              <textarea
                id="move-comment"
                value={moveComment}
                onChange={(e) => setMoveComment(e.target.value)}
                className="mt-1 block w-full rounded-md border-gray-200 shadow-sm focus:ring-1 focus:ring-rose-400 focus:border-rose-400 p-2 text-sm"
                rows={3}
                placeholder="Add a short note to appear in transaction history (e.g., 'moved to main fridge')"
                data-testid="input-move-comment"
              />
            </div>

            {moveError && <div className="text-sm text-red-600">{moveError}</div>}
          </div>

          <DialogFooter className="mt-4 flex justify-end space-x-2">
            <Button size="sm" variant="outline" onClick={() => setIsMoveModalOpen(false)} disabled={isSubmittingMove}>
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleMoveSubmit}
              className="bg-amber-600 hover:bg-amber-700 text-white"
              disabled={isSubmittingMove}
              data-testid="button-submit-move"
            >
              {isSubmittingMove ? "Moving…" : "Move medication"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
