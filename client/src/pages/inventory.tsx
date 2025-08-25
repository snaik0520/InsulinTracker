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
  const [selectedMedication, setSelectedMedication] = useState<Medication | null>(null);
  const [isMoveModalOpen, setIsMoveModalOpen] = useState(false);
  const [selectedMoveMedication, setSelectedMoveMedication] = useState<Medication | null>(null);

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
    setSelectedMoveMedication(medication);
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
      <div className="container mx-auto py-8">
        <div className="text-center">
          <div className="text-lg">Loading medications…</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="container mx-auto px-6 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <img src={logo} alt="Noor Logo" className="h-12 w-12" />
              <div>
                <h1 className="text-3xl font-bold text-gray-900">Insulin Inventory</h1>
                <p className="text-gray-600 mt-1">Track and manage your insulin medications</p>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <Button
                onClick={scrollToTrackers}
                variant="outline"
                size="sm"
                className="text-blue-600 border-blue-200 hover:bg-blue-50"
              >
                <List className="h-4 w-4 mr-2" />
                View Reports
              </Button>
              <Button onClick={() => setIsAddModalOpen(true)} className="bg-blue-600 hover:bg-blue-700">
                <Plus className="h-4 w-4 mr-2" />
                Add Medication
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Search and Controls */}
      <div className="container mx-auto px-6 py-8">
        <Card className="mb-8 border-0 shadow-lg">
          <CardContent className="p-6">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between space-y-4 lg:space-y-0">
              <div className="relative flex-1 lg:max-w-md">
                <Label htmlFor="search" className="sr-only">
                  Search medications
                </Label>
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  id="search"
                  placeholder="Search by medication name..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                  data-testid="input-search-medication"
                />
              </div>
            </div>

            {/* Type Filters */}
            <div className="mt-6">
              <Label className="text-sm font-medium text-gray-700 mb-3 block">
                Filter by insulin type
              </Label>
              <div className="flex flex-wrap gap-2">
                <Button
                  key="all"
                  variant="outline"
                  size="sm"
                  onClick={() => setSelectedType("all")}
                  className={`${
                    selectedType === "all"
                      ? "bg-blue-100 text-blue-800 border-blue-200"
                      : "hover:bg-gray-50"
                  }`}
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
                      className={`${
                        selectedType === type ? selectedCls : `${hoverCls} border-gray-200`
                      }`}
                    >
                      <Icon className="h-4 w-4 mr-1" />
                      {label}
                    </Button>
                  );
                })}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Inventory Table */}
        <Card className="border-0 shadow-lg">
          <CardHeader className="bg-gray-50 border-b">
            <CardTitle className="text-xl font-semibold">Current insulin inventory</CardTitle>
            <p className="text-gray-600 text-sm mt-1">Manage and track all insulin medications in your clinic</p>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Medication</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Administrative form</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Insulin type</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Dose</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Quantity</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Expiration</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Location</th>
                    <th className="px-4 py-3 text-right text-sm font-medium text-gray-700">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {filteredMedications.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-4 py-12 text-center text-gray-500">
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
                        <tr key={medication.id} className={`hover:bg-gray-50 ${rowTint}`}>
                          <td className="px-4 py-3">
                            <div className="font-medium text-gray-900">
                              {medication.medicalName ?? medication.genericName ?? "—"}
                            </div>
                            <div className="text-sm text-gray-500">
                              {medication.genericName ? `(${medication.genericName})` : ""}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-gray-600">{adminDisplay}</td>
                          <td className="px-4 py-3">
                            <Badge className={(badgeColors as any)[medication.type]}>
                              <Icon className="h-3 w-3 mr-1" />
                              {(typeLabels as any)[medication.type]}
                            </Badge>
                          </td>
                          <td className="px-4 py-3 text-gray-600">{medication.dose}</td>
                          <td className="px-4 py-3">
                            <div className="flex items-center space-x-2">
                              <span className="font-medium">{medication.quantity}</span>
                              {medication.quantity! <= 5 && (
                                <Badge variant="destructive" className="text-xs">
                                  Low stock
                                </Badge>
                              )}
                            </div>
                          </td>
                          <td className={`px-4 py-3 ${expClass}`}>
                            {medication.expirationDate ? formatToISODate(medication.expirationDate) : "—"}
                          </td>
                          <td className="px-4 py-3 text-gray-600">{medication.location ?? "—"}</td>
                          <td className="px-4 py-2 text-right">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleMove(medication)}
                              className="mr-2"
                            >
                              <ArrowRightLeft className="h-4 w-4 mr-1" />
                              Move
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleDispense(medication)}
                            >
                              <HandHeart className="h-4 w-4 mr-1" />
                              Dispense
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

        {outOfStockCount > 0 && <OutOfStockTracker />}

        <TransactionHistory />
      </div>

      <AddMedicationModal
        open={isAddModalOpen}
        onOpenChange={setIsAddModalOpen}
        onMedicationAdded={(newMed) => {
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
        medication={selectedMoveMedication}
      />
    </div>
  );
}
