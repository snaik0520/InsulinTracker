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
import { formatToISODate } from "@shared/dateUtils";
import { Search, Plus, HandHeart, Syringe, Zap, Clock, Scale, HelpCircle, List, ArrowRightLeft } from "lucide-react";
import logo from "../assets/noor-logo.png";

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
  const formattedExpirationDate = formatToISODate(expirationDate);
  const expiry = new Date(formattedExpirationDate);
  const diffTime = expiry.getTime() - today.getTime();
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
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

  const { data: medications = [], isLoading } = useQuery({
    queryKey: ["/api/medications"],
  });

  // only render the out-of-stock tracker if there's at least one med at 0 qty
  const outOfStockCount = useMemo(
    () => medications.filter((m) => (m.quantity ?? 0) === 0).length,
    [medications]
  );

  const filteredMedications = useMemo(() => {
    let filtered = medications.filter((med) => (med.quantity ?? 0) > 0);

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
      <div className="container mx-auto px-4 py-8">
        <div className="text-center">
          <div className="text-lg text-muted-foreground">Loading medications…</div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 space-y-8">
      {/* Header */}
      <div className="flex items-center gap-4 mb-8">
        <img src={logo} alt="Noor Logo" className="h-12 w-auto" />
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Insulin Inventory Tracker</h1>
          <p className="text-gray-600">Manage your clinic's insulin inventory efficiently</p>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
          <Label htmlFor="search" className="sr-only">
            Search medications
          </Label>
          <Input
            id="search"
            placeholder="Search by generic or brand name..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
            data-testid="input-search-medication"
          />
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            onClick={() => setIsAddModalOpen(true)}
            className="bg-blue-600 hover:bg-blue-700"
            data-testid="button-add-medication"
          >
            <Plus className="w-4 h-4 mr-2" />
            Add Medication
          </Button>

          <Button
            onClick={scrollToTrackers}
            variant="outline"
            className="border-orange-200 text-orange-700 hover:bg-orange-50"
          >
            <List className="w-4 h-4 mr-2" />
            View Trackers
          </Button>
        </div>
      </div>

      {/* Filter buttons */}
      <div className="space-y-2">
        <Label className="text-sm font-medium text-gray-700">
          Filter by insulin type
        </Label>
        <div className="flex flex-wrap gap-2">
          <Button
            onClick={() => setSelectedType("all")}
            variant={selectedType === "all" ? "default" : "outline"}
            size="sm"
            className={selectedType === "all" ? "bg-gray-600 hover:bg-gray-700" : ""}
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
                onClick={() => setSelectedType(type)}
                variant="outline"
                size="sm"
                className={`${
                  selectedType === type ? selectedCls : ""
                } ${hoverCls} border transition-colors`}
              >
                <Icon className="w-4 h-4 mr-1" />
                {label}
              </Button>
            );
          })}
        </div>
      </div>

      {/* Medications Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Syringe className="w-5 h-5" />
            Current insulin inventory
          </CardTitle>
          <p className="text-sm text-muted-foreground">Manage and track all insulin medications in your clinic</p>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-3 px-4 font-medium text-gray-900">Medication</th>
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
                    <td colSpan={8} className="text-center py-8 text-gray-500">
                      {searchQuery || selectedType !== "all"
                        ? "No medications found matching your criteria."
                        : "No medications in inventory. Add your first medication to get started."}
                    </td>
                  </tr>
                ) : (
                  filteredMedications.map((medication) => {
                    const days = calculateDaysUntilExpiration(medication.expirationDate);
                    const expClass = getExpirationClassName(days);
                    const Icon = typeIcons[medication.type as keyof typeof typeIcons];
                    const adminValue =
                      (medication.administrativeForm as string | undefined) ||
                      (medication.formType as string | undefined) ||
                      "";
                    const adminDisplay =
                      adminValue.toLowerCase() === "pen"
                        ? "Pen"
                        : adminValue.toLowerCase() === "injection"
                        ? "Injection"
                        : "—";
                    const rowTint = getRowClassName(medication.type);

                    return (
                      <tr key={medication.id} className={`border-b hover:bg-gray-50 ${rowTint}`}>
                        <td className="py-3 px-4">
                          <div className="font-medium text-gray-900">
                            {medication.medicalName ?? medication.genericName ?? "—"}
                          </div>
                          <div className="text-sm text-gray-500">
                            {medication.genericName ? `(${medication.genericName})` : ""}
                          </div>
                        </td>
                        <td className="py-3 px-4 text-gray-700">{adminDisplay}</td>
                        <td className="py-3 px-4">
                          <Badge className={(badgeColors as any)[medication.type]}>
                            <Icon className="w-3 h-3 mr-1" />
                            {(typeLabels as any)[medication.type]}
                          </Badge>
                        </td>
                        <td className="py-3 px-4 text-gray-700">{medication.dose}</td>
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{medication.quantity}</span>
                            {medication.quantity <= 5 && (
                              <Badge variant="destructive" className="text-xs">
                                Low stock
                              </Badge>
                            )}
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <span className={expClass}>
                            {medication.expirationDate ? formatToISODate(medication.expirationDate) : "—"}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-gray-700">{medication.location ?? "—"}</td>
                        <td className="py-3 px-4">
                          <div className="flex gap-2">
                            <Button
                              onClick={() => handleDispense(medication)}
                              size="sm"
                              data-testid={`button-dispense-${medication.id}`}
                            >
                              <HandHeart className="w-4 h-4 mr-1" />
                              Dispense
                            </Button>
                            <Button
                              onClick={() => handleMove(medication)}
                              size="sm"
                              variant="outline"
                              data-testid={`button-move-${medication.id}`}
                            >
                              <ArrowRightLeft className="w-4 h-4 mr-1" />
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

      {/* Give the LowStockTicker a stable id so the button can scroll to it */}
      <div id="low-stock-ticker">
        <LowStockTicker />
      </div>

      {outOfStockCount > 0 && <OutOfStockTracker />}

      <TransactionHistory />

      <AddMedicationModal
        open={isAddModalOpen}
        onOpenChange={setIsAddModalOpen}
        onSuccess={(newMed: Medication) => {
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
        medication={selectedMedication}
      />
    </div>
  );
}
