import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { type MedicationTransaction } from "@shared/schema";
import { History, Plus, Minus, Clock, MapPin } from "lucide-react";

export function TransactionHistory() {
  const [isOpen, setIsOpen] = useState(false);
  const { data: transactions = [], isLoading } = useQuery({
    queryKey: ["/api/transactions"],
    enabled: isOpen, // Only fetch when modal is open
    refetchOnMount: true,
  });

  const formatTimestamp = (timestamp: string | Date) => {
    const date = new Date(timestamp);
    return {
      date: date.toLocaleDateString(),
      time: date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };
  };

  const getTransactionIcon = (type: string) => {
    switch (type) {
      case "addition":
        return Plus;
      case "dispensed": 
        return Minus;
      case "move":
        return MapPin;
      default:
        return Plus;
    }
  };

  const getTransactionColor = (type: string) => {
    switch (type) {
      case "addition":
        return "bg-green-100 text-green-800 border-green-200";
      case "dispensed":
        return "bg-red-100 text-red-800 border-red-200";
      case "move":
        return "bg-blue-100 text-blue-800 border-blue-200";
      default:
        return "bg-gray-100 text-gray-800 border-gray-200";
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <History className="h-4 w-4 mr-2" />
          Transaction History
        </Button>
      </DialogTrigger>

      <DialogContent className="max-w-4xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle>
            <History className="h-5 w-5 mr-2 inline" />
            Medication Transaction History
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="h-[60vh]">
          {isLoading ? (
            <div className="flex items-center justify-center h-32">
              <div className="text-muted-foreground">
                Loading transactions...
              </div>
            </div>
          ) : transactions.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Clock className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p className="text-lg font-medium">No transactions recorded yet.</p>
              <p className="text-sm">
                Add or dispense medications to see transaction history.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {transactions.map((transaction) => {
                const { date, time } = formatTimestamp(transaction.timestamp);
                const Icon = getTransactionIcon(transaction.type);

                // Remove any " - form" suffix, then split "generic (medical)"
                const nameOnly = transaction.medicationName.split(" - ")[0];
                const [generic, withParen] = nameOnly.split(" (");
                const medical = withParen?.replace(")", "") ?? "";

                // Determine unit based on "pen" presence
                const isPen = nameOnly.toLowerCase().includes("pen");
                const unit = isPen
                  ? transaction.quantity === 1
                    ? "pen"
                    : "pens"
                  : transaction.quantity === 1
                  ? "injection"
                  : "injections";

                return (
                  <div
                    key={transaction.id}
                    className="flex items-start space-x-4 p-4 rounded-lg border bg-card"
                  >
                    <div className="flex-shrink-0">
                      <div
                        className={`w-10 h-10 rounded-full flex items-center justify-center ${getTransactionColor(
                          transaction.type
                        )}`}
                      >
                        <Icon className="h-5 w-5" />
                      </div>
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <h4 className="text-sm font-medium text-foreground">
                          {medical} {generic && `(${generic})`}
                        </h4>

                        <Badge
                          variant="outline"
                          className={`ml-2 ${getTransactionColor(transaction.type)}`}
                        >
                          {transaction.type === "addition" ? "Added" : transaction.type === "dispensed" ? "Dispensed" : "Moved"}
                        </Badge>
                      </div>

                      <div className="mt-1 flex items-center text-sm text-muted-foreground">
                        {transaction.type === "move" ? (
                          <span>Location changed</span>
                        ) : (
                          <>
                            <span className="font-medium text-foreground">
                              {transaction.quantity} {unit}
                            </span>
                            <span className="ml-1">
                              {transaction.type === "addition"
                                ? " added to inventory"
                                : " dispensed to patient"}
                            </span>
                          </>
                        )}
                      </div>

                      <div className="mt-2 flex items-center text-xs text-muted-foreground">
                        <Clock className="h-3 w-3 mr-1" />
                        {date} at {time}
                      </div>
                      {transaction.notes && (
                        <div className="mt-2 text-xs text-muted-foreground bg-muted p-2 rounded">
                          {transaction.notes}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
