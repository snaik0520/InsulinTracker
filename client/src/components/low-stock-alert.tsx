import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { type Medication } from "@shared/schema";
import { AlertTriangle, ChevronDown, ChevronUp, Package } from "lucide-react";

export function LowStockAlert() {
  const [isOpen, setIsOpen] = useState(false);

  const { data: lowStockMedications = [], isLoading } = useQuery<Medication[]>({
    queryKey: ["/api/medications/low-stock"],
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-2">
        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-orange-500"></div>
        <span className="ml-2 text-sm text-gray-600">Checking stock levels...</span>
      </div>
    );
  }

  if (lowStockMedications.length === 0) {
    return (
      <Alert className="border-green-200 bg-green-50">
        <Package className="h-4 w-4 text-green-600" />
        <AlertDescription className="text-green-800">
          All medications are well-stocked. No low stock alerts at this time.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <Alert className="border-orange-200 bg-orange-50">
        <AlertTriangle className="h-4 w-4 text-orange-600" />
        <AlertDescription className="flex items-center justify-between">
          <span className="text-orange-800">
            <strong>{lowStockMedications.length}</strong> medication{lowStockMedications.length > 1 ? 's' : ''} running low on stock
          </span>
          <CollapsibleTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="h-auto p-1 text-orange-600 hover:text-orange-800"
              data-testid="button-toggle-low-stock"
            >
              {isOpen ? (
                <ChevronUp className="h-4 w-4" />
              ) : (
                <ChevronDown className="h-4 w-4" />
              )}
            </Button>
          </CollapsibleTrigger>
        </AlertDescription>
      </Alert>
      
      <CollapsibleContent className="mt-2">
        <div className="space-y-2 p-4 bg-white rounded-lg border border-orange-200">
          <h4 className="font-medium text-orange-800 mb-2">Low Stock Medications:</h4>
          <div className="grid gap-2">
            {lowStockMedications.map((medication) => (
              <div
                key={medication.id}
                className="flex items-center justify-between p-3 bg-orange-50 rounded-lg border border-orange-100"
                data-testid={`low-stock-item-${medication.id}`}
              >
                <div>
                  <div className="font-medium text-gray-900">
                    {medication.genericName}
                  </div>
                  <div className="text-sm text-gray-600">
                    {medication.medicalName} • {medication.location}
                  </div>
                </div>
                <div className="text-right">
                  <Badge variant="destructive" className="mb-1">
                    {medication.quantity} vials left
                  </Badge>
                  <div className="text-xs text-gray-500">
                    {medication.dose}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}