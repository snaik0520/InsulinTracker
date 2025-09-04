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
import { History, Plus, Minus, Clock, MoveIcon, X } from "lucide-react";

export function TransactionHistory() {
  const [isOpen, setIsOpen] = useState(false);
  const { data: transactions = [], isLoading } = useQuery({
    queryKey: ["/api/transactions"],
    refetchOnMount: true,
    refetchOnWindowFocus: true,
    staleTime: 0,  
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
    case "removed":  // Add this line
      return X;  // Or use a different icon like Trash2, X, etc.
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
      case "removed":
  return "bg-[#ffdddd] text-red-800 border-[#ffdddd]";
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
    case "removed":  // Add this line
      return "Removed";
      default:
        return "Updated";
    }
  };

  const getTransactionDescription = (transaction: MedicationTransaction) => {
  if (transaction.type === "move") {
    // Extract destination location from notes
    const notes = transaction.notes || "";
    const toMatch = notes.match(/to "([^"]+)"/);
    const destination = toMatch ? toMatch[1] : "unknown location";
    return `Moved to ${destination}`;
  } else if (transaction.type === "addition") {
    // Determine unit based on administrative form or fallback to pen detection
    const adminForm = (transaction as any).administrativeForm?.toLowerCase();
    let unit: string;
    
    if (adminForm === "other" || transaction.medicationName.toLowerCase().includes("other")) {
      unit = transaction.quantity === 1 ? "unit" : "units";
    } else if (adminForm === "pen" || transaction.medicationName.toLowerCase().includes("pen")) {
      unit = transaction.quantity === 1 ? "pen" : "pens";
    } else {
      unit = transaction.quantity === 1 ? "injection" : "injections";
    }
    
    return `${transaction.quantity} ${unit} (${transaction.dose}) added to inventory`;
  } else if (transaction.type === "removed") {
    return "Medication removed from inventory";
  } else {
    // dispensed
    const adminForm = (transaction as any).administrativeForm?.toLowerCase();
    let unit: string;
    
    if (adminForm === "other" || transaction.medicationName.toLowerCase().includes("other")) {
      unit = transaction.quantity === 1 ? "unit" : "units";
    } else if (adminForm === "pen" || transaction.medicationName.toLowerCase().includes("pen")) {
      unit = transaction.quantity === 1 ? "pen" : "pens";
    } else {
      unit = transaction.quantity === 1 ? "injection" : "injections";
    }
    
    return `${transaction.quantity} ${unit} (${transaction.dose}) dispensed to patient`;
  }
};


  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="default">
          <History className="h-4 w-4 mr-2" />
          Transaction History
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Medication Transaction History</DialogTitle>
        </DialogHeader>

        <ScrollArea className="h-96 mt-4">
          {isLoading ? (
            <div className="flex items-center justify-center h-32">
              <div className="text-center">
                <Clock className="h-8 w-8 mx-auto mb-2 animate-spin" />
                <p className="text-sm text-muted-foreground">Loading transactions...</p>
              </div>
            </div>
          ) : transactions.length === 0 ? (
            <div className="flex items-center justify-center h-32">
              <div className="text-center">
                <History className="h-8 w-8 mx-auto mb-2 text-gray-400" />
                <h3 className="text-lg font-medium text-gray-900 mb-1">
                  No transactions recorded yet.
                </h3>
                <p className="text-sm text-gray-500">
                  Add or dispense medications to see transaction history.
                </p>
              </div>
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

                return (
                  <div
                    key={transaction.id}
                    className="flex items-start justify-between p-4 border rounded-lg bg-white"
                  >
                    {/* LEFT: icon + name + description */}
                    <div className="flex items-start space-x-3 flex-1">
                      <div className="p-2 rounded-full bg-gray-100">
                        <Icon className="h-4 w-4" />
                      </div>

                      <div className="flex-1 min-w-0">
                        <h4 className="text-sm font-medium text-gray-900 mb-1">
                          {generic} {medical && `(${medical})`}
                        </h4>
                        <p className="text-sm text-gray-600">
  {getTransactionDescription(transaction)}
</p>
{transaction.notes && (
  <p className="text-xs text-gray-500 mt-1 italic">
    Notes: {transaction.notes}
  </p>
)}
                      </div>
                    </div>

                    {/* RIGHT: Badge (title) and timestamp aligned to right */}
                    <div className="flex flex-col items-end space-y-2 ml-4">
                      <Badge
                        variant="outline"
                        className={`text-xs ${getTransactionColor(transaction.type)}`}
                      >
                        {getTransactionTitle(transaction.type)}
                      </Badge>
                      <p className="text-xs text-gray-500">
                        {date} at {time}
                      </p>
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
