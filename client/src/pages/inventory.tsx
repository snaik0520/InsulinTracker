import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { TransactionHistory } from "./transaction-history";
import { LowStockTicker } from "./low-stock-ticker";
import { OutOfStockTracker } from "./out-of-stock-tracker";
import { Plus, List } from "lucide-react";

export default function Inventory() {
  const [searchTerm, setSearchTerm] = useState("");
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  const { data: medications } = useQuery({
    queryKey: ["medications"],
    queryFn: async () => {
      const res = await fetch("/api/medications");
      return res.json();
    },
  });

  const filteredMedications = useMemo(() => {
    return medications?.filter((med: any) =>
      med.name.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [medications, searchTerm]);

  const scrollToTrackers = () => {
    const trackerSection = document.getElementById("trackers-section");
    if (trackerSection) {
      trackerSection.scrollIntoView({ behavior: "smooth" });
    }
  };

  // Pastel colors for each insulin type
  const insulinColors: Record<string, string> = {
    Rapid: "bg-pastel-pink hover:bg-pastel-pink-hover",
    Short: "bg-pastel-blue hover:bg-pastel-blue-hover",
    Intermediate: "bg-pastel-green hover:bg-pastel-green-hover",
    Long: "bg-pastel-purple hover:bg-pastel-purple-hover",
    Mixed: "bg-pastel-orange hover:bg-pastel-orange-hover",
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <CardTitle className="text-3xl font-semibold text-gray-700">
          Medication Inventory
        </CardTitle>
        <div className="flex gap-3 flex-shrink-0">
          <Button
            onClick={scrollToTrackers}
            size="sm"
            className="flex items-center bg-pastel-yellow hover:bg-pastel-yellow-hover text-gray-800"
            data-testid="button-jump-low-outstock"
            title="Jump to low / out of stock trackers"
          >
            <List className="h-4 w-4 mr-2" />
            Low / Out of Stock
          </Button>
          <TransactionHistory />
          <Button
            onClick={() => setIsAddModalOpen(true)}
            className="bg-pastel-teal hover:bg-pastel-teal-hover text-gray-800"
            data-testid="button-add-medication"
          >
            <Plus className="h-4 w-4 mr-2" />
            Add New Medication
          </Button>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <Label htmlFor="search" className="text-gray-600 font-medium">
          Search:
        </Label>
        <Input
          id="search"
          placeholder="Type to filter medications..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="border-pastel-blue focus:border-pastel-blue-hover"
        />
      </div>

      {/* Filter buttons */}
      <div className="flex gap-2 flex-wrap">
        {Object.keys(insulinColors).map((type) => (
          <Button
            key={type}
            size="sm"
            className={`${insulinColors[type]} text-gray-800`}
          >
            {type}
          </Button>
        ))}
      </div>

      {/* Inventory list */}
      <div className="space-y-3">
        {filteredMedications?.map((med: any) => (
          <Card
            key={med.id}
            className={`shadow-sm border ${insulinColors[med.insulinType] || ""}`}
          >
            <CardHeader className="flex justify-between items-center">
              <CardTitle className="text-lg font-semibold text-gray-700">
                {med.name}
              </CardTitle>
              <Badge
                className="bg-white/60 text-gray-700 border border-gray-300"
              >
                {med.insulinType}
              </Badge>
            </CardHeader>
            <CardContent className="text-gray-600">
              Quantity: {med.quantity} | Exp: {med.expirationDate}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Trackers */}
      <div id="trackers-section" className="space-y-4 pt-6">
        <LowStockTicker />
        <OutOfStockTracker />
      </div>
    </div>
  );
}
