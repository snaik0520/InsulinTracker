import { useState, useMemo, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { HandHeart, Move } from "lucide-react";
import LowStockTicker from "./LowStockTicker";
import OutOfStockTracker from "./OutOfStockTracker";
import AddMedicationModal from "./AddMedicationModal";

// Dummy data fetching
const fetchMedications = async () => {
  // Replace with real API
  return [
    {
      id: 1,
      genericName: "Insulin Glargine",
      brandName: "Lantus",
      insulinType: "Basal",
      dose: "100 units/mL",
      quantity: 10,
      expirationDate: "2025-12-31",
      location: "Main Fridge",
    },
    {
      id: 2,
      genericName: "Insulin Lispro",
      brandName: "",
      insulinType: "Bolus",
      dose: "100 units/mL",
      quantity: 4,
      expirationDate: "2024-08-15",
      location: "Backup Storage",
    },
  ];
};

export default function InventoryPage() {
  const { data: medications = [] } = useQuery(["medications"], fetchMedications);

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isDispenseModalOpen, setIsDispenseModalOpen] = useState(false);
  const [isMoveModalOpen, setIsMoveModalOpen] = useState(false);
  const [selectedMedication, setSelectedMedication] = useState<any>(null);
  const [transactions, setTransactions] = useState<any[]>([]);
  const stockStatusRef = useRef<HTMLDivElement>(null);

  const allLocations = useMemo(
    () => Array.from(new Set(medications.map((m) => m.location))).filter(Boolean),
    [medications]
  );

  const handleDispense = (medication: any) => {
    setSelectedMedication(medication);
    setIsDispenseModalOpen(true);
  };

  const handleConfirmDispense = (medication: any, quantity: number, comments: string) => {
    const newQuantity = medication.quantity - quantity;
    // Update med list in real app
    setTransactions((prev) => [
      ...prev,
      {
        id: Date.now(),
        type: "dispense",
        medication: medication.genericName,
        brandName: medication.brandName,
        quantity,
        comments: comments || "",
        date: new Date(),
      },
    ]);
    setIsDispenseModalOpen(false);
  };

  const handleOpenMoveModal = (medication: any) => {
    setSelectedMedication(medication);
    setIsMoveModalOpen(true);
  };

  const handleConfirmMove = (medication: any, quantity: number, newLocation: string) => {
    // Update med list in real app
    setTransactions((prev) => [
      ...prev,
      {
        id: Date.now(),
        type: "move",
        medication: medication.genericName,
        brandName: medication.brandName,
        quantity,
        toLocation: newLocation,
        date: new Date(),
      },
    ]);
    setIsMoveModalOpen(false);
  };

  return (
    <div className="p-6">
      <header className="flex justify-between mb-6">
        <h1 className="text-2xl font-bold">Inventory</h1>
        <Button onClick={() => setIsAddModalOpen(true)}>Add Medication</Button>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Medications</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Dose</th>
                  <th>Quantity</th>
                  <th>Expiration</th>
                  <th>Location</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {medications.map((medication) => (
                  <tr key={medication.id}>
                    <td>
                      {medication.genericName}
                      {medication.brandName
                        ? ` (${medication.brandName})`
                        : ""}
                    </td>
                    <td>{medication.dose}</td>
                    <td>
                      {medication.quantity}
                      {medication.quantity <= 5 && (
                        <div className="text-xs text-red-600">Low Stock!</div>
                      )}
                    </td>
                    <td>{new Date(medication.expirationDate).toLocaleDateString()}</td>
                    <td>{medication.location}</td>
                    <td className="flex gap-2">
                      <Button
                        onClick={() => handleDispense(medication)}
                        size="sm"
                        className="bg-green-600 hover:bg-green-700 text-white"
                        disabled={medication.quantity === 0}
                      >
                        <HandHeart className="h-4 w-4 mr-1" />
                        Dispense
                      </Button>
                      <Button
                        onClick={() => handleOpenMoveModal(medication)}
                        size="sm"
                        className="bg-blue-600 hover:bg-blue-700 text-white"
                        disabled={medication.quantity === 0}
                      >
                        <Move className="h-4 w-4 mr-1" />
                        Move
                      </Button>
                    </td>
                  </tr>
                ))}
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

      {/* Add Modal */}
      <AddMedicationModal open={isAddModalOpen} onOpenChange={setIsAddModalOpen} />

      {/* Dispense Modal */}
      {isDispenseModalOpen && (
        <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50">
          <Card className="p-4 w-full max-w-md">
            <CardHeader>
              <CardTitle>
                Dispense {selectedMedication?.genericName}
                {selectedMedication?.brandName
                  ? ` (${selectedMedication.brandName})`
                  : ""}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Label>Quantity</Label>
              <Input
                type="number"
                min={1}
                max={selectedMedication?.quantity}
                defaultValue={1}
                onChange={(e) =>
                  setSelectedMedication((prev: any) => ({
                    ...prev,
                    dispenseQty: parseInt(e.target.value),
                  }))
                }
              />
              <Label className="mt-4">Comments (optional)</Label>
              <textarea
                className="border rounded w-full p-2 mt-1"
                rows={3}
                onChange={(e) =>
                  setSelectedMedication((prev: any) => ({
                    ...prev,
                    dispenseComment: e.target.value,
                  }))
                }
              />
              <div className="mt-4 flex justify-end gap-2">
                <Button
                  onClick={() =>
                    handleConfirmDispense(
                      selectedMedication,
                      selectedMedication?.dispenseQty || 1,
                      selectedMedication?.dispenseComment || ""
                    )
                  }
                >
                  Confirm
                </Button>
                <Button variant="secondary" onClick={() => setIsDispenseModalOpen(false)}>
                  Cancel
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Move Modal */}
      {isMoveModalOpen && (
        <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50">
          <Card className="p-4 w-full max-w-md">
            <CardHeader>
              <CardTitle>
                Move {selectedMedication?.genericName}
                {selectedMedication?.brandName
                  ? ` (${selectedMedication.brandName})`
                  : ""}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Label>Quantity to Move</Label>
              <Input
                type="number"
                min={1}
                max={selectedMedication?.quantity}
                value={selectedMedication?.moveQty || ""}
                onChange={(e) =>
                  setSelectedMedication((prev: any) => ({
                    ...prev,
                    moveQty: e.target.value,
                  }))
                }
                required
              />

              <Label className="mt-4">New Location</Label>
              <select
                className="border rounded w-full p-2 mt-1"
                value={selectedMedication?.newLocation || ""}
                onChange={(e) =>
                  setSelectedMedication((prev: any) => ({
                    ...prev,
                    newLocation: e.target.value,
                  }))
                }
              >
                <option value="">-- Select or type new --</option>
                {allLocations.map((loc) => (
                  <option key={loc} value={loc}>
                    {loc}
                  </option>
                ))}
              </select>
              <Input
                placeholder="Or type new location"
                className="mt-2"
                onChange={(e) =>
                  setSelectedMedication((prev: any) => ({
                    ...prev,
                    newLocation: e.target.value,
                  }))
                }
              />

              <div className="mt-4 flex justify-end gap-2">
                <Button
                  onClick={() =>
                    selectedMedication?.moveQty &&
                    selectedMedication?.newLocation &&
                    handleConfirmMove(
                      selectedMedication,
                      parseInt(selectedMedication.moveQty),
                      selectedMedication.newLocation
                    )
                  }
                >
                  Confirm
                </Button>
                <Button variant="secondary" onClick={() => setIsMoveModalOpen(false)}>
                  Cancel
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
