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
    refetchInterval: 5000,
  });

  const clearMedication = (medicationId: string) => {
    setClearedMedications(prev => new Set([...prev, medicationId]));
  };

  // Only include truly out-of-stock items with valid expiration and name, excluding cleared ones
  const outOfStockMedications = medications.filter(
    (med) =>
      (med.quantity ?? 0) === 0 &&
      med.expirationDate &&
      med.expirationDate !== "Invalid Date" &&
      med.medicalName?.trim() !== "" &&
      !clearedMedications.has(med.id)
  );

  const count = outOfStockMedications.length;

  if (isLoading) {
    return (
      <Card className="w-full">
        <CardContent className="pt-6">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Package className="h-4 w-4" />
            Checking stock status…
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full">
      <CardContent className="pt-6">
        <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
          <div className="flex items-center justify-between">
            {count === 0 ? (
              <>
                <div className="flex items-center gap-2">
                  <Package className="h-5 w-5 text-green-600" />
                  <div>
                    <div className="font-medium text-green-900">
                      No Medications Out of Stock
                    </div>
                    <div className="text-sm text-green-700">
                      All medications have inventory
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
                        {count}
                      </Badge>
                      <span className="font-medium text-red-900">
                        Medication{count > 1 ? "s" : ""} Out of Stock
                      </span>
                    </div>
                    <div className="text-sm text-red-700">
                      {count === 1 ? "One medication is" : "Multiple medications are"} completely out of stock
                    </div>
                  </div>
                </div>
              </>
            )}

            {count > 0 && (
              <CollapsibleTrigger asChild>
                <Button variant="ghost" size="sm">
                  {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </Button>
              </CollapsibleTrigger>
            )}
          </div>

          {count > 0 && (
            <CollapsibleContent className="mt-4">
              <div className="space-y-2">
                <h4 className="text-sm font-medium text-red-900">
                  Medications Completely Out of Stock:
                </h4>

                <div className="space-y-2">
                  {outOfStockMedications.map((med) => (
                    <div key={med.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border">
                      <div className="flex-1">
                        <div className="font-medium text-gray-900">
                          {med.medicalName}
                        </div>
                        <div className="text-sm text-gray-500">
                          {med.genericName} • {med.dose} • {med.location}
                        </div>
                        <div className="text-xs text-gray-400 mt-1">
                          Expiration: {new Date(med.expirationDate).toLocaleDateString()}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary" className="bg-red-100 text-red-800">
                          0 left
                        </Badge>
                        <Button
                          onClick={() => clearMedication(med.id)}
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0 text-gray-400 hover:text-gray-600"
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
