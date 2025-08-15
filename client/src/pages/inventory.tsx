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

const typeIcons = {
  rapid: Zap,
  long: Clock,
  intermediate: Scale,
  other: HelpCircle,
};

// Muted pastel palette (soft backgrounds, gentle text)
const typeColors = {
  rapid: "bg-sky-50 text-sky-700",
  long: "bg-violet-50 text-violet-700",
  intermediate: "bg-emerald-50 text-emerald-700",
  other: "bg-amber-50 text-amber-700",
};

const typeLabels = {
  rapid: "Rapid Acting",
  long: "Long Acting",
  intermediate: "Intermediate",
  other: "Other",
};

const getRowClassName = (type: string) => {
  switch (type) {
    case "rapid":
      return "insulin-type-rapid";
    case "long":
      return "insulin-type-long";
    case "intermediate":
      return "insulin-type-intermediate";
    case "other":
      return "insulin-type-other";
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
  if (days < 30) return "text-rose-600";
  if (days < 90) return "text-amber-600";
  return "text-emerald-600";
};

export default function Inventory() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedType, setSelectedType] = useState("all");
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isDispenseModalOpen, setIsDispenseModalOpen] = useState(false);
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
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-sky-200 mx-auto mb-4"></div>
          <p className="text-slate-600">Loading medications…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-slate-50 min-h-screen">
      <header className="bg-gradient-to-r from-sky-50 via-violet-50 to-rose-50 shadow-sm border-b border-slate-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <Syringe className="h-6 w-6 text-sky-500 mr-3" />
              <h1 className="text-xl font-semibold text-slate-800">Insulin Inventory</h1>
            </div>
            <div className="flex items-center space-x-4">
              <span className="text-lg text-slate-600 font-medium tracking-wide">SLO Noor Foundation</span>
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
                <Label htmlFor="medication-search" className="block text-sm font-medium text-slate-700 mb-2">
                  Search medications
                </Label>
                <div className="relative">
                  <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
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
                  className="flex items-center border-sky-200 text-sky-700 hover:bg-sky-50"
                  data-testid="button-jump-low-outstock"
                  title="Jump to low / out of stock trackers"
                >
                  <List className="h-4 w-4 mr-2" />
                  Low / Out of Stock
                </Button>

                <TransactionHistory />

                <Button
                  onClick={() => setIsAddModalOpen(true)}
                  className="bg-rose-100 hover:bg-rose-200 text-rose-800"
                  data-testid="button-add-medication"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add Medication
                </Button>
              </div>
            </div>

            <div className="mt-6">
              <Label className="block text-sm font-medium text-slate-700 mb-3">Filter by insulin type</Label>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant={selectedType === "all" ? "default" : "outline"}
                  onClick={() => setSelectedType("all")}
                  className="text-sm"
                  data-testid="filter-all"
                >
                  <List className="h-4 w-4 mr-2" /> All types
                </Button>
                {Object.entries(typeLabels).map(([type, label]) => {
                  const Icon = typeIcons[type as keyof typeof typeIcons];
                  return (
                    <Button
                      key={type}
                      variant={selectedType === type ? "default" : "outline"}
                      onClick={() => setSelectedType(type)}
                      className="text-sm"
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
            <CardTitle className="text-lg font-medium text-slate-800">Current insulin inventory</CardTitle>
            <p className="text-sm text-slate-600">Manage and track all insulin medications in your clinic</p>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-sm font-medium text-slate-600">Medication</th>

                    {/* Administrative Form column */}
                    <th className="px-6 py-3 text-left text-sm font-medium text-slate-600">Administrative form</th>

                    <th className="px-6 py-3 text-left text-sm font-medium text-slate-600">Insulin type</th>
                    <th className="px-6 py-3 text-left text-sm font-medium text-slate-600">Dose</th>
                    <th className="px-6 py-3 text-left text-sm font-medium text-slate-600">Quantity</th>
                    <th className="px-6 py-3 text-left text-sm font-medium text-slate-600">Expiration</th>
                    <th className="px-6 py-3 text-left text-sm font-medium text-slate-600">Location</th>
                    <th className="px-6 py-3 text-left text-sm font-medium text-slate-600">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-slate-200">
                  {filteredMedications.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-6 py-12 text-center text-slate-500">
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

                      return (
                        <tr
                          key={medication.id}
                          className={`${getRowClassName(medication.type)} hover:bg-slate-50`}
                          data-testid={`row-medication-${medication.id}`}
                        >
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div>
                              <div className="text-sm font-medium text-slate-800" data-testid="text-medical-name">
                                {medication.medicalName ?? medication.genericName ?? "—"}
                              </div>
                              <div className="text-sm text-slate-500" data-testid="text-generic-name">
                                {medication.genericName ? `(${medication.genericName})` : ""}
                              </div>
                            </div>
                          </td>

                          {/* Administrative Form */}
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-800" data-testid="text-administrative-form">
                            {adminFormDisplay}
                          </td>

                          <td className="px-6 py-4 whitespace-nowrap">
                            <Badge className={typeColors[medication.type as keyof typeof typeColors]}>
                              <Icon className="h-3 w-3 mr-1" />
                              {typeLabels[medication.type as keyof typeof typeLabels]}
                            </Badge>
                          </td>

                          <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-800" data-testid="text-dose">
                            {medication.dose}
                          </td>

                          <td className="px-6 py-4 whitespace-nowrap">
                            <span
                              className={`text-sm font-medium ${
                                (medication.quantity ?? 0) <= 5 ? "text-rose-600" : "text-slate-800"
                              }`}
                              data-testid="text-quantity"
                            >
                              {medication.quantity ?? 0}
                            </span>
                            {(medication.quantity ?? 0) <= 5 && <div className="text-xs text-rose-600">Low stock</div>}
                          </td>

                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className="text-sm text-slate-800" data-testid="text-expiration-date">
                              {medication.expirationDate ? new Date(medication.expirationDate).toLocaleDateString() : "—"}
                            </span>
                          </td>

                          <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500" data-testid="text-location">
                            {medication.location ?? "—"}
                          </td>

                          <td className="px-6 py-4 whitespace-nowrap">
                            <Button
                              onClick={() => handleDispense(medication)}
                              size="sm"
                              className="bg-emerald-100 hover:bg-emerald-200 text-emerald-800"
                              disabled={(medication.quantity ?? 0) === 0}
                              data-testid={`button-dispense-${medication.id}`}
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
    </div>
  );
}
