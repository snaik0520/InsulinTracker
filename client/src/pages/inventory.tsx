import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Plus, List } from "lucide-react";
import TransactionHistory from "@/components/transaction-history";
import LowStockTicker from "@/components/low-stock-ticker";
import OutOfStockTracker from "@/components/out-of-stock-tracker";

// Pastel color mapping for insulin types
const insulinTypeColors: Record<string, { base: string; hover: string }> = {
  "Rapid Acting": { base: "#FADADD", hover: "#F7C6CB" },
  "Long Acting": { base: "#D6EAF8", hover: "#AED6F1" },
  "Intermediate": { base: "#FCF3CF", hover: "#F9E79F" },
  "Other": { base: "#E8DAEF", hover: "#D2B4DE" },
};

export default function Inventory() {
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState("");
  const { data: medications = [] } = useQuery({ queryKey: ["medications"] });

  const scrollToTrackers = () => {
    const trackerElement = document.getElementById("low-stock-tracker");
    if (trackerElement) {
      trackerElement.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  const filteredMeds = useMemo(() => {
    return medications.filter((med) => {
      const matchesSearch =
        med.name.toLowerCase().includes(search.toLowerCase()) ||
        med.genericName.toLowerCase().includes(search.toLowerCase());
      const matchesType = filterType ? med.insulinType === filterType : true;
      return matchesSearch && matchesType;
    });
  }, [medications, search, filterType]);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-lg font-semibold text-gray-800">Inventory</CardTitle>
          <div className="flex gap-3 flex-shrink-0">
            <Button
              onClick={scrollToTrackers}
              size="sm"
              className="flex items-center text-gray-700"
              style={{ backgroundColor: "#E8F6F3" }}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#D1F2EB")}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "#E8F6F3")}
              data-testid="button-jump-low-outstock"
            >
              <List className="h-4 w-4 mr-2" />
              Low / Out of Stock
            </Button>

            <TransactionHistory />

            <Button
              onClick={() => setIsAddModalOpen(true)}
              className="flex items-center text-white"
              style={{ backgroundColor: "#F5CBA7" }}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#EDBB99")}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "#F5CBA7")}
              data-testid="button-add-medication"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add New Medication
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-3">
            <Input
              placeholder="Search medications..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="border-gray-300 focus:border-gray-400"
            />
          </div>

          {/* Filter buttons */}
          <div className="flex gap-2 flex-wrap">
            {Object.keys(insulinTypeColors).map((type) => (
              <Button
                key={type}
                onClick={() => setFilterType(filterType === type ? "" : type)}
                className="text-gray-800"
                style={{
                  backgroundColor: insulinTypeColors[type].base,
                  border:
                    filterType === type
                      ? "2px solid rgba(0,0,0,0.3)"
                      : "1px solid rgba(0,0,0,0.1)",
                }}
                onMouseEnter={(e) =>
                  (e.currentTarget.style.backgroundColor = insulinTypeColors[type].hover)
                }
                onMouseLeave={(e) =>
                  (e.currentTarget.style.backgroundColor = insulinTypeColors[type].base)
                }
              >
                {type}
              </Button>
            ))}
          </div>

          {/* Inventory Table */}
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm border-collapse">
              <thead>
                <tr className="bg-gray-100 text-gray-700">
                  <th className="p-2 text-left">Medical Name</th>
                  <th className="p-2 text-left">Generic Name</th>
                  <th className="p-2 text-left">Insulin Type</th>
                  <th className="p-2 text-left">Dose</th>
                  <th className="p-2 text-left">Quantity</th>
                  <th className="p-2 text-left">Expiration Date</th>
                  <th className="p-2 text-left">Location</th>
                </tr>
              </thead>
              <tbody>
                {filteredMeds.map((med) => (
                  <tr
                    key={med.id}
                    style={{
                      backgroundColor:
                        insulinTypeColors[med.insulinType]?.base || "#F8F9F9",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor =
                        insulinTypeColors[med.insulinType]?.hover || "#E5E8E8";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor =
                        insulinTypeColors[med.insulinType]?.base || "#F8F9F9";
                    }}
                  >
                    <td className="p-2">{med.name}</td>
                    <td className="p-2">{med.genericName}</td>
                    <td className="p-2">{med.insulinType}</td>
                    <td className="p-2">{med.dose}</td>
                    <td className="p-2">{med.quantity}</td>
                    <td className="p-2">{med.expirationDate}</td>
                    <td className="p-2">{med.location}</td>
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
    </div>
  );
}
