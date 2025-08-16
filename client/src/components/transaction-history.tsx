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
import { History, Plus, Minus, Clock } from "lucide-react";

// Type Definitions
type Transaction = {
  id: string;
  medicationName: string;
  quantity: number;
  type: "dispense" | "add";
  timestamp: string;
  comment?: string;
};

export function TransactionHistory() {
  const [isOpen, setIsOpen] = useState(false);

  const { data: transactions = [], isLoading } = useQuery<Transaction[]>({
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
      case "add":
        return Plus;
      case "dispense":
        return Minus;
      default:
        return Clock;
    }
  };

  const getTransactionColor = (type: string) => {
    switch (type) {
      case "add":
        return "bg-green-100 text-green-800 border-green-200";
      case "dispense":
        return "bg-red-100 text-red-800 border-red-200";
      default:
        return "bg-gray-100 text-gray-800 border-gray-200";
    }
  };

  const getTransactionTitle = (type: string) => {
    switch (type) {
      case "add":
        return "Added";
      case "dispense":
        return "Dispensed";
      default:
        return "Updated";
    }
  };

  const getTransactionDescription = (tx: Transaction) => {
    if (tx.type === "add") {
      const isPen = tx.medicationName.toLowerCase().includes("pen");
      const unit = isPen
        ? tx.quantity === 1
          ? "pen"
          : "pens"
        : tx.quantity === 1
        ? "injection"
        : "injections";
      return `${tx.quantity} ${unit} added to inventory`;
    } else if (tx.type === "dispense") {
      const isPen = tx.medicationName.toLowerCase().includes("pen");
      const unit = isPen
        ? tx.quantity === 1
          ? "pen"
          : "pens"
        : tx.quantity === 1
        ? "injection"
        : "injections";
      return `${tx.quantity} ${unit} dispensed to patient`;
    }
    return `${tx.quantity} units updated`;
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="border-blue-300 text-blue-700 hover:bg-blue-50">
          <History className="h-4 w-4 mr-2" />
          Transaction History
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[600px] max-h-[80vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-blue-700">
            <History className="h-5 w-5" />
            Medication Transaction History
          </DialogTitle>
        </DialogHeader>
        <ScrollArea className="h-full max-h-[60vh] pr-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              <span className="ml-2 text-blue-600">Loading transactions...</span>
            </div>
          ) : transactions.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <History className="h-16 w-16 mx-auto mb-4 text-gray-300" />
              <h3 className="text-lg font-medium mb-2">No transactions recorded yet.</h3>
              <p className="text-sm">
                Add or dispense medications to see transaction history.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {transactions.map((tx) => {
                const { date, time } = formatTimestamp(tx.timestamp);
                const Icon = getTransactionIcon(tx.type);
                const nameOnly = tx.medicationName.split(" - ")[0];
                const [generic, withParen] = nameOnly.split(" (");
                const medical = withParen?.replace(")", "") ?? "";
                
                return (
                  <div
                    key={tx.id}
                    className="border border-gray-200 rounded-lg p-4 hover:shadow-sm transition-shadow"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-3 flex-1 min-w-0">
                        <div className={`p-2 rounded-full ${getTransactionColor(tx.type)}`}>
                          <Icon className="h-4 w-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className="font-medium text-gray-900 truncate">
                            {generic} {medical && `(${medical})`}
                          </h4>
                          <p className="text-sm text-gray-600 mt-2">
                            {getTransactionDescription(tx)}
                          </p>
                          {/* Display comment if it exists */}
                          {tx.comment && tx.comment.trim() !== "" && (
                            <div className="mt-2 text-sm text-gray-700 bg-blue-50 p-3 rounded-lg border border-blue-200">
                              <span className="font-semibold text-blue-700">Comment:</span> {tx.comment}
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="ml-4 flex flex-col items-end text-right">
                        <Badge
                          variant="outline"
                          className={`${getTransactionColor(tx.type)} px-2 py-1`}
                        >
                          {getTransactionTitle(tx.type)}
                        </Badge>
                        <div className="flex items-center gap-1 text-xs text-gray-500 mt-2">
                          <Clock className="h-3 w-3" />
                          <span>
                            {date} at {time}
                          </span>
                        </div>
                      </div>
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
