import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { type Medication } from "@shared/schema";
import { AlertTriangle, ChevronDown, ChevronUp, Package, TrendingDown } from "lucide-react";

export function LowStockTicker() {
  const [isExpanded, setIsExpanded] = useState(false);

  const { data: lowStockMedications = [], isLoading } = useQuery<Medication[]>({
    queryKey: ["/api/medications/low-stock"],
    refetchInterval: 5000, // Refetch every 5 seconds to keep data fresh
  });

  if (isLoading) {
    return (
      <Card className="mt-6">
        <CardContent className="p-4">
          <div className="flex items-center justify-center py-2">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-orange-500"></div>
            <span className="ml-2 text-sm text-gray-600">Checking stock levels...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Calculate the actual number of grouped medications that will be displayed
const lowStockCount = (() => {
  type GroupVal = { totalQuantity: number; };
  const grouped = new Map<string, GroupVal>();

  lowStockMedications.forEach((med) => {
    const adminForm = (med.administrativeForm ?? "").toLowerCase();
    const insulinType = (med.insulinType ?? "").toLowerCase();
    const key = `${med.medicalName}|${adminForm}|${insulinType}|${med.dose}`;

    const cur = grouped.get(key) ?? { totalQuantity: 0 };
    cur.totalQuantity += (med.quantity ?? 0);
    grouped.set(key, cur);
  });

  // Count groups whose total across all entries is >0 and <=5
  return Array.from(grouped.values()).filter(g => g.totalQuantity > 0 && g.totalQuantity <= 5).length;
})();

  return (
    <Card className="mt-6 border-l-4 border-l-orange-500">
      <CardContent className="p-4">
        <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              {lowStockCount === 0 ? (
                <>
                  <div className="flex items-center justify-center w-8 h-8 bg-green-100 rounded-full">
                    <Package className="h-4 w-4 text-green-600" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-green-800">All Stock Levels Good</p>
                    <p className="text-xs text-green-600">No medications running low</p>
                  </div>
                </>
              ) : (
                <>
                  <div className="flex items-center justify-center w-8 h-8 bg-orange-100 rounded-full animate-pulse">
                    <TrendingDown className="h-4 w-4 text-orange-600" />
                  </div>
                  <div>
                    <div className="text-sm font-medium text-orange-800">
                      <Badge variant="destructive" className="mr-2 inline">
                        {lowStockCount}
                      </Badge>
                      <span>Medication{lowStockCount > 1 ? 's' : ''} Low on Stock</span>
                    </div>
                    <p className="text-xs text-orange-600">
                      {lowStockCount === 1 ? 'One medication needs' : 'Multiple medications need'} restocking
                    </p>
                  </div>
                </>
              )}
            </div>

            {lowStockCount > 0 && (
              <CollapsibleTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-orange-600 hover:text-orange-800 hover:bg-orange-50"
                  data-testid="button-toggle-low-stock-ticker"
                >
                  <span className="text-xs mr-1">
                    {isExpanded ? 'Hide Details' : 'View Details'}
                  </span>
                  {isExpanded ? (
                    <ChevronUp className="h-4 w-4" />
                  ) : (
                    <ChevronDown className="h-4 w-4" />
                  )}
                </Button>
              </CollapsibleTrigger>
            )}
          </div>

          {lowStockCount > 0 && (
            <CollapsibleContent className="mt-4">
              <div className="border-t border-orange-200 pt-4">
                <h4 className="text-sm font-medium text-orange-800 mb-3 flex items-center">
                  <AlertTriangle className="h-4 w-4 mr-2" />
                  Medications Requiring Attention:
                </h4>
                <div className="grid gap-3">
                  {(() => {
  // Group medications by medicalName and dose
  const grouped = new Map<string, {
    medication: typeof lowStockMedications[0] | null;
    totalQuantity: number;
    genericNames: Set<string>;
  }>();

  lowStockMedications.forEach((med) => {
    const adminForm = (med.administrativeForm ?? "").toLowerCase();
    const insulinType = (med.insulinType ?? "").toLowerCase();
    const key = `${med.medicalName}|${adminForm}|${insulinType}|${med.dose}`;

    if (!grouped.has(key)) {
      grouped.set(key, {
        medication: med,
        totalQuantity: 0,
        genericNames: new Set()
      });
    }

    const group = grouped.get(key)!;
    group.totalQuantity += (med.quantity ?? 0);
    if (med.genericName) group.genericNames.add(med.genericName);
  });

  const filteredGroups = Array.from(grouped.values()).filter(g => g.totalQuantity > 0 && g.totalQuantity <= 5);

  return filteredGroups.map((group) => (
    <div
      key={`${group.medication?.medicalName}-${group.medication?.administrativeForm}-${group.medication?.insulinType}-${group.medication?.dose}`}
      className="flex items-center justify-between p-3 bg-white rounded-lg border border-orange-200"
    >
      <div className="flex-1">
        <div className="font-medium text-gray-900">
          {group.medication?.medicalName}
        </div>
        <div className="text-sm text-gray-600 mt-1">
          {Array.from(group.genericNames).join(', ')} • {group.medication?.dose} • {group.medication?.administrativeForm ?? 'Unknown form'}
        </div>
        <div className="text-xs text-gray-500 mt-1">
          Total across inventory (locations & expiration dates ignored)
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Badge variant="secondary" className="bg-orange-100 text-orange-700">
          {group.totalQuantity} left
        </Badge>
      </div>
    </div>
  ));
})()}


                </div>
              </div>
            </CollapsibleContent>
          )}
        </Collapsible>
      </CardContent>
    </Card>
  );
}
