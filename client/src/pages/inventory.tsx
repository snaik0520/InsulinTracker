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

const typeColors = {
  rapid: "bg-blue-100 text-blue-800",
  long: "bg-purple-100 text-purple-800",
  intermediate: "bg-green-100 text-green-800",
  other: "bg-orange-100 text-orange-800",
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
  if (days < 30) return "text-red-600";
  if (days < 90) return "text-orange-600";
  return "text-green-600";
};

export default function Inventory() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedType, setSelectedType] = useState("all");
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isDispenseModalOpen, setIsDispenseModalOpen] = useState(false);
  const [selectedMedication, setSelectedMedication] = useState(null);

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

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          Loading medications...
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <img src={logo} alt="Noor Logo" className="h-12 w-auto" />
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Insulin Inventory Management</h1>
            <p className="text-gray-600">Track and manage insulin medications for your clinic</p>
          </div>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Search className="h-5 w-5" />
            Search Insulin Medication
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
            <Input
              placeholder="Search by generic or medical name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
              data-testid="input-search-medication"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="type-filter" className="text-sm font-medium">
              Filter by Insulin Type
            </Label>
            <div className="flex flex-wrap gap-2">
              <Button
                key="all"
                variant={selectedType === "all" ? "default" : "outline"}
                size="sm"
                onClick={() => setSelectedType("all")}
                className="flex items-center gap-2"
              >
                <List className="h-4 w-4" />
                All Types
              </Button>
              {Object.entries(typeLabels).map(([type, label]) => {
                const Icon = typeIcons[type as keyof typeof typeIcons];
                return (
                  <Button
                    key={type}
                    variant={selectedType === type ? "default" : "outline"}
                    size="sm"
                    onClick={() => setSelectedType(type)}
                    className="flex items-center gap-2"
                  >
                    <Icon className="h-4 w-4" />
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
          <CardTitle className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold">Current Insulin Inventory</h2>
              <p className="text-gray-600 text-sm">Manage and track all insulin medications in your clinic</p>
            </div>
            <div className="flex gap-2">
              <Button onClick={() => setIsAddModalOpen(true)} className="flex items-center gap-2">
                <Plus className="h-4 w-4" />
                Add Medication
              </Button>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse border border-gray-300">
              <thead>
                <tr className="bg-gray-50">
                  <th className="border border-gray-300 px-4 py-3 text-left font-semibold">Medication</th>
                  {/* Administrative Form column */}
                  <th className="border border-gray-300 px-4 py-3 text-left font-semibold">Administrative Form</th>
                  <th className="border border-gray-300 px-4 py-3 text-left font-semibold">Insulin Type</th>
                  <th className="border border-gray-300 px-4 py-3 text-left font-semibold">Dose</th>
                  <th className="border border-gray-300 px-4 py-3 text-left font-semibold">Quantity</th>
                  <th className="border border-gray-300 px-4 py-3 text-left font-semibold">Expiration</th>
                  <th className="border border-gray-300 px-4 py-3 text-left font-semibold">Location</th>
                  <th className="border border-gray-300 px-4 py-3 text-center font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredMedications.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="border border-gray-300 px-4 py-8 text-center text-gray-500">
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
                      <tr key={medication.id} className={`hover:bg-gray-50 ${getRowClassName(medication.type)}`}>
                        <td className="border border-gray-300 px-4 py-3">
                          <div className="font-medium">{medication.medicalName ?? medication.genericName ?? "—"}</div>
                          {medication.genericName ? (
                            <div className="text-sm text-gray-600">({medication.genericName})</div>
                          ) : (
                            ""
                          )}
                        </td>
                        {/* Administrative Form */}
                        <td className="border border-gray-300 px-4 py-3">{adminFormDisplay}</td>
                        <td className="border border-gray-300 px-4 py-3">
                          <Badge className={`flex items-center gap-1 ${typeColors[medication.type as keyof typeof typeColors]}`}>
                            <Icon className="h-3 w-3" />
                            {typeLabels[medication.type as keyof typeof typeLabels]}
                          </Badge>
                        </td>
                        <td className="border border-gray-300 px-4 py-3">{medication.dose}</td>
                        <td className="border border-gray-300 px-4 py-3">
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{medication.quantity ?? 0}</span>
                            {(medication.quantity ?? 0) <= 5 && (
                              <Badge variant="destructive" className="text-xs">
                                Low Stock!
                              </Badge>
                            )}
                          </div>
                        </td>
                        <td className={`border border-gray-300 px-4 py-3 ${getExpirationClassName(daysUntilExpiration)}`}>
                          {medication.expirationDate ? new Date(medication.expirationDate).toLocaleDateString() : "—"}
                        </td>
                        <td className="border border-gray-300 px-4 py-3">{medication.location ?? "—"}</td>
                        <td className="border border-gray-300 px-4 py-3 text-center">
                          <Button
                            size="sm"
                            onClick={() => handleDispense(medication)}
                            className="flex items-center gap-1"
                          >
                            <Syringe className="h-3 w-3" />
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

      {/* SCROLL TARGET: Trackers section */}
      <div id="trackers-section">
        <LowStockTicker />
        <OutOfStockTracker />
      </div>

      <div className="flex justify-center space-x-4">
        {/* NEW: Scroll to trackers button */}
        <Button
          variant="secondary"
          onClick={() => {
            document
              .getElementById("trackers-section")
              ?.scrollIntoView({ behavior: "smooth" });
          }}
          className="mr-2"
        >
          Go to Stock Trackers
        </Button>

        {/* EXISTING: Transaction History */}
        <TransactionHistory />
      </div>

      <AddMedicationModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onAdd={(newMed) => {
          // Note: replace with your backend mutation; this is only local client push
          medications.push(newMed);
          setIsAddModalOpen(false);
        }}
      />

      <DispenseModal
        isOpen={isDispenseModalOpen}
        onClose={() => setIsDispenseModalOpen(false)}
        medication={selectedMedication}
      />
    </div>
  );
}
