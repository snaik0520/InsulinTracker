// File: client/src/pages/inventory.tsx

import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button"; // ensure Button is imported
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
    let filtered = medications.filter(med => (med.quantity ?? 0) > 0);
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(med =>
        (med.genericName ?? "").toLowerCase().includes(q) ||
        (med.medicalName ?? "").toLowerCase().includes(q)
      );
    }
    if (selectedType !== "all") {
      filtered = filtered.filter(med => med.type === selectedType);
    }
    return filtered;
  }, [medications, searchQuery, selectedType]);

  const handleDispense = (med: Medication) => {
    setSelectedMedication(med);
    setIsDispenseModalOpen(true);
  };

  const scrollToStock = () => {
    document.getElementById("stock-section")?.scrollIntoView({ behavior: "smooth" });
  };

  if (isLoading) {
    return <div>Loading medications...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Search & Filters */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
          <Input
            placeholder="Search Insulin Medication"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="pl-10"
            data-testid="input-search-medication"
          />
        </div>
        <div className="flex gap-3">
          <Button variant="secondary" onClick={scrollToStock}>
            View Low/Out of Stock
          </Button>
          <TransactionHistory />
        </div>
      </div>

      {/* Filters */}
      <div>
        <Label>Filter by Insulin Type</Label>
        <div className="flex gap-2 mt-2">
          {/* type filter buttons omitted for brevity */}
        </div>
      </div>

      {/* Inventory Table */}
      <Card>
        <CardHeader>
          <CardTitle>Current Insulin Inventory</CardTitle>
        </CardHeader>
        <CardContent>
          <table className="w-full table-auto">
            <thead> {/* headers omitted */} </thead>
            <tbody>
              {filteredMedications.length === 0
                ? <tr><td colSpan={7}>No medications found.</td></tr>
                : filteredMedications.map(med => (
                  <tr key={med.id}>
                    {/* columns omitted */}
                    <td>
                      <Button size="icon" onClick={() => handleDispense(med)}>
                        <HandHeart />
                      </Button>
                    </td>
                  </tr>
                ))
              }
            </tbody>
          </table>
        </CardContent>
      </Card>

      {/* Low/Out of Stock Section */}
      <div id="stock-section" className="space-y-4">
        <LowStockTicker />
        <OutOfStockTracker />
      </div>

      <AddMedicationModal
        open={isAddModalOpen}
        onOpenChange={setIsAddModalOpen}
        onSave={newMed => {
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
