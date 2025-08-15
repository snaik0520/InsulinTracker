import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Plus, List } from "lucide-react";
import LowStockTicker from "@/components/LowStockTicker";
import OutOfStockTracker from "@/components/OutOfStockTracker";
import TransactionHistory from "@/components/TransactionHistory";
import AddMedicationModal from "@/components/AddMedicationModal";

export default function Inventory() {
  const [searchTerm, setSearchTerm] = useState("");
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  const { data: inventory = [] } = useQuery({
    queryKey: ["inventory"],
    queryFn: async () => {
      const res = await fetch("/api/inventory");
      return res.json();
    },
  });

  const filteredInventory = useMemo(() => {
    return inventory.filter((item: any) =>
      item.medicalName.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [inventory, searchTerm]);

  const insulinTypeColors: Record<string, string> = {
    Rapid: "bg-pink-100 hover:bg-pink-200",
    Short: "bg-yellow-100 hover:bg-yellow-200",
    Intermediate: "bg-green-100 hover:bg-green-200",
    Long: "bg-blue-100 hover:bg-blue-200",
    Mixed: "bg-purple-100 hover:bg-purple-200",
  };

  const scrollToTrackers = () => {
    const el = document.getElementById("low-stock-tracker");
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  return (
    <div className="p-6 space-y-6 bg-gray-50 min-h-screen">
      <Card className="shadow-lg rounded-2xl bg-white border border-gray-200">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-2xl font-semibold text-gray-800">
            Inventory
          </CardTitle>
          <div className="flex gap-3 flex-shrink-0">
            {/* Low / Out of Stock Button */}
            <Button
              onClick={scrollToTrackers}
              size="sm"
              variant="outline"
              className="flex items-center border border-gray-300 bg-pastel-green-100 hover:bg-pastel-green-200"
              data-testid="button-jump-low-outstock"
              title="Jump to low / out of stock trackers"
            >
              <List className="h-4 w-4 mr-2" />
              Low / Out of Stock
            </Button>

            {/* View Transaction History Button */}
            <TransactionHistory
              buttonClassName="bg-pastel-purple-200 hover:bg-pastel-purple-300 text-gray-800"
            />

            {/* Add Medication Button */}
            <Button
              onClick={() => setIsAddModalOpen(true)}
              className="bg-pastel-pink-200 hover:bg-pastel-pink-300 text-gray-800"
              data-testid="button-add-medication"
            >
              <Plus className="h-4 w-4 mr-2" />
              + Add Medication
            </Button>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Search Bar */}
          <div>
            <Label htmlFor="search" className="text-gray-700">
              Search
            </Label>
            <Input
              id="search"
              placeholder="Search medications..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="border border-gray-300 focus:ring-2 focus:ring-pastel-blue-300"
            />
          </div>

          {/* Inventory Table */}
          <div className="overflow-x-auto">
            <table className="w-full border border-gray-200 rounded-lg overflow-hidden">
              <thead className="bg-gray-100 text-gray-700">
                <tr>
                  <th className="p-2 text-left">Medical Name</th>
                  <th className="p-2 text-left">Generic Name</th>
                  <th className="p-2 text-left">Insulin Type</th>
                  <th className="p-2 text-left">Quantity</th>
                  <th className="p-2 text-left">Expiration Date</th>
                </tr>
              </thead>
              <tbody>
                {filteredInventory.map((item: any, idx: number) => (
                  <tr
                    key={idx}
                    className={`${insulinTypeColors[item.insulinType] || ""} transition-colors`}
                  >
                    <td className="p-2">{item.medicalName}</td>
                    <td className="p-2">{item.genericName}</td>
                    <td className="p-2">{item.insulinType}</td>
                    <td className="p-2">{item.quantity}</td>
                    <td className="p-2">{item.expirationDate}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Trackers */}
      <div id="low-stock-tracker" className="space-y-4">
        <LowStockTicker />
        <OutOfStockTracker />
      </div>

      <AddMedicationModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
      />
    </div>
  );
}
