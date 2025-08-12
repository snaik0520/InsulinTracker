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
import { Search, Plus, HandHeart, Syringe, Zap, Clock, Scale, HelpCircle, List, Move } from "lucide-react";
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

// New MoveModal component for moving meds
function MoveModal({
  open,
  onOpenChange,
  medication,
  onMove,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  medication: Medication | null;
  onMove: (med: Medication, quantity: number, location: string, comments: string) => void;
}) {
  const [quantity, setQuantity] = useState(1);
  const [location, setLocation] = useState(medication?.location ?? "");
  const [comments, setComments] = useState("");

  if (!medication) return null;

  const maxQuantity = medication.quantity;

  const handleSubmit = () => {
    if (quantity <= 0 || quantity > maxQuantity) {
      alert(`Please enter a quantity between 1 and ${maxQuantity}`);
      return;
    }
    if (!location.trim()) {
      alert("Please enter a location to move to.");
      return;
    }
    onMove(medication, quantity, location.trim(), comments.trim());
    setQuantity(1);
    setLocation("");
    setComments("");
    onOpenChange(false);
  };

  return (
    <div
      className={`fixed inset-0 bg-black bg-opacity-30 flex items-center justify-center z-50 ${
        open ? "block" : "hidden"
      }`}
      onClick={() => onOpenChange(false)}
    >
      <div
        className="bg-white rounded-lg p-6 max-w-md w-full"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-xl font-semibold mb-4">Move Medication</h2>
        <p className="mb-2">
          Moving <strong>{medication.genericName}</strong> (Available: {medication.quantity})
        </p>

        <Label htmlFor="move-quantity" className="block mb-1 font-medium">Quantity to move</Label>
        <Input
          id="move-quantity"
          type="number"
          min={1}
          max={maxQuantity}
          value={quantity}
          onChange={(e) => setQuantity(Number(e.target.value))}
          className="mb-4"
        />

        <Label htmlFor="move-location" className="block mb-1 font-medium">Move to Location</Label>
        <Input
          id="move-location"
          placeholder="Enter new location"
          value={location}
          onChange={(e) => setLocation(e.target.value)}
          className="mb-4"
        />

        <Label htmlFor="move-comments" className="block mb-1 font-medium">Comments (optional)</Label>
        <textarea
          id="move-comments"
          placeholder="Add any comments"
          value={comments}
          onChange={(e) => setComments(e.target.value)}
          className="w-full p-2 border rounded mb-4 resize-none"
          rows={3}
        />

        <div className="flex justify-end space-x-3">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSubmit} className="bg-blue-600 hover:bg-blue-700 text-white">Move</Button>
        </div>
      </div>
    </div>
  );
}

// Extend DispenseModal usage to include comments - create wrapper or modify props
// Here, assuming you can add props to DispenseModal to handle comments and a callback:

