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

// Enhanced color scheme for better visual appeal and medical context
const typeColors = {
  rapid: "bg-red-100 text-red-800 border-red-200",
  long: "bg-blue-100 text-blue-800 border-blue-200",
  intermediate: "bg-amber-100 text-amber-800 border-amber-200",
  other: "bg-gray-100 text-gray-800 border-gray-200",
};

const typeButtonColors = {
  rapid: "bg-red-500 hover:bg-red-600 border-red-600",
  long: "bg-blue-500 hover:bg-blue-600 border-blue-600",
  intermediate: "bg-amber-500 hover:bg-amber-600 border-amber-600",
  other: "bg-gray-500 hover:bg-gray-600 border-gray-600",
};

const typeRowColors = {
  rapid: "bg-red-50/30 hover:bg-red-50/50 border-l-red-300",
  long: "bg-blue-50/30 hover:bg-blue-50/50 border-l-blue-300",
  intermediate: "bg-amber-50/30 hover:bg-amber-50/50 border-l-amber-300",
  other: "bg-gray-50/30 hover:bg-gray-50/50 border-l-gray-300",
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
  if (days < 30) return "text-red-600 font-bold";
  if (days < 90) return "text-orange-600 font-semibold";
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
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <Card className="w-96 p-8">
          <CardContent className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading medications...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <img src={logo} alt="Noor Logo" className="h-12 w-12" />
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Insulin Inventory</h1>
                <p className="text-gray-600">Clinic Medication Management</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Button
                onClick={() => setIsAddModalOpen(true)}
                className="bg-blue-600 hover:bg-blue-700 text-white px-6"
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Medication
              </Button>
              <Button
                variant="outline"
                onClick={scrollToTrackers}
                className="flex items-center gap-2"
              >
                <HandHeart className="h-4 w-4" />
                Stock Trackers
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Search and Filter Section */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Search className="h-5 w-5" />
              Search & Filter Medications
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                type="text"
                placeholder="Search by medication name..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
                data-testid="input-search-medication"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-medium text-gray-700">
                Filter by Insulin Type
              </Label>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant={selectedType === "all" ? "default" : "outline"}
                  onClick={() => setSelectedType("all")}
                  className="flex items-center gap-2 transition-all duration-200"
                >
                  <List className="h-4 w-4" />
                  All Types
                </Button>
                
                {Object.entries(typeLabels).map(([type, label]) => {
                  const Icon = typeIcons[type as keyof typeof typeIcons];
                  const isSelected = selectedType === type;
                  const buttonColors = typeButtonColors[type as keyof typeof typeButtonColors];
                  
                  return (
                    <Button
                      key={type}
                      variant={isSelected ? "default" : "outline"}
                      onClick={() => setSelectedType(type)}
                      className={`flex items-center gap-2 transition-all duration-200 ${
                        isSelected 
                          ? `text-white ${buttonColors}` 
                          : `${typeColors[type as keyof typeof typeColors]} hover:text-white ${buttonColors.split(' ').slice(1).join(' ')}`
                      }`}
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

        {/* Inventory Table */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Syringe className="h-5 w-5" />
              Current Insulin Inventory
            </CardTitle>
            <p className="text-gray-600">Manage and track all insulin medications in your clinic</p>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="min-w-full inventory-table">
                <thead>
                  <tr className="border-b bg-gray-50/50">
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">Medication</th>
                    <th className="px-4 py-3 text-center text-sm font-semibold text-gray-900">Administrative Form</th>
                    <th className="px-4 py-3 text-center text-sm font-semibold text-gray-900">Insulin Type</th>
                    <th className="px-4 py-3 text-center text-sm font-semibold text-gray-900">Dose</th>
                    <th className="px-4 py-3 text-center text-sm font-semibold text-gray-900">Quantity</th>
                    <th className="px-4 py-3 text-center text-sm font-semibold text-gray-900">Expiration</th>
                    <th className="px-4 py-3 text-center text-sm font-semibold text-gray-900">Location</th>
                    <th className="px-4 py-3 text-center text-sm font-semibold text-gray-900">Actions</th>
                  </tr>
                </thead>
                <tbody>
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
                      const daysUntilExpiration = calculateDaysUntilExpiration(medication.expirationDate);
                      const Icon = typeIcons[medication.type as keyof typeof typeIcons];

                      const adminFormValue =
                        (medication.administrativeForm as string | undefined) ||
                        (medication.formType as string | undefined) ||
                        "";
                      const adminFormDisplay =
                        adminFormValue.toLowerCase() === "pen" ? "Pen" : 
                        adminFormValue.toLowerCase() === "injection" ? "Injection" : "—";

                      return (
                        <tr 
                          key={medication.id}
                          className={`border-b transition-all duration-200 ${
                            typeRowColors[medication.type as keyof typeof typeRowColors]
                          } ${getRowClassName(medication.type)} border-l-4`}
                        >
                          {/* Medication Name */}
                          <td className="px-4 py-3">
                            <div>
                              <div className="font-medium text-gray-900">
                                {medication.medicalName ?? medication.genericName ?? "—"}
                              </div>
                              {medication.genericName && (
                                <div className="text-sm text-gray-500">
                                  ({medication.genericName})
                                </div>
                              )}
                            </div>
                          </td>

                          {/* Administrative Form */}
                          <td className="px-4 py-3 text-center font-medium">{adminFormDisplay}</td>

                          {/* Insulin Type with Enhanced Badge */}
                          <td className="px-4 py-3 text-center">
                            <Badge 
                              className={`inline-flex items-center gap-1 ${
                                typeColors[medication.type as keyof typeof typeColors]
                              } font-medium border px-3 py-1 rounded-full text-xs uppercase tracking-wide`}
                            >
                              <Icon className="h-3 w-3" />
                              {typeLabels[medication.type as keyof typeof typeLabels]}
                            </Badge>
                          </td>

                          {/* Dose */}
                          <td className="px-4 py-3 text-center font-medium">{medication.dose}</td>
                          
                          {/* Quantity */}
                          <td className="px-4 py-3 text-center">
                            <div className="flex items-center justify-center gap-2">
                              <span className={`font-medium ${
                                (medication.quantity ?? 0) <= 5 ? 'text-red-600' : 
                                (medication.quantity ?? 0) <= 10 ? 'text-orange-600' : 'text-green-600'
                              }`}>
                                {medication.quantity ?? 0}
                              </span>
                              {(medication.quantity ?? 0) <= 5 && (
                                <Badge variant="destructive" className="text-xs animate-pulse">
                                  Low Stock!
                                </Badge>
                              )}
                            </div>
                          </td>
                          
                          {/* Expiration Date */}
                          <td className="px-4 py-3 text-center">
                            <div className="flex flex-col items-center">
                              <span className={`font-medium ${getExpirationClassName(daysUntilExpiration)}`}>
                                {medication.expirationDate 
                                  ? new Date(medication.expirationDate).toLocaleDateString() 
                                  : "—"}
                              </span>
                              {medication.expirationDate && (
                                <span className={`text-xs ${
                                  daysUntilExpiration < 30 ? 'text-red-500' :
                                  daysUntilExpiration < 90 ? 'text-orange-500' : 'text-gray-500'
                                }`}>
                                  {daysUntilExpiration > 0 ? `${daysUntilExpiration} days` : 'Expired'}
                                </span>
                              )}
                            </div>
                          </td>
                          
                          {/* Location */}
                          <td className="px-4 py-3 text-center font-medium">{medication.location ?? "—"}</td>
                          
                          {/* Actions */}
                          <td className="px-4 py-3 text-center">
                            <Button
                              size="sm"
                              onClick={() => handleDispense(medication)}
                              className="bg-green-600 hover:bg-green-700 text-white transition-all duration-200 hover:scale-105"
                            >
                              <Syringe className="h-4 w-4 mr-1" />
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

        {/* Stock Trackers */}
        <div id="low-stock-ticker" className="space-y-6">
          <LowStockTicker />
          <OutOfStockTracker />
          <TransactionHistory />
        </div>
      </main>

      {/* Modals */}
      <AddMedicationModal
        open={isAddModalOpen}
        onOpenChange={setIsAddModalOpen}
        onSave={(newMed) => {
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
