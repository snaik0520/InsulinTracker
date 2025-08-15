import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { AddMedicationModal } from "@/components/add-medication-modal";
import { DispenseModal } from "@/components/dispense-modal";
import { MoveModal } from "@/components/move-modal";
import { LowStockTicker } from "@/components/low-stock-ticker";
import { OutOfStockTracker } from "@/components/out-of-stock-tracker";
import { TransactionHistory } from "@/components/transaction-history";
import { type Medication } from "@shared/schema";
import { Search, Plus, HandHeart, Syringe, Zap, Clock, Scale, HelpCircle, List, Package } from "lucide-react";
import logo from "../assets/noor-logo.png";

const typeIcons = {
  rapid: Zap,
  long: Clock,
  intermediate: Scale,
  other: HelpCircle,
} as const;

/**
 * Muted pastel palette:
 * - rapid -> rose / pink pastel
 * - long -> violet pastel
 * - inter -> emerald pastel
 * - other -> amber pastel
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

export default function Inventory() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedType, setSelectedType] = useState("all");
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isDispenseModalOpen, setIsDispenseModalOpen] = useState(false);
  const [selectedMedication, setSelectedMedication] = useState<Medication | null>(null);
  const [isMoveModalOpen, setIsMoveModalOpen] = useState(false);
  const [moveSelectedMedication, setMoveSelectedMedication] = useState<Medication | null>(null);

  const { data: medications = [], isLoading } = useQuery({
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
    setMoveSelectedMedication(medication);
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
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="text-lg font-semibold">Loading medications…</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <img src={logo} alt="Noor Logo" className="h-8 w-auto" />
              <h1 className="text-2xl font-bold text-gray-900">Insulin Inventory</h1>
            </div>
            <div className="flex items-center space-x-4">
              <TransactionHistory />
              <Button
                onClick={() => setIsAddModalOpen(true)}
                className="bg-blue-600 hover:bg-blue-700"
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Medication
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Search and Filter Section */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="bg-white rounded-lg shadow-sm border p-6 mb-6">
          <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-end">
            {/* Search */}
            <div className="flex-1">
              <Label htmlFor="search" className="text-sm font-medium text-gray-700 mb-2 block">
                Search medications
              </Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  id="search"
                  type="text"
                  placeholder="Search by generic or medical name..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                  data-testid="input-search-medication"
                />
              </div>
            </div>

            {/* Filter */}
            <div className="lg:min-w-[300px]">
              <Button
                variant="outline"
                size="sm"
                onClick={scrollToTrackers}
                className="mb-2 lg:float-right"
              >
                <List className="h-4 w-4 mr-2" />
                View Stock Alerts
              </Button>

              <div className="clear-both">
                <Label className="text-sm font-medium text-gray-700 mb-2 block">
                  Filter by insulin type
                </Label>

                <div className="flex flex-wrap gap-2">
                  <Button
                    key="all"
                    variant={selectedType === "all" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setSelectedType("all")}
                    className={selectedType !== "all" ? "hover:bg-gray-50" : ""}
                  >
                    All Types
                  </Button>

                  {Object.entries(typeLabels).map(([type, label]) => {
                    const Icon = typeIcons[type as keyof typeof typeIcons];
                    const selectedCls = (filterSelectedClasses as any)[type];
                    const hoverCls = (filterHoverClasses as any)[type];

                    return (
                      <Button
                        key={type}
                        variant="outline"
                        size="sm"
                        onClick={() => setSelectedType(type)}
                        className={
                          selectedType === type
                            ? selectedCls
                            : `border-gray-300 bg-white text-gray-700 ${hoverCls}`
                        }
                      >
                        <Icon className="h-3 w-3 mr-1" />
                        {label}
                      </Button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Inventory Table */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Syringe className="h-5 w-5 mr-2 text-blue-600" />
              Current insulin inventory
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              Manage and track all insulin medications in your clinic
            </p>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full table-auto">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-3 px-4 font-medium text-gray-900">Medication</th>
                    {/* Administrative Form column */}
                    <th className="text-left py-3 px-4 font-medium text-gray-900">Administrative form</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-900">Insulin type</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-900">Dose</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-900">Quantity</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-900">Expiration</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-900">Location</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-900">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredMedications.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="text-center py-8 text-muted-foreground">
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
                        <tr key={medication.id} className={`border-b hover:bg-gray-50 ${rowTint}`}>
                          <td className="py-3 px-4">
                            <div className="flex flex-col">
                              <span className="font-medium text-gray-900">
                                {medication.medicalName ?? medication.genericName ?? "—"}
                              </span>
                              {medication.genericName && (
                                <span className="text-sm text-muted-foreground">
                                  {medication.genericName ? `(${medication.genericName})` : ""}
                                </span>
                              )}
                            </div>
                          </td>

                          {/* Administrative Form */}
                          <td className="py-3 px-4 text-sm text-gray-600">{adminFormDisplay}</td>

                          <td className="py-3 px-4">
                            <Badge
                              variant="outline"
                              className={`${(badgeColors as any)[medication.type]}`}
                            >
                              <Icon className="h-3 w-3 mr-1" />
                              {(typeLabels as any)[medication.type]}
                            </Badge>
                          </td>

                          <td className="py-3 px-4 text-sm text-gray-600">{medication.dose}</td>

                          <td className="py-3 px-4">
                            <div className="flex items-center space-x-2">
                              <span className="font-medium">{medication.quantity ?? 0}</span>
                              {(medication.quantity ?? 0) <= 5 && (
                                <Badge variant="destructive" className="text-xs">
                                  Low stock
                                </Badge>
                              )}
                            </div>
                          </td>

                          <td className="py-3 px-4">
                            <span className={`text-sm ${getExpirationClassName(daysUntilExpiration)}`}>
                              {medication.expirationDate
                                ? new Date(medication.expirationDate).toLocaleDateString()
                                : "—"}
                            </span>
                          </td>

                          <td className="py-3 px-4 text-sm text-gray-600">{medication.location ?? "—"}</td>

                          <td className="px-6 py-4">
                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                onClick={() => handleDispense(medication)}
                                disabled={medication.quantity === 0}
                              >
                                <HandHeart className="h-4 w-4 mr-2" />
                                Dispense
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleMove(medication)}
                              >
                                <Package className="h-4 w-4 mr-2" />
                                Move
                              </Button>
                            </div>
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
      </div>

      {/* Give the LowStockTicker a stable id so the button can scroll to it */}
      <div id="low-stock-ticker">
        <LowStockTicker />
      </div>
      <OutOfStockTracker />

      {/* Modals */}
      <AddMedicationModal
        open={isAddModalOpen}
        onOpenChange={setIsAddModalOpen}
        onMedicationAdded={(newMed) => {
          // Note: replace with your backend mutation; this is only local client push
          medications.push(newMed);
          setIsAddModalOpen(false);
        }}
      />

      <DispenseModal
        open={isDispenseModalOpen}
        onOpenChange={setIsDispenseModalOpen}
        medication={selectedMedication}
      />

      <MoveModal
        open={isMoveModalOpen}
        onOpenChange={setIsMoveModalOpen}
        medication={moveSelectedMedication}
      />
    </div>
  );
}
