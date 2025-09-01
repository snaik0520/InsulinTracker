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
  const [clearedMedications, setClearedMedications] = useState<Set<string>>(new Set());
  const { data: medications = [], isLoading } = useQuery<Medication[]>({
    queryKey: ["/api/medications"],
    refetchInterval: 5000,
  });

  // Replace the existing clearMedication function with this:
const clearMedication = async (id: string) => {
  try {
    const response = await fetch(`/api/medications/${id}`, {
      method: 'DELETE',
    });
    
    if (response.ok) {
      // Optionally show success message
      console.log('Medication cleared successfully');
      // The medication will disappear from the list on the next refetch (every 5 seconds)
      // Or you can invalidate the query immediately:
      // queryClient.invalidateQueries(["/api/medications"]);
    } else {
      console.error('Failed to clear medication');
      // Handle error - maybe show a toast notification
    }
  } catch (error) {
    console.error('Error clearing medication:', error);
    // Handle network error
  }
};

// Remove the local state management since we're now using the API:
// Remove this line: const [clearedMedications, setClearedMedications] = useState<Set<string>>(new Set());

// Update the filter to remove the clearedMedications check:
const outOfStockMedications = medications.filter(
  med =>
    (med.quantity ?? 0) === 0 &&
    med.expirationDate &&
    med.expirationDate !== "Invalid Date" &&
    med.medicalName?.trim() !== ""
    // Remove: && !clearedMedications.has(med.id)
);


  const count = outOfStockMedications.length;

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
                  {outOfStockMedications.map(med => (
                    <div
                      key={med.id}
                      className="flex items-center justify-between p-3 bg-red-50 rounded-lg border border-red-100 hover:bg-red-100 transition-colors"
                      data-testid={`tracker-out-of-stock-item-${med.id}`}
                    >
                      <div className="flex-1">
                        <div className="font-medium">{med.medicalName}</div>
                        <div className="text-sm text-muted-foreground">
                          {med.genericName} • {med.dose} • All Locations
                        </div>
                        <div className="text-xs text-gray-500 mt-1">
                          Total across all locations and expiration dates
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Badge variant="destructive" className="text-xs bg-red-600">0 left</Badge>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-red-600 hover:text-red-800 hover:bg-red-50"
                          onClick={() => {
   if (window.confirm("Are you sure you want to remove this medication from the list?")) {
     clearMedication(med.id);
   }
 }}
                          title="Clear from list"
                        >
                          <XCircle className="h-4 w-4" />
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
