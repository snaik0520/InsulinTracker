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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

// Mock: Replace with your API calls
const addTransaction = (medicationId, type, quantity, comments) => {
  console.log("Transaction Added:", { medicationId, type, quantity, comments });
};

export default function InventoryPage() {
  const stockStatusRef = useRef(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isDispenseModalOpen, setIsDispenseModalOpen] = useState(false);
  const [isMoveModalOpen, setIsMoveModalOpen] = useState(false);
  const [selectedMedication, setSelectedMedication] = useState(null);
  const [locations, setLocations] = useState(["Fridge A", "Fridge B", "Freezer 1"]);

  // Mocked medication data
  const medications = [
    {
      id: 1,
      genericName: "Insulin Glargine",
      brandName: "",
      type: "Basal",
      dose: "10 units/mL",
      quantity: 3,
      expirationDate: "2025-09-01",
      location: "Fridge A",
    },
    {
      id: 2,
      genericName: "Insulin Aspart",
      brandName: "NovoLog",
      type: "Rapid-Acting",
      dose: "5 units/mL",
      quantity: 12,
      expirationDate: "2025-10-15",
      location: "Fridge B",
    },
  ];

  const handleDispense = (med) => {
    setSelectedMedication(med);
    setIsDispenseModalOpen(true);
  };

  const handleConfirmDispense = (medication, quantity, comments) => {
    addTransaction(medication.id, "dispense", quantity, comments);
    setIsDispenseModalOpen(false);
  };

  const handleOpenMoveModal = (med) => {
    setSelectedMedication(med);
    setIsMoveModalOpen(true);
  };

  const handleConfirmMove = (medication, quantity, newLocation) => {
    addTransaction(medication.id, "move", quantity, `Moved to ${newLocation}`);
    if (!locations.includes(newLocation)) {
      setLocations((prev) => [...prev, newLocation]);
    }
    setIsMoveModalOpen(false);
  };

  return (
    <div className="p-6">
      <main>
        <Card>
          <CardHeader>
            <CardTitle>Inventory</CardTitle>
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
                  {medications.map((medication) => {
                    const nameDisplay =
                      medication.brandName?.trim()
                        ? `${medication.genericName} (${medication.brandName})`
                        : medication.genericName;

                    return (
                      <tr key={medication.id}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          {nameDisplay}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {medication.dose}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          <span
                            className={`font-medium ${
                              medication.quantity <= 5
                                ? "text-red-600"
                                : "text-gray-900"
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
                    );
                  })}
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

      {/* Dispense Modal */}
      {isDispenseModalOpen && selectedMedication && (
        <DispenseModal
          open={isDispenseModalOpen}
          onOpenChange={(open) => {
            if (!open) setSelectedMedication(null);
            setIsDispenseModalOpen(open);
          }}
          medication={selectedMedication}
          onConfirm={handleConfirmDispense}
        />
      )}

      {/* Move Modal */}
      {isMoveModalOpen && selectedMedication && (
        <MoveModal
          open={isMoveModalOpen}
          onOpenChange={(open) => {
            if (!open) setSelectedMedication(null);
            setIsMoveModalOpen(open);
          }}
          medication={selectedMedication}
          locations={locations}
          onMove={handleConfirmMove}
        />
      )}
    </div>
  );
}

// -------- Dispense Modal --------
function DispenseModal({ open, onOpenChange, medication, onConfirm }) {
  const [quantity, setQuantity] = useState("");
  const [comments, setComments] = useState("");

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-30 flex justify-center items-center">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Dispense {medication.genericName}</CardTitle>
        </CardHeader>
        <CardContent>
          <Label>Quantity</Label>
          <Input
            type="number"
            min="1"
            max={medication.quantity}
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            required
          />
          <Label className="mt-4">Comments (optional)</Label>
          <Input
            type="text"
            value={comments}
            onChange={(e) => setComments(e.target.value)}
            placeholder="Enter any notes here..."
          />
          <div className="flex justify-end mt-4 gap-2">
            <Button variant="secondary" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (!quantity) return;
                onConfirm(medication, Number(quantity), comments);
              }}
              className="bg-green-600 hover:bg-green-700 text-white"
            >
              Confirm
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// -------- Move Modal --------
function MoveModal({ open, onOpenChange, medication, locations, onMove }) {
  const [quantity, setQuantity] = useState("");
  const [newLocation, setNewLocation] = useState("");

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-30 flex justify-center items-center">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Move {medication.genericName}</CardTitle>
        </CardHeader>
        <CardContent>
          <Label>Quantity to Move</Label>
          <Input
            type="number"
            min="1"
            max={medication.quantity}
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            required
          />

          <Label className="mt-4">Move To Location</Label>
          <Select
            onValueChange={(val) => setNewLocation(val)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select or type location" />
            </SelectTrigger>
            <SelectContent>
              {locations.map((loc, idx) => (
                <SelectItem key={idx} value={loc}>
                  {loc}
                </SelectItem>
              ))}
              <SelectItem value="__new__">Other (type new)</SelectItem>
            </SelectContent>
          </Select>
          {newLocation === "__new__" && (
            <Input
              className="mt-2"
              placeholder="Enter new location"
              value={newLocation !== "__new__" ? newLocation : ""}
              onChange={(e) => setNewLocation(e.target.value)}
            />
          )}

          <div className="flex justify-end mt-4 gap-2">
            <Button variant="secondary" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (!quantity || !newLocation || newLocation === "__new__") return;
                onMove(medication, Number(quantity), newLocation);
              }}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              Confirm
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
