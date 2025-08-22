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
import { formatToISODate } from "@shared/dateUtils";
import { Search, Plus, HandHeart, Syringe, Zap, Clock, Scale, HelpCircle, List } from "lucide-react";
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
  // Ensure we're working with ISO date format
  const formattedExpirationDate = formatToISODate(expirationDate);
  const expiry = new Date(formattedExpirationDate);
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
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-6">
        <div className="max-w-7xl mx-auto">
          <p className="text-center text-gray-600">Loading medications…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src={logo} alt="Noor Logo" className="h-8 w-8" />
            <h1 className="text-2xl font-bold text-gray-900">Insulin Inventory</h1>
          </div>
          <div className="flex items-center gap-3">
            <Button
              onClick={scrollToTrackers}
              variant="outline"
              size="sm"
              className="flex items-center gap-2"
            >
              <List className="h-4 w-4" />
              View Alerts
            </Button>
            <Button
              onClick={() => setIsAddModalOpen(true)}
              className="flex items-center gap-2"
            >
              <Plus className="h-4 w-4" />
              Add Medication
            </Button>
          </div>
        </div>

        {/* Search and Filter */}
        <Card>
          <CardContent className="p-6">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                <Input
                  placeholder="Search medications"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                  data-testid="input-search-medication"
                />
              </div>
              <div className="flex flex-wrap gap-2">
                <Label className="text-sm font-medium text-gray-700 flex items-center">
                  Filter by insulin type
                </Label>
                <Button
                  variant={selectedType === "all" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setSelectedType("all")}
                  className={selectedType === "all" ? "" : "hover:bg-gray-50"}
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
                      className={`flex items-center gap-1 ${
                        selectedType === type ? selectedCls : hoverCls
                      }`}
                    >
                      <Icon className="h-3 w-3" />
                      {label}
                    </Button>
                  );
                })}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Inventory Table */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              Current insulin inventory
              <span className="text-sm font-normal text-gray-600">
                Manage and track all insulin medications in your clinic
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="border-b">
                    <th className="text-left p-3 font-medium text-gray-700">Medication</th>
                    <th className="text-left p-3 font-medium text-gray-700">Administrative form</th>
                    <th className="text-left p-3 font-medium text-gray-700">Insulin type</th>
                    <th className="text-left p-3 font-medium text-gray-700">Dose</th>
                    <th className="text-left p-3 font-medium text-gray-700">Quantity</th>
                    <th className="text-left p-3 font-medium text-gray-700">Expiration</th>
                    <th className="text-left p-3 font-medium text-gray-700">Location</th>
                    <th className="text-left p-3 font-medium text-gray-700">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredMedications.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="text-center p-8 text-gray-500">
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
                        <tr key={medication.id} className={`border-b ${rowTint} hover:bg-opacity-50`}>
                          <td className="p-3">
                            <div>
                              <div className="font-medium">
                                {medication.medicalName ?? medication.genericName ?? "—"}
                              </div>
                              {medication.genericName && (
                                <div className="text-sm text-gray-600">
                                  ({medication.genericName})
                                </div>
                              )}
                            </div>
                          </td>
                          <td className="p-3">{adminFormDisplay}</td>
                          <td className="p-3">
                            <Badge
                              variant="secondary"
                              className={`flex items-center gap-1 w-fit ${
                                (badgeColors as any)[medication.type]
                              }`}
                            >
                              <Icon className="h-3 w-3" />
                              {(typeLabels as any)[medication.type]}
                            </Badge>
                          </td>
                          <td className="p-3">{medication.dose}</td>
                          <td className="p-3">
                            <div className="flex items-center gap-2">
                              <span>{medication.quantity ?? 0}</span>
                              {(medication.quantity ?? 0) <= 5 && (
                                <Badge variant="destructive" className="text-xs">
                                  Low stock
                                </Badge>
                              )}
                            </div>
                          </td>
                          <td className="p-3">
                            <span className={getExpirationClassName(daysUntilExpiration)}>
                              {medication.expirationDate ? formatToISODate(medication.expirationDate) : "—"}
                            </span>
                          </td>
                          <td className="p-3">{medication.location ?? "—"}</td>
                          <td className="p-3">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleDispense(medication)}
                              className="flex items-center gap-1"
                            >
                              <HandHeart className="h-3 w-3" />
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
        <div id="low-stock-ticker">
          <LowStockTicker />
        </div>
        
        <OutOfStockTracker />
        
        <TransactionHistory />
      </div>

      <AddMedicationModal
        open={isAddModalOpen}
        onOpenChange={setIsAddModalOpen}
        onSave={(newMed) => {
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
    </div>
  );
}
