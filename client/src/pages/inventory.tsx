import { useState, useMemo, useRef } from "react";
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
import { Search, Plus, HandHeart, Syringe, Zap, Clock, Scale, HelpCircle, List, AlertTriangle } from "lucide-react";
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
  const [selectedMedication, setSelectedMedication] = useState<Medication | null>(null);
  const [showTransactionHistory, setShowTransactionHistory] = useState(false);
  
  // Add ref for low stock section
  const lowStockRef = useRef<HTMLDivElement>(null);

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

  const scrollToLowStock = () => {
    lowStockRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  if (isLoading) {
    return (
      <div className="container mx-auto px-6 py-8">
        <Card>
          <CardContent className="p-8">
            <div className="text-center">Loading medications...</div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-6 py-8">
      <div className="mb-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <img src={logo} alt="Noor Medical Clinic" className="h-10 w-auto" />
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Insulin Tracker</h1>
            <p className="text-gray-600 text-sm">Noor Medical Clinic</p>
          </div>
        </div>
        
        {/* Updated buttons section with Low Stock button */}
        <div className="flex flex-wrap gap-2">
          <Button
            onClick={scrollToLowStock}
            className="bg-red-600 hover:bg-red-700"
          >
            <AlertTriangle className="w-4 h-4 mr-2" />
            Low Stock
          </Button>
          <Button 
            onClick={() => setShowTransactionHistory(true)}
            variant="outline"
          >
            <List className="w-4 h-4 mr-2" />
            Transaction History
          </Button>
          <Button onClick={() => setIsAddModalOpen(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Add Medication
          </Button>
        </div>
      </div>

      <div className="mb-8 grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-medium flex items-center gap-2">
              <Search className="w-4 h-4" />
              Search Insulin Medication
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search by generic or brand name..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
                data-testid="input-search-medication"
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-medium flex items-center gap-2">
              <Syringe className="w-4 h-4" />
              Filter by Insulin Type
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              <Button
                key="all"
                variant={selectedType === "all" ? "default" : "outline"}
                size="sm"
                onClick={() => setSelectedType("all")}
                className="flex items-center gap-1"
              >
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
                    className="flex items-center gap-1"
                  >
                    <Icon className="w-3 h-3" />
                    {label}
                  </Button>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <HandHeart className="w-5 h-5" />
            Current Insulin Inventory
          </CardTitle>
          <p className="text-sm text-gray-600">
            Manage and track all insulin medications in your clinic
          </p>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b">
                  <th className="text-left p-2 font-medium">Medication</th>
                  {/* Administrative Form column */}
                  <th className="text-left p-2 font-medium">Administrative Form</th>
                  <th className="text-left p-2 font-medium">Insulin Type</th>
                  <th className="text-left p-2 font-medium">Dose</th>
                  <th className="text-left p-2 font-medium">Quantity</th>
                  <th className="text-left p-2 font-medium">Expiration</th>
                  <th className="text-left p-2 font-medium">Location</th>
                  <th className="text-left p-2 font-medium">Actions</th>
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

                    return (
                      <tr key={medication.id} className={`border-b hover:bg-gray-50 ${getRowClassName(medication.type)}`}>
                        <td className="p-2">
                          <div className="font-medium">{medication.medicalName ?? medication.genericName ?? "—"}</div>
                          <div className="text-sm text-gray-500">
                            {medication.genericName ? `(${medication.genericName})` : ""}
                          </div>
                        </td>

                        {/* Administrative Form */}
                        <td className="p-2">{adminFormDisplay}</td>

                        <td className="p-2">
                          <Badge className={typeColors[medication.type as keyof typeof typeColors]}>
                            <Icon className="w-3 h-3 mr-1" />
                            {typeLabels[medication.type as keyof typeof typeLabels]}
                          </Badge>
                        </td>
                        <td className="p-2">{medication.dose}</td>
                        <td className="p-2">
                          <div className="flex items-center gap-2">
                            <span>{medication.quantity ?? 0}</span>
                            {(medication.quantity ?? 0) <= 5 && (
                              <Badge variant="destructive" className="text-xs">
                                Low Stock!
                              </Badge>
                            )}
                          </div>
                        </td>
                        <td className={`p-2 ${getExpirationClassName(daysUntilExpiration)}`}>
                          {medication.expirationDate ? new Date(medication.expirationDate).toLocaleDateString() : "—"}
                        </td>
                        <td className="p-2">{medication.location ?? "—"}</td>
                        <td className="p-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleDispense(medication)}
                          >
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

      {/* Low stock trackers section with ref */}
      <div ref={lowStockRef} className="mt-8 space-y-4">
        <LowStockTicker />
        <OutOfStockTracker />
      </div>

      <AddMedicationModal
        open={isAddModalOpen}
        onOpenChange={setIsAddModalOpen}
        onSuccess={(newMed) => {
          // Note: replace with your backend mutation; this is only local client push
          medications.push(newMed);
          setIsAddModalOpen(false);
        }}
      />

      <DispenseModal
        open={isDispenseModalOpen}
        onOpenChange={setIsDispenseModalOpen}
        medication={selectedMedication}
        onSuccess={() => {
          setIsDispenseModalOpen(false);
          setSelectedMedication(null);
        }}
      />

      <TransactionHistory
        open={showTransactionHistory}
        onOpenChange={setShowTransactionHistory}
      />
    </div>
  );
}
