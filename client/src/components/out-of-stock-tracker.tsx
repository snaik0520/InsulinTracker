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

  const { data: medications = [], isLoading } = useQuery({
    queryKey: ["/api/medications"],
    refetchInterval: 5000, // Refetch every 5 seconds to keep data fresh
  });

  const clearMedication = (medicationId: string) => {
    setClearedMedications(prev => new Set([...prev, medicationId]));
  };

  if (isLoading) {
    return (
      <Card className="w-full">
        <CardContent className="pt-6">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Package className="h-4 w-4" />
            Checking stock levels...
          </div>
        </CardContent>
      </Card>
    );
  }

  // Only include truly out-of-stock items with valid expiration and name, excluding cleared ones
  const outOfStockMedications = medications.filter(
    (med) =>
      (med.quantity ?? 0) === 0 &&
      med.expirationDate &&
      med.expirationDate !== "Invalid Date" &&
      med.medicalName?.trim() !== "" &&
      !clearedMedications.has(med.id)
  );

  const outOfStockCount = outOfStockMedications.length;

  return (
    <Card className="w-full">
      <CardContent className="pt-6">
        <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
          <div className="flex items-center justify-between">
            {outOfStockCount === 0 ? (
              <>
                <div className="flex items-center gap-2">
                  <Package className="h-5 w-5 text-green-600" />
                  <div>
                    <div className="font-medium text-green-900">
                      All Stock Levels Good
                    </div>
                    <div className="text-sm text-green-700">
                      No medications out of stock
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <>
                <div className="flex items-center gap-2">
                  <AlertCircle className="h-5 w-5 text-red-600" />
                  <div>
                    <div className="flex items-center gap-2">
                      <Badge variant="destructive" className="bg-red-100 text-red-800">
                        {outOfStockCount}
                      </Badge>
                      <span className="font-medium text-red-900">
                        Medication{outOfStockCount > 1 ? 's' : ''} Out of Stock
                      </span>
                    </div>
                    <div className="text-sm text-red-700">
                      {outOfStockCount === 1 ? 'One medication is' : 'Multiple medications are'} completely out of stock
                    </div>
                  </div>
                </div>
              </>
            )}

            {outOfStockCount > 0 && (
              <CollapsibleTrigger asChild>
                <Button variant="ghost" size="sm">
                  {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </Button>
              </CollapsibleTrigger>
            )}
          </div>

          {outOfStockCount > 0 && (
            <CollapsibleContent className="mt-4">
              <div className="space-y-2">
                <h4 className="text-sm font-medium text-red-900">
                  Medications Requiring Attention:
                </h4>
                
                <div className="space-y-2">
                  {outOfStockMedications.map((medication) => (
                    <div key={medication.id} className="flex items-center justify-between p-3 bg-red-50 border border-red-200 rounded-lg">
                      <div className="flex-1">
                        <div className="font-medium text-red-900">
                          {medication.medicalName}
                        </div>
                        <div className="text-sm text-red-700">
                          {medication.genericName} • {medication.dose} • {medication.location}
                        </div>
                        <div className="text-xs text-red-600 mt-1">
                          Expiration: {new Date(medication.expirationDate).toLocaleDateString()}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="destructive" className="bg-red-100 text-red-800">
                          0 left
                        </Badge>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => clearMedication(medication.id)}
                          className="h-8 w-8 p-0 text-red-400 hover:text-red-600 hover:bg-red-100"
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
