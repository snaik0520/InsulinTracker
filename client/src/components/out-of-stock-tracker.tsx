import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { 
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { type Medication } from "@shared/schema";
import { AlertTriangle, ChevronDown, ChevronUp, Package, XCircle, Trash2, Trash } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

export function OutOfStockTracker() {
  const [isExpanded, setIsExpanded] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: outOfStockMedications = [], isLoading } = useQuery({
    queryKey: ["/api/medications/out-of-stock"],
    refetchInterval: 5000, // Refetch every 5 seconds to keep data fresh
  });

  // Mutation for deleting individual medications
  const deleteMedicationMutation = useMutation({
    mutationFn: async (medicationId: string) => {
      const response = await apiRequest("DELETE", `/api/medications/${medicationId}`);
      return response.json();
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["/api/medications"], refetchType: 'active' }),
        queryClient.invalidateQueries({ queryKey: ["/api/medications/out-of-stock"], refetchType: 'active' }),
        queryClient.invalidateQueries({ queryKey: ["/api/medications/low-stock"], refetchType: 'active' }),
        queryClient.invalidateQueries({ queryKey: ["/api/transactions"], refetchType: 'active' })
      ]);
      toast({
        title: "Success",
        description: "Medication deleted successfully",
        duration: 3000
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error?.message ?? "Failed to delete medication",
        variant: "destructive",
        duration: 3000
      });
    },
  });

  // Mutation for bulk deleting all out-of-stock medications
  const bulkDeleteMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("DELETE", "/api/medications/out-of-stock/bulk");
      return response.json();
    },
    onSuccess: async (data) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["/api/medications"], refetchType: 'active' }),
        queryClient.invalidateQueries({ queryKey: ["/api/medications/out-of-stock"], refetchType: 'active' }),
        queryClient.invalidateQueries({ queryKey: ["/api/medications/low-stock"], refetchType: 'active' }),
        queryClient.invalidateQueries({ queryKey: ["/api/transactions"], refetchType: 'active' })
      ]);
      toast({
        title: "Success",
        description: `Successfully deleted ${data.deletedCount} out-of-stock medications`,
        duration: 3000
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error?.message ?? "Failed to delete out-of-stock medications",
        variant: "destructive",
        duration: 3000
      });
    },
  });

  const handleDeleteMedication = (medicationId: string) => {
    deleteMedicationMutation.mutate(medicationId);
  };

  const handleBulkDelete = () => {
    bulkDeleteMutation.mutate();
  };

  if (isLoading) {
    return (
      <Card className="border-orange-200 bg-orange-50">
        <CardContent className="p-6">
          <div className="flex items-center gap-3">
            <Package className="h-5 w-5 text-orange-600" />
            Checking stock status...
          </div>
        </CardContent>
      </Card>
    );
  }

  const outOfStockCount = outOfStockMedications.length;

  return (
    <Card className="border-red-200 bg-red-50">
      <CardContent className="p-6">
        <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {outOfStockCount === 0 ? (
                <>
                  <Package className="h-5 w-5 text-green-600" />
                  <div>
                    <h3 className="font-medium text-green-800">
                      All Stock Levels Good
                    </h3>
                    <p className="text-sm text-green-600">
                      No medications out of stock
                    </p>
                  </div>
                </>
              ) : (
                <>
                  <XCircle className="h-5 w-5 text-red-600" />
                  <div>
                    <h3 className="font-medium text-red-800 flex items-center gap-2">
                      <Badge variant="destructive" className="px-2 py-1">
                        {outOfStockCount}
                      </Badge>
                      Medication{outOfStockCount > 1 ? 's' : ''} Out of Stock
                    </h3>
                    <p className="text-sm text-red-600">
                      {outOfStockCount === 1 ? 'One medication is' : 'Multiple medications are'} completely out of stock
                    </p>
                  </div>
                </>
              )}
            </div>

            {outOfStockCount > 0 && (
              <div className="flex items-center gap-2">
                {/* Bulk Delete Button */}
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      variant="destructive"
                      size="sm"
                      className="flex items-center gap-2"
                      disabled={bulkDeleteMutation.isPending}
                    >
                      <Trash className="h-4 w-4" />
                      Delete All
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Delete All Out-of-Stock Medications?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This will permanently delete all {outOfStockCount} out-of-stock medication{outOfStockCount > 1 ? 's' : ''} from your inventory. 
                        This action cannot be undone.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={handleBulkDelete}
                        className="bg-red-600 hover:bg-red-700"
                      >
                        {bulkDeleteMutation.isPending ? "Deleting..." : "Delete All"}
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>

                {/* Expand/Collapse Button */}
                <CollapsibleTrigger asChild>
                  <Button variant="ghost" size="sm">
                    {isExpanded ? (
                      <ChevronUp className="h-4 w-4" />
                    ) : (
                      <ChevronDown className="h-4 w-4" />
                    )}
                  </Button>
                </CollapsibleTrigger>
              </div>
            )}
          </div>

          {outOfStockCount > 0 && (
            <CollapsibleContent className="mt-4">
              <div className="space-y-3">
                <h4 className="font-medium text-red-800">Medications Requiring Attention:</h4>
                <div className="space-y-2">
                  {outOfStockMedications.map((medication) => (
                    <div
                      key={medication.id}
                      className="flex items-center justify-between p-3 bg-white rounded-lg border border-red-200"
                    >
                      <div className="flex-1">
                        <p className="font-medium text-gray-900">
                          {medication.medicalName}
                        </p>
                        <p className="text-sm text-gray-600">
                          {medication.genericName} • {medication.dose} • {medication.location}
                        </p>
                        <p className="text-xs text-gray-500 mt-1">
                          Expires: {new Date(medication.expirationDate).toLocaleDateString()}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="destructive" className="ml-4">
                          0 left
                        </Badge>
                        
                        {/* Individual Delete Button */}
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-red-600 hover:text-red-800 hover:bg-red-100"
                              disabled={deleteMedicationMutation.isPending}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Delete Medication?</AlertDialogTitle>
                              <AlertDialogDescription>
                                Are you sure you want to delete "{medication.medicalName} ({medication.genericName})" 
                                from your inventory? This action cannot be undone.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => handleDeleteMedication(medication.id)}
                                className="bg-red-600 hover:bg-red-700"
                              >
                                {deleteMedicationMutation.isPending ? "Deleting..." : "Delete"}
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
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
