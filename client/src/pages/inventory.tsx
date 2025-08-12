import { useState, useMemo, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { HandHeart, Move } from "lucide-react";
import AddMedicationModal from "./AddMedicationModal";
import DispenseModal from "./DispenseModal";
import MoveModal from "./MoveModal";
import LowStockTicker from "./LowStockTicker";
import OutOfStockTracker from "./OutOfStockTracker";

export default function InventoryPage() {
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isDispenseModalOpen, setIsDispenseModalOpen] = useState(false);
  const [isMoveModalOpen, setIsMoveModalOpen] = useState(false);
  const [selectedMedication, setSelectedMedication] = useState(null);
  const stockStatusRef = useRef(null);

  const { data: medications = [], isLoading } = useQuery({
    queryKey: ["medications"],
    queryFn: async () => {
      const res = await fetch("/api/medications");
      return res.json();
    },
  });

  const handleDispense = (medication) => {
    setSelectedMedication(medication);
    setIsDispenseModalOpen(true);
  };

  const handleOpenMoveModal = (medication) => {
    setSelectedMedication(medication);
    setIsMoveModalOpen(true);
  };

  const handleConfirmDispense = (medication, quantity, comments) => {
    // Update medication quantity in backend
    fetch(`/api/medications/${medication.id}/dispense`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ quantity, comments }),
    });
  };

  const handleConfirmMove = (medication, newLocation) => {
    fetch(`/api/medications/${medication.id}/move`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ newLocation }),
    });
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
                      Expiration Date
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Location
                    </th>
                    <th className="px-6 py-3"></th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {isLoading ? (
                    <tr>
                      <td colSpan="7" className="text-center py-4">
                        Loading...
                      </td>
                    </tr>
                  ) : (
                    medications.map((medication) => {
                      const displayName = medication.brandName
                        ? `${medication.genericName} (${medication.brandName})`
                        : medication.genericName;

                      return (
                        <tr key={medication.id}>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                            {displayName}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {medication.type}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {medication.dose}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            <span
                              className={`${
                                medication.quantity <= 5
                                  ? "text-red-600 font-semibold"
                                  : ""
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
                            <span
                              className="text-sm text-gray-900"
                              data-testid="text-expiration-date"
                            >
                              {new Date(
                                medication.expirationDate
                              ).toLocaleDateString()}
                            </span>
                          </td>
                          <td
                            className="px-6 py-4 whitespace-nowrap text-sm text-gray-500"
                            data-testid="text-location"
                          >
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

      <DispenseModal
        open={isDispenseModalOpen}
        onOpenChange={(open) => {
          if (!open) setSelectedMedication(null);
          setIsDispenseModalOpen(open);
        }}
        medication={selectedMedication}
        onConfirm={(quantity, comments) => {
          if (selectedMedication) {
            handleConfirmDispense(selectedMedication, quantity, comments);
          }
        }}
      />

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
