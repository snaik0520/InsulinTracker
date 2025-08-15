import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import LowStockTicker from "@/components/low-stock-ticker"; // ✅ Fixed case for Linux

// Pastel color mapping for insulin types
const insulinTypeColors: Record<string, string> = {
  Rapid: "bg-pastel-pink",
  Short: "bg-pastel-yellow",
  Intermediate: "bg-pastel-green",
  Long: "bg-pastel-blue",
  Mixed: "bg-pastel-purple",
};

export default function Inventory() {
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState("");
  const { data: medications } = useQuery(["inventory"], fetchInventory);

  const filteredMeds = useMemo(() => {
    return medications?.filter(
      (med) =>
        med.name.toLowerCase().includes(search.toLowerCase()) &&
        (filterType === "" || med.insulinType === filterType)
    );
  }, [medications, search, filterType]);

  return (
    <div className="p-4 bg-pastel-gray min-h-screen">
      {/* Low Stock Tracker */}
      <LowStockTicker />

      {/* Header */}
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-3xl font-bold text-pastel-navy">Inventory</h1>
        <div className="flex gap-2">
          <Button className="bg-pastel-teal hover:bg-pastel-teal-dark text-white font-semibold px-4 py-2 rounded-lg">
            + Add Medication
          </Button>
          <Button className="bg-pastel-orange hover:bg-pastel-orange-dark text-white font-semibold px-4 py-2 rounded-lg">
            View Transaction History
          </Button>
        </div>
      </div>

      {/* Search & Filters */}
      <div className="flex gap-4 items-end mb-4">
        <div>
          <Label htmlFor="search" className="text-pastel-navy font-semibold">
            Search
          </Label>
          <Input
            id="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="border-pastel-navy focus:ring-pastel-teal"
            placeholder="Search medications..."
          />
        </div>

        <div>
          <Label className="text-pastel-navy font-semibold">Filter by Type</Label>
          <div className="flex gap-2">
            {Object.keys(insulinTypeColors).map((type) => (
              <Button
                key={type}
                onClick={() => setFilterType(type)}
                className={`px-3 py-1 rounded-lg ${
                  insulinTypeColors[type]
                } hover:${insulinTypeColors[type]} text-black ${
                  filterType === type ? "ring-2 ring-pastel-navy" : ""
                }`}
              >
                {type}
              </Button>
            ))}
            <Button
              onClick={() => setFilterType("")}
              className="bg-pastel-gray hover:bg-pastel-gray-dark px-3 py-1 rounded-lg"
            >
              All
            </Button>
          </div>
        </div>
      </div>

      {/* Inventory List */}
      <Card className="shadow-lg">
        <CardHeader className="bg-pastel-navy text-white rounded-t-lg">
          <CardTitle>Medication List</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {filteredMeds?.map((med) => (
            <div
              key={med.id}
              className={`flex justify-between items-center px-4 py-2 border-b last:border-none ${
                insulinTypeColors[med.insulinType] || ""
              }`}
            >
              <span className="font-medium">{med.name}</span>
              <Badge variant="outline">{med.insulinType}</Badge>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

// Pastel Tailwind custom colors (add to tailwind.config.js)
const pastelColors = `
  .bg-pastel-pink { background-color: #f8d7da; }
  .bg-pastel-yellow { background-color: #fff3cd; }
  .bg-pastel-green { background-color: #d4edda; }
  .bg-pastel-blue { background-color: #d1ecf1; }
  .bg-pastel-purple { background-color: #e2d6f5; }
  .bg-pastel-gray { background-color: #f7f7f7; }
  .bg-pastel-navy { background-color: #6c7b95; }
  .bg-pastel-teal { background-color: #77c7c7; }
  .bg-pastel-teal-dark { background-color: #5bb0b0; }
  .bg-pastel-orange { background-color: #f7c59f; }
  .bg-pastel-orange-dark { background-color: #f6a97b; }
  .bg-pastel-gray-dark { background-color: #e2e2e2; }
  .text-pastel-navy { color: #4a5568; }
`;
