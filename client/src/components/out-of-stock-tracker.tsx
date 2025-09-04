import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { type Medication } from "@shared/schema";
import { AlertCircle, ChevronDown, ChevronUp, Package, XCircle } from "lucide-react";

export function OutOfStockTracker() {
  const [isExpanded, setIsExpanded] = useState(false);

  const { data: medications = [], isLoading } = useQuery<Medication[]>({
    queryKey: ["/api/medications"],
    refetchInterval: 5000,
  });

  // Clear single medication row by id (preserves existing clear behavior)
  const clearMedication = async (id: string) => {
    try {
      const response = await fetch(`/api/medications/${id}`, {
        method: 'DELETE',
      });
      
      if (response.ok) {
        console.log('Medication cleared successfully');
        // The medication will disappear on next refetch
      } else {
        console.error('Failed to clear medication');
      }
    } catch (error) {
      console.error('Error clearing medication:', error);
    }
  };

  // Group all medications by medicalName + administrativeForm + insulinType + dose,
  // sum quantities across all entries (ignore location & expiration).
  const groupedTotalsByKey = (() => {
    type GroupShape = {
      exampleMedication: Medication | null;
      totalQuantity: number;
      genericNames: Set<string>;
      ids: string[]; // all ids that belong to this group (across locations/expirations)
    };

    const map = new Map<string, GroupShape>();

    medications.forEach((med) => {
      const name = (med.medicalName ?? "").toString().trim();
      if (!name) return; // skip unnamed items

      const admin = (med.administrativeForm ?? "").toString().toLowerCase();
      const insulin = (med.insulinType ?? "").toString().toLowerCase();
      const dose = (med.dose ?? "").toString();

      // KEY intentionally excludes location and expirationDate
      const key = `${name}|${admin}|${insulin}|${dose}`;

      if (!map.has(key)) {
        map.set(key, {
          exampleMedication: med,
          totalQuantity: 0,
          genericNames: new Set<string>(),
          ids: [],
        });
      }

      const group = map.get(key)!;
      group.totalQuantity += (typeof med.quantity === "number" ? med.quantity : (parseFloat((med.quantity as any) ?? "0") || 0));
      if (med.id) group.ids.push(med.id);
      if (med.genericName) group.genericNames.add(med.genericName);
    });

    return map;
  })();

  // Build an array of groups that are truly out of stock (totalQuantity === 0)
  const outOfStockGroups = Array.from(groupedTotalsByKey.values()).filter(g => g.totalQuantity === 0);

  // The number shown in the ticker should be number of distinct groups
  const count = outOfStockGroups.length;

  if (isLoading) {
    return (
      <Card className="mt-4">
        <CardContent className="p-4">
          <div className="flex items-center justify-center py-2">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-red-500"></div>
            <span className="ml-2 text-sm text-gray-600">Checking stock status…</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="mt-4 border-l-4 border-l-red-500">
      <CardContent className="p-4">
        <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              {count === 0 ? (
                <>
                  <div className="flex items-center justify-center w-8 h-8 bg-green-100 rounded-full">
                    <Package className="h-4 w-4 text-green-600" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-green-800">No Medications Out of Stock</p>
                    <p className="text-xs text-green-600">All medications have inventory</p>
                  </div>
                </>
              ) : (
                <>
                  <div className="flex items-center justify-center w-8 h-8 bg-red-100 rounded-full animate-pulse">
                    <AlertCircle className="h-4 w-4 text-red-600" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-red-800 flex items-center">
                      <Badge variant="destructive" className="mr-2 bg-red-600">{count}</Badge>
                      Medication{count > 1 ? "s" : ""} Out of Stock
                    </p>
                    <p className="text-xs text-red-600">
                      {count === 1 ? "One medication is" : "Multiple medications are"} completely out of stock
                    </p>
                  </div>
                </>
              )}
            </div>
            {count > 0 && (
              <CollapsibleTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-red-600 hover:text-red-800 hover:bg-red-50"
                  data-testid="button-toggle-out-of-stock-tracker"
                >
                  <span className="text-xs mr-1">{isExpanded ? "Hide Details" : "View Details"}</span>
                  {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </Button>
              </CollapsibleTrigger>
            )}
          </div>

          {count > 0 && (
            <CollapsibleContent className="mt-4">
              <div className="border-t border-red-200 pt-4">
                <h4 className="text-sm font-medium text-red-800 mb-3 flex items-center">
                  <AlertCircle className="h-4 w-4 mr-2" />
                  Medications Completely Out of Stock:
                </h4>
                <div className="space-y-3">
                  {outOfStockGroups.map((group) => (
                    <div
                      key={`${group.exampleMedication?.medicalName ?? "unknown"}-${group.exampleMedication?.administrativeForm ?? "unknown"}-${group.exampleMedication?.insulinType ?? "unknown"}-${group.exampleMedication?.dose ?? "unknown"}`}
                      className="flex items-center justify-between p-3 bg-white rounded-lg border border-red-200"
                    >
                      <div className="flex-1">
                        <div className="font-medium text-gray-900">
                          {group.exampleMedication?.medicalName}
                        </div>
                        <div className="text-sm text-gray-600 mt-1">
                          {Array.from(group.genericNames).join(", ") || "No generic name"} • {group.exampleMedication?.dose} • All Locations • { (group.exampleMedication?.administrativeForm ?? "").toString() }
                        </div>
                        <div className="text-xs text-gray-500 mt-1">
                          Total across all locations and expiration dates
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary" className="bg-red-100 text-red-700">
                          0 left
                        </Badge>
                        <Button 
                          variant="outline" 
                          size="sm" 
                          onClick={() => {
                            // Clear all entries for this medication group
                            group.ids.forEach(id => clearMedication(id));
                          }}
                          className="text-red-600 border-red-200 hover:bg-red-50"
                        >
                          Clear
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </CollapsibleContent>
          )}
        </Collapsible>
      </CardContent>
    </Card>
  );
}
