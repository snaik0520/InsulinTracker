import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { HandHeart } from "lucide-react";
import { type Medication } from "@shared/schema";

export default function Inventory() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedType, setSelectedType] = useState("all");

  const { data: medications = [] } = useQuery<Medication[]>({
    queryKey: ["medications"],
  });

  const filteredMedications = useMemo(() => {
    return medications.filter((med) => {
      const matchesSearch =
        med.medicalName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        med.genericName.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesType =
        selectedType === "all" || med.type.toLowerCase() === selectedType;
      return matchesSearch && matchesType;
    });
  }, [medications, searchQuery, selectedType]);

  function calculateDaysUntilExpiration(dateString: string) {
    const today = new Date();
    const expDate = new Date(dateString);
    return Math.ceil(
      (expDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
    );
  }

  function getRowClassName(type: string) {
    switch (type.toLowerCase()) {
      case "rapid":
        return "bg-blue-50";
      case "long":
        return "bg-green-50";
      default:
        return "";
    }
  }

  function handleDispense(medication: Medication) {
    // your dispense logic
  }

  return (
    <div className="p-4">
      {/* Search and Filters */}
      <div className="flex space-x-4 mb-4">
        <Input
          placeholder="Search medication..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
        <select
          value={selectedType}
          onChange={(e) => setSelectedType(e.target.value)}
          className="border rounded p-2"
        >
          <option value="all">All Types</option>
          <option value="rapid">Rapid</option>
          <option value="long">Long</option>
        </select>
      </div>

      {/* Inventory Table */}
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
                <td colSpan={8} className="px-6 py-12 text-center text-gray-500">
                  {searchQuery || selectedType !== "all"
                    ? "No medications found matching your criteria."
                    : "No medications in inventory. Add your first medication to get started."}
                </td>
              </tr>
            ) : (
              filteredMedications.map((medication) => {
                const daysUntilExpiration = calculateDaysUntilExpiration(
                  medication.expirationDate
                );

                return (
                  <tr
                    key={medication.id}
                    className={`${getRowClassName(medication.type)} hover:bg-gray-50`}
                  >
                    {/* Medication Name */}
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div>
                        <div
                          className="text-sm font-medium text-gray-900"
                          data-testid="text-medication"
                        >
                          {medication.medicalName} ({medication.genericName})
                        </div>
                      </div>
                    </td>

                    {/* Type */}
                    <td
                      className="px-6 py-4 whitespace-nowrap text-sm text-gray-500"
                      data-testid="text-type"
                    >
                      {medication.form?.toLowerCase().includes("pen")
                        ? "Pen"
                        : "Injection"}
                    </td>

                    {/* Dose */}
                    <td
                      className="px-6 py-4 whitespace-nowrap text-sm text-gray-900"
                      data-testid="text-dose"
                    >
                      {medication.dose}
                    </td>

                    {/* Quantity (number only) */}
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span
                        className={`text-sm font-medium ${
                          medication.quantity <= 5
                            ? "text-red-600"
                            : "text-gray-900"
                        }`}
                        data-testid="text-quantity"
                      >
                        {medication.quantity}
                      </span>
                      {medication.quantity <= 5 && (
                        <div className="text-xs text-red-600">Low Stock!</div>
                      )}
                    </td>

                    {/* Expiration */}
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span
                        className="text-sm text-gray-900"
                        data-testid="text-expiration-date"
                      >
                        {new Date(medication.expirationDate).toLocaleDateString()}
                      </span>
                    </td>

                    {/* Location */}
                    <td
                      className="px-6 py-4 whitespace-nowrap text-sm text-gray-500"
                      data-testid="text-location"
                    >
                      {medication.location}
                    </td>

                    {/* Actions */}
                    <td className="px-6 py-4 whitespace-nowrap">
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
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
