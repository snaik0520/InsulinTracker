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
import { History, Plus, Minus, Clock } from "lucide-react";

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

  const getTransactionIcon = (type: string) => (type === "addition" ? Plus : Minus);

  const getTransactionColor = (type: string) =>
    type === "addition"
      ? "bg-green-100 text-green-800 border-green-200"
      : "bg-red-100 text-red-800 border-red-200";

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <History className="w-4 h-4 mr-2" />
          View Transactions
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Clock className="w-5 h-5" />
            Medication Transaction History
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="h-[500px] w-full">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="text-gray-500">Loading transactions...</div>
            </div>
          ) : transactions.length === 0 ? (
            <div className="text-center py-8">
              <div className="text-gray-500 mb-2">No transactions recorded yet.</div>
              <div className="text-sm text-gray-400">
                Add or dispense medications to see transaction history.
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {transactions.map((transaction) => {
                const { date, time } = formatTimestamp(transaction.timestamp);
                const Icon = getTransactionIcon(transaction.type);

                // Split "generic (medical)" into generic and medical
                const [generic, withParen] = transaction.medicationName.split(" (");
                const medical = withParen?.replace(")", "") ?? "";

                // Determine unit based on "pen" in name or default to injection
                const isPen = transaction.medicationName.toLowerCase().includes("pen");
                const unit =
                  isPen
                    ? transaction.quantity === 1
                      ? "pen"
                      : "pens"
                    : transaction.quantity === 1
                    ? "injection"
                    : "injections";

                return (
                  <div
                    key={transaction.id}
                    className="flex items-start gap-3 p-4 border rounded-lg hover:bg-gray-50"
                  >
                    <div className={`rounded-full p-2 ${getTransactionColor(transaction.type)}`}>
                      <Icon className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-gray-900">
                        {medical} {generic && `(${generic})`}
                      </div>
                      <div className="text-sm text-gray-600 mt-1">
                        <Badge className={getTransactionColor(transaction.type)}>
                          {transaction.type === "addition" ? "Added" : "Dispensed"}
                        </Badge>
                        <span className="ml-2">
                          {transaction.quantity} {unit}
                          {transaction.type === "addition"
                            ? " added to inventory"
                            : " dispensed to patient"}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 mt-2 text-xs text-gray-500">
                        <Clock className="w-3 h-3" />
                        {date} at {time}
                        {transaction.notes && (
                          <span className="ml-2 italic">{transaction.notes}</span>
                        )}
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