export default function Inventory() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedType, setSelectedType] = useState("all");
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isDispenseModalOpen, setIsDispenseModalOpen] = useState(false);
  const [isMoveModalOpen, setIsMoveModalOpen] = useState(false);
  const [selectedMedication, setSelectedMedication] = useState<Medication | null>(null);

  // Ref for stock status section
  const stockStatusRef = useRef<HTMLDivElement>(null);

  const { data: medications = [], isLoading } = useQuery<Medication[]>({
    queryKey: ["/api/medications"],
  });

  // You need to provide addTransaction method (API call or state update) - mock here:
  const addTransaction = (type: "dispense" | "move", med: Medication, quantity: number, location: string, comments: string) => {
    console.log("Transaction added:", { type, medId: med.id, quantity, location, comments, date: new Date().toISOString() });
    // TODO: call your backend or update global state here to track transactions
  };

  const filteredMedications = useMemo(() => {
    let filtered = medications;

    // Filter out medications with 0 quantity
    filtered = filtered.filter(medication => medication.quantity > 0);

    // Filter by search query
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (med) =>
          med.genericName.toLowerCase().includes(query) ||
          med.medicalName.toLowerCase().includes(query)
      );
    }

    // Filter by type
    if (selectedType !== "all") {
      filtered = filtered.filter((med) => med.type === selectedType);
    }

    return filtered;
  }, [medications, searchQuery, selectedType]);

  const handleDispense = (medication: Medication) => {
    setSelectedMedication(medication);
    setIsDispenseModalOpen(true);
  };

  const handleConfirmDispense = (medication: Medication, quantity: number, comments: string) => {
    // Implement dispense logic here, e.g. update backend, inventory, etc.
    addTransaction("dispense", medication, quantity, medication.location, comments);
    setIsDispenseModalOpen(false);
    setSelectedMedication(null);
  };

  const handleOpenMoveModal = (medication: Medication) => {
    setSelectedMedication(medication);
    setIsMoveModalOpen(true);
  };

  const handleConfirmMove = (medication: Medication, quantity: number, newLocation: string, comments: string) => {
    // Implement move logic here, e.g. update backend, inventory, etc.
    addTransaction("move", medication, quantity, newLocation, comments);
    setIsMoveModalOpen(false);
    setSelectedMedication(null);
  };

  const scrollToStockStatus = () => {
    if (stockStatusRef.current) {
      stockStatusRef.current.scrollIntoView({ behavior: "smooth" });
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p>Loading medications...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gray-50 min-h-screen">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <Syringe className="h-6 w-6 text-primary mr-3" />
              <h1 className="text-xl font-semibold text-gray-900">Insulin Inventory Management</h1>
            </div>
            <div className="flex items-center space-x-4">
              <span className="text-lg text-gray-600 font-medium">SLO Noor Foundation</span>
              <img
                src={logo}
                alt="SLO Noor Foundation logo"
                className="h-16 w-auto object-contain"
                data-testid="logo"
              />
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Search and Filters */}
        <Card className="mb-8">
          <CardContent className="p-6">
            <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between space-y-4 lg:space-y-0 lg:space-x-4">
              {/* Search Bar */}
              <div className="flex-1 max-w-lg">
                <Label htmlFor="medication-search" className="block text-sm font-medium text-gray-700 mb-2">
                  Search Insulin Medication
                </Label>
                <div className="relative">
                  <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                  <Input
                    id="medication-search"
                    placeholder="Search by generic name, medical name, or brand..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                    data-testid="input-search-medication"
                  />
                </div>
              </div>

              {/* New Button to Scroll to Stock Status */}
              <div className="flex items-center gap-3">
                <Button
                  onClick={scrollToStockStatus}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white text-sm"
                  data-testid="button-scroll-stock-status"
                >
                  View Stock Status
                </Button>

                {/* Action Buttons */}
                <TransactionHistory />
                <Button
                  onClick={() => setIsAddModalOpen(true)}
                  className="bg-primary hover:bg-primary/90"
                  data-testid="button-add-medication"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add New Medication
                </Button>
              </div>
            </div>

            {/* Insulin Type Filter Buttons */}
            <div className="mt-6">
              <Label className="block text-sm font-medium text-gray-700 mb-3">Filter by Insulin Type</Label>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant={selectedType === "all" ? "default" : "outline"}
                  onClick={() => setSelectedType("all")}
                  className={`text-sm ${selectedType === "all" ? "bg-gray-200 text-gray-900" : ""}`}
                  data-testid="filter-all"
                >
                  <List className="h-4 w-4 mr-2" />
                  All Types
                </Button>
                {Object.entries(typeLabels).map(([type, label]) => {
                  const Icon = typeIcons[type as keyof typeof typeIcons];
                  // Use the color classes from typeColors for the filter buttons when selected
                  const isSelected = selectedType === type;
                  const colorClasses = typeColors[type as keyof typeof typeColors].replace("bg-", "bg-opacity-50 ") + (isSelected ? " font-semibold" : "");
                  return (
                    <Button
                      key={type}
                      variant={isSelected ? "default" : "outline"}
                      onClick={() => setSelectedType(type)}
                      className={`text-sm ${isSelected ? typeColors[type as keyof typeof typeColors] : ""}`}
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

        {/* Inventory Table */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg font-medium text-gray-900">Current Insulin Inventory</CardTitle>
            <p className="text-sm text-gray-600">Manage and track all insulin medications in your clinic</p>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Medication
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Type
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Dose
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Quantity
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Expiration
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Location
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredMedications.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-6 py-12 text-center text-gray-500">
                        {searchQuery || selectedType !== "all" 
                          ? "No medications found matching your criteria." 
                          : "No medications in inventory. Add your first medication to get started."}
                      </td>
                    </tr>
                  ) : (
                    filteredMedications.map((medication) => {
                      const daysUntilExpiration = calculateDaysUntilExpiration(medication.expirationDate);
                      const Icon = typeIcons[medication.type as keyof typeof typeIcons];
                      
                      return (
                        <tr
                          key={medication.id}
                          className={`${getRowClassName(medication.type)} hover:bg-gray-50`}
                          data-testid={`row-medication-${medication.id}`}
                        >
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div>
                              <div className="text-sm font-medium text-gray-900" data-testid="text-generic-name">
                                {medication.genericName}
                              </div>
                              <div className="text-sm text-gray-500" data-testid="text-medical-name">
                                {medication.medicalName}
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <Badge className={typeColors[medication.type as keyof typeof typeColors]}>
                              <Icon className="h-3 w-3 mr-1" />
                              {typeLabels[medication.type as keyof typeof typeLabels]}
                            </Badge>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900" data-testid="text-dose">
                            {medication.dose}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span 
                              className={`text-sm font-medium ${
                                medication.quantity <= 5 ? 'text-red-600' : 'text-gray-900'
                              }`}
                              data-testid="text-quantity"
                            >
                              {medication.quantity}
                            </span>
                            <span className="text-sm text-gray-500"> injections</span>
                            {medication.quantity <= 5 && (
                              <div className="text-xs text-red-600">Low Stock!</div>
                            )}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className="text-sm text-gray-900" data-testid="text-expiration-date">
                              {new Date(medication.expirationDate).toLocaleDateString()}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500" data-testid="text-location">
                            {medication.location}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap flex gap-2">
                            <Button
                              onClick={() => handleDispense(medication)}
                              size="sm"
                              className="bg-green-600 hover:bg-green-700 text-white"
                              disabled={medication.quantity === 0}
                              data-testid={`button-dispense-${medication.id}`}
                            >
                              <HandHeart className="h-4 w-4 mr-1" />
                              Dispense
                            </Button>
                            <Button
                              onClick={() => handleOpenMoveModal(medication)}
                              size="sm"
                              className="bg-blue-600 hover:bg-blue-700 text-white"
                              disabled={medication.quantity === 0}
                              data-testid={`button-move-${medication.id}`}
                            >
                              <Move className="h-4 w-4 mr-1" />
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

        {/* Low Stock Ticker */}
        <LowStockTicker />
        
        {/* Out of Stock Tracker */}
        <div ref={stockStatusRef} className="mt-8">
          <OutOfStockTracker />
        </div>
      </main>

      {/* Modals */}
      <AddMedicationModal
        open={isAddModalOpen}
        onOpenChange={setIsAddModalOpen}
      />
      
      {/* DispenseModal extended with comments and callback */}
      <DispenseModal
        open={isDispenseModalOpen}
        onOpenChange={(open) => {
          if (!open) setSelectedMedication(null);
          setIsDispenseModalOpen(open);
        }}
        medication={selectedMedication}
        // New props to support comments and confirm callback:
        onConfirm={(quantity, comments) => {
          if (selectedMedication) {
            handleConfirmDispense(selectedMedication, quantity, comments);
          }
        }}
      />

      {/* Move Modal */}
      <MoveModal
        open={isMoveModalOpen}
        onOpenChange={(open) => {
          if (!open) setSelectedMedication(null);
          setIsMoveModalOpen(open);
        }}
        medication={selectedMedication}
        onMove={handleConfirmMove}
      />
    </div>
  );
}
