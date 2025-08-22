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
import { formatToISODateTime } from "@shared/dateUtils";
import { History, Plus, Minus, Clock, MoveIcon } from "lucide-react";

export function TransactionHistory() {
  const [isOpen, setIsOpen] = useState(false);
  const { data: transactions = [], isLoading } = useQuery({
    queryKey: ["/api/transactions"],
    enabled: isOpen, // Only fetch when modal is open
    refetchOnMount: true,
  });

  const formatTimestamp = (timestamp: string | Date) => {
    // Ensure consistent datetime format
    const isoTimestamp = formatToISODateTime(timestamp);
    const date = new Date(isoTimestamp);
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
        return MoveIcon;
      default:
        return Clock;
    }
  };

  const getTransactionColor = (type: string) => {
    switch (type) {
      case "addition":
        return "bg-green-100 text-green-800 border-green-200";
      case "dispensed":
        return "bg-red-100 text-red-800 border-red-200";
      case "move":
        return "bg-purple-100 text-purple-800 border-purple-200";
      default:
        return "bg-gray-100 text-gray-800 border-gray-200";
    }
  };

  const getTransactionTitle = (type: string) => {
    switch (type) {
      case "addition":
        return "Added";
      case "dispensed":
        return "Dispensed";
      case "move":
        return "Moved";
      default:
        return "Updated";
    }
  };

  const getTransactionDescription = (transaction: MedicationTransaction) => {
    if (transaction.type === "move") {
      return "Location changed";
    } else if (transaction.type === "addition") {
      // Determine unit based on "pen" presence
      const isPen = transaction.medicationName.toLowerCase().includes("pen");
      const unit = isPen
        ? transaction.quantity === 1
          ? "pen"
          : "pens"
        : transaction.quantity === 1
        ? "injection"
        : "injections";
      return `${transaction.quantity} ${unit} added to inventory`;
    } else {
      // dispensed
      const isPen = transaction.medicationName.toLowerCase().includes("pen");
      const unit = isPen
        ? transaction.quantity === 1
          ? "pen"
          : "pens"
        : transaction.quantity === 1
        ? "injection"
        : "injections";
      return `${transaction.quantity} ${unit} dispensed to patient`;
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="flex items-center gap-2">
          <History className="h-4 w-4" />
          Transaction History
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <History className="h-5 w-5" />
            Medication Transaction History
          </DialogTitle>
        </DialogHeader>

        <div className="mt-4">
          {isLoading ? (
            <div className="flex justify-center p-8">
              <div className="text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
                <p className="text-sm text-gray-600">Loading transactions...</p>
              </div>
            </div>
          ) : transactions.length === 0 ? (
            <div className="text-center p-8">
              <History className="h-12 w-12 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                No transactions recorded yet.
              </h3>
              <p className="text-sm text-gray-500">
                Add or dispense medications to see transaction history.
              </p>
            </div>
          ) : (
            <ScrollArea className="h-96">
              <div className="space-y-4">
                {transactions.map((transaction) => {
                  const { date, time } = formatTimestamp(transaction.timestamp);
                  const Icon = getTransactionIcon(transaction.type);

                  // Remove any " - form" suffix, then split "generic (medical)"
                  const nameOnly = transaction.medicationName.split(" - ")[0];
                  const [generic, withParen] = nameOnly.split(" (");
                  const medical = withParen?.replace(")", "") ?? "";

                  return (
                    <div
                      key={transaction.id}
                      className="flex items-start justify-between p-4 border rounded-lg hover:bg-gray-50"
                    >
                      {/* LEFT: icon + name + description */}
                      <div className="flex items-start gap-3">
                        <div className={`p-2 rounded-full ${getTransactionColor(transaction.type)}`}>
                          <Icon className="h-4 w-4" />
                        </div>

                        <div className="min-w-0 flex-1">
                          <h4 className="text-sm font-medium text-gray-900">
                            {generic} {medical && `(${medical})`}
                          </h4>
                          <p className="text-sm text-gray-600 mt-1">
                            {getTransactionDescription(transaction)}
                          </p>
                        </div>
                      </div>

                      {/* RIGHT: Badge (title) and timestamp aligned to right */}
                      <div className="flex flex-col items-end gap-1">
                        <Badge
                          variant="secondary"
                          className={getTransactionColor(transaction.type)}
                        >
                          {getTransactionTitle(transaction.type)}
                        </Badge>

                        <div className="text-xs text-gray-500">
                          <div>{date} at {time}</div>
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
