import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { type MedicationTransaction } from "@shared/schema";
import { History, Plus, Minus, Clock } from "lucide-react";

export function TransactionHistory() {
  const [isOpen, setIsOpen] = useState(false);

  const { data: transactions = [], isLoading } = useQuery<MedicationTransaction[]>({
    queryKey: ["/api/transactions"],
    enabled: isOpen, // Only fetch when modal is open
    refetchOnMount: true,
  });

  const formatTimestamp = (timestamp: string | Date) => {
    const date = new Date(timestamp);
    return {
      date: date.toLocaleDateString(),
      time: date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };
  };

  const getTransactionIcon = (type: string) => {
    return type === "addition" ? Plus : Minus;
  };

  const getTransactionColor = (type: string) => {
    return type === "addition" 
      ? "bg-green-100 text-green-800 border-green-200" 
      : "bg-red-100 text-red-800 border-red-200";
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button 
          variant="outline" 
          className="bg-white hover:bg-gray-50"
          data-testid="button-view-transactions"
        >
          <History className="h-4 w-4 mr-2" />
          View Transaction History
        </Button>
      </DialogTrigger>
      
      <DialogContent className="sm:max-w-2xl sm:max-h-[80vh]" data-testid="modal-transaction-history">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <History className="h-5 w-5 text-primary" />
            Medication Transaction History
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
              <span className="ml-2">Loading transactions...</span>
            </div>
          ) : transactions.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <Clock className="h-8 w-8 mx-auto mb-2 text-gray-300" />
              <p>No transactions recorded yet.</p>
              <p className="text-sm">Add or dispense medications to see transaction history.</p>
            </div>
          ) : (
            <ScrollArea className="h-[400px] pr-4">
              <div className="space-y-3">
                {transactions.map((transaction) => {
                  const { date, time } = formatTimestamp(transaction.timestamp);
                  const Icon = getTransactionIcon(transaction.type);
                  
                  return (
                    <div
                      key={transaction.id}
                      className="flex items-start space-x-3 p-3 bg-gray-50 rounded-lg border"
                      data-testid={`transaction-${transaction.id}`}
                    >
                      <div className={`p-2 rounded-full ${getTransactionColor(transaction.type)}`}>
                        <Icon className="h-4 w-4" />
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <p className="font-medium text-gray-900" data-testid="text-medication-name">
                            {transaction.medicationName}
                          </p>
                          <Badge 
                            className={getTransactionColor(transaction.type)}
                            data-testid="badge-transaction-type"
                          >
                            {transaction.type === "addition" ? "Added" : "Dispensed"}
                          </Badge>
                        </div>
                        
                        <div className="mt-1 flex items-center justify-between">
                          <p className="text-sm text-gray-600">
                            <span className="font-medium" data-testid="text-quantity">
                              {transaction.quantity} vial{transaction.quantity !== 1 ? 's' : ''}
                            </span>
                            {transaction.type === "addition" ? " added to inventory" : " dispensed to patient"}
                          </p>
                        </div>
                        
                        <div className="mt-2 flex items-center justify-between text-xs text-gray-500">
                          <span data-testid="text-timestamp">{date} at {time}</span>
                          {transaction.notes && (
                            <span className="italic" data-testid="text-notes">
                              {transaction.notes}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
