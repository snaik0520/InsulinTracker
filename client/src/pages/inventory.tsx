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
import { Search, Plus, List } from "lucide-react";

export default function Inventory() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedType, setSelectedType] = useState("all");
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isDispenseModalOpen, setIsDispenseModalOpen] = useState(false);
  const [selectedMedication, setSelectedMedication] = useState<Medication | null>(null);
  const lowStockRef = useRef<HTMLDivElement>(null);

  const { data: medications = [], isLoading } = useQuery({
    queryKey: ["/api/medications"],
  });

  const filteredMedications = useMemo(() => {
    let filtered = medications.filter((med) => (med.quantity ?? 0) > 0);
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (med) =>
          (med.genericName ?? "").toLowerCase().includes(q) ||
          (med.medicalName ?? "").toLowerCase().includes(q)
      );
    }
    if (selectedType !== "all") {
      filtered = filtered.filter((med) => med.type === selectedType);
    }
    return filtered;
  }, [medications, searchQuery, selectedType]);

  const handleDispense = (med: Medication) => {
    setSelectedMedication(med);
    setIsDispenseModalOpen(true);
  };

  const scrollToStock = () => {
    lowStockRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  if (isLoading) return <div>Loading medications...</div>;

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-4 space-x-4">
        <Input
          placeholder="Search Insulin Medication"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10"
          data-testid="input-search-medication"
        />
        <Button onClick={() => setIsAddModalOpen(true)} data-testid="button-add-medication">
          <Plus className="w-4 h-4 mr-1" /> Add Medication
        </Button>
        {/* New Button */}
        <Button variant="secondary" onClick={scrollToStock} data-testid="button-stock-alerts">
          <List className="w-4 h-4 mr-1" /> Stock Alerts
        </Button>
        <TransactionHistory />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Current Insulin Inventory</CardTitle>
        </CardHeader>
        <CardContent>
          <table className="w-full table-auto">
            <thead>
              <tr>
                <th>Medication</th>
                <th>Form</th>
                <th>Type</th>
                <th>Dose</th>
                <th>Quantity</th>
                <th>Expiration</th>
                <th>Location</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredMedications.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-4">
                    No medications found.
                  </td>
                </tr>
              ) : (
                filteredMedications.map((med) => (
                  <tr key={med.id}>
                    <td>{med.medicalName} ({med.genericName})</td>
                    <td>{med.administrativeForm || "—"}</td>
                    <td>{med.type}</td>
                    <td>{med.dose}</td>
                    <td>
                      {med.quantity}
                      {med.quantity <= 5 && <Badge variant="destructive">Low</Badge>}
                    </td>
                    <td>{new Date(med.expirationDate).toLocaleDateString()}</td>
                    <td>{med.location}</td>
                    <td>
                      <Button size="sm" onClick={() => handleDispense(med)}>
                        Dispense
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <div ref={lowStockRef} className="mt-8 space-y-4">
        <LowStockTicker />
        <OutOfStockTracker />
      </div>

      <AddMedicationModal open={isAddModalOpen} onOpenChange={setIsAddModalOpen} />
      <DispenseModal
        open={isDispenseModalOpen}
        onOpenChange={setIsDispenseModalOpen}
        medication={selectedMedication}
      />
    </div>
  );
}
