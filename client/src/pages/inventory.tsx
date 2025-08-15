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
  const [selectedMedication, setSelectedMedication] = useState(null);
  
  // Ref for low stock section
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

  // Function to scroll to low stock section
  const scrollToLowStock = () => {
    lowStockRef.current?.scrollIntoView({ 
      behavior: "smooth",
      block: "start"
    });
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-lg text-gray-600">Loading medications...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header with logo and action buttons */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <img src={logo} alt="Noor Clinic" className="h-12 w-auto" />
              <h1 className="text-2xl font-bold text-gray-900">Insulin Inventory Management</h1>
            </div>
            <div className="flex items-center space-x-3">
              <Button
                onClick={scrollToLowStock}
                variant="outline"
                className="flex items-center gap-2 bg-red-50 text-red-700 border-red-200 hover:bg-red-100"
              >
                <AlertTriangle className="h-4 w-4" />
                Low Stock Alert
              </Button>
              <TransactionHistory />
              <Button 
                onClick={() => setIsAddModalOpen(true)}
                className="bg-blue-600 hover:bg-blue-700 text-white flex items-center gap-2"
              >
                <Plus className="h-4 w-4" />
                Add Medication
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* Search and Filters */}
        <Card>
          <CardContent className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <Label htmlFor="search" className="text-sm font-medium text-gray-700 mb-2 block">
                  Search Insulin Medication
                </Label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                  <Input
                    id="search"
                    placeholder="Search by generic or brand name..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                    data-testid="input-search-medication"
                  />
                </div>
              </div>

              <div>
                <Label className="text-sm font-medium text-gray-700 mb-2 block">
                  Filter by Insulin Type
                </Label>
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant={selectedType === "all" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setSelectedType("all")}
                    className="flex items-center gap-1"
                  >
                    <List className="h-3 w-3" />
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
                        <Icon className="h-3 w-3" />
                        {label}
                      </Button>
                    );
                  })}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Main Inventory Table */}
        <Card>
          <CardHeader>
            <CardTitle className="text-xl font-bold text-gray-900">Current Insulin Inventory</CardTitle>
            <p className="text-sm text-gray-600">Manage and track all insulin medications in your clinic</p>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="border-b border-gray-200 bg-gray-50">
                    <th className="text-left py-3 px-4 font-medium text-gray-700">Medication</th>
                    {/* Administrative Form column */}
                    <th className="text-left py-3 px-4 font-medium text-gray-700">Administrative Form</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-700">Insulin Type</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-700">Dose</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-700">Quantity</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-700">Expiration</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-700">Location</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-700">Actions</th>
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
                        <tr key={medication.id} className={`border-b border-gray-100 hover:bg-gray-50 ${getRowClassName(medication.type)}`}>
                          <td className="py-3 px-4">
                            <div className="font-medium text-gray-900">
                              {medication.medicalName ?? medication.genericName ?? "—"}
                            </div>
                            <div className="text-sm text-gray-500">
                              {medication.genericName ? `(${medication.genericName})` : ""}
                            </div>
                          </td>

                          {/* Administrative Form */}
                          <td className="py-3 px-4 text-gray-700">{adminFormDisplay}</td>

                          <td className="py-3 px-4">
                            <Badge className={typeColors[medication.type as keyof typeof typeColors]}>
                              <Icon className="h-3 w-3 mr-1" />
                              {typeLabels[medication.type as keyof typeof typeLabels]}
                            </Badge>
                          </td>
                          <td className="py-3 px-4 text-gray-700">{medication.dose}</td>
                          <td className="py-3 px-4">
                            <span className="font-medium text-gray-900">{medication.quantity ?? 0}</span>
                            {(medication.quantity ?? 0) <= 5 && (
                              <Badge variant="destructive" className="ml-2 text-xs">
                                Low Stock!
                              </Badge>
                            )}
                          </td>
                          <td className={`py-3 px-4 ${getExpirationClassName(daysUntilExpiration)}`}>
                            {medication.expirationDate ? new Date(medication.expirationDate).toLocaleDateString() : "—"}
                          </td>
                          <td className="py-3 px-4 text-gray-700">{medication.location ?? "—"}</td>
                          <td className="py-3 px-4">
                            <Button
                              onClick={() => handleDispense(medication)}
                              size="sm"
                              variant="outline"
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

        {/* Low Stock Section - This is where the page will scroll to */}
        <div ref={lowStockRef} className="space-y-6">
          <LowStockTicker />
          <OutOfStockTracker />
        </div>
      </div>

      {/* Modals */}
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
