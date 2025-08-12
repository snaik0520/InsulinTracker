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

  const { data: outOfStockMedications = [], isLoading } = useQuery<Medication[]>({
    queryKey: ["/api/medications/out-of-stock"],
    refetchInterval: 5000, // Refetch every 5 seconds to keep data fresh
  });

  if (isLoading) {
    return (
      <Card className="mt-4">
        <CardContent className="p-4">
          <div className="flex items-center justify-center py-2">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-red-500"></div>
            <span className="ml-2 text-sm text-gray-600">Checking stock status...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  const outOfStockCount = outOfStockMedications.length;

  return (
    <Card className="mt-4 border-l-4 border-l-red-500">
      <CardContent className="p-4">
        <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              {outOfStockCount === 0 ? (
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
                    <XCircle className="h-4 w-4 text-red-600" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-red-800">
                      <Badge variant="destructive" className="mr-2 bg-red-600">
                        {outOfStockCount}
                      </Badge>
                      Medication{outOfStockCount > 1 ? 's' : ''} Out of Stock
                    </p>
                    <p className="text-xs text-red-600">
                      {outOfStockCount === 1 ? 'One medication is' : 'Multiple medications are'} completely out of stock
                    </p>
                  </div>
                </>
              )}
            </div>

            {outOfStockCount > 0 && (
              <CollapsibleTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-red-600 hover:text-red-800 hover:bg-red-50"
                  data-testid="button-toggle-out-of-stock-tracker"
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

          {outOfStockCount > 0 && (
            <CollapsibleContent className="mt-4">
              <div className="border-t border-red-200 pt-4">
                <h4 className="text-sm font-medium text-red-800 mb-3 flex items-center">
                  <AlertCircle className="h-4 w-4 mr-2" />
                  Medications Completely Out of Stock:
                </h4>
                <div className="grid gap-3">
                  {outOfStockMedications.map((medication) => (
                    <div
                      key={medication.id}
                      className="flex items-center justify-between p-3 bg-red-50 rounded-lg border border-red-100 hover:bg-red-100 transition-colors"
                      data-testid={`tracker-out-of-stock-item-${medication.id}`}
                    >
                      <div className="flex-1">
                        <div className="font-medium text-gray-900 text-sm">
                          {medication.genericName}
                        </div>
                        <div className="text-xs text-gray-600">
                          {medication.medicalName} • {medication.dose} • {medication.location}
                        </div>
                        <div className="text-xs text-gray-500 mt-1">
                          Last expiration: {new Date(medication.expirationDate).toLocaleDateString()}
                        </div>
                      </div>
                      <div className="text-right ml-4">
                        <Badge 
                          variant="destructive" 
                          className="text-xs bg-red-600"
                        >
                          0 left
                        </Badge>
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