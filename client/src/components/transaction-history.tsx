import { useEffect, useState, createContext, useContext } from "react";

// Toast system
const ToastContext = createContext(null);
const useToast = () => useContext(ToastContext);

const ToastProvider = ({ children }) => {
  const [toasts, setToasts] = useState([]);

  const toast = (newToast) => {
    setToasts((prev) => [...prev, { id: Date.now(), ...newToast }]);
  };

  useEffect(() => {
    if (toasts.length > 0) {
      const timer = setTimeout(() => {
        setToasts((prev) => prev.slice(1));
      }, toasts[0].duration || 5000);
      return () => clearTimeout(timer);
    }
  }, [toasts]);

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 w-full max-w-xs">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`rounded-md p-4 shadow-md text-white ${
              t.variant === "destructive" ? "bg-red-500" : "bg-green-500"
            }`}
          >
            <h3 className="font-bold">{t.title}</h3>
            <p className="text-sm">{t.description}</p>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
};

// Transaction Type
type Transaction = {
  id: string;
  medicationName: string;
  quantity: number;
  type: "dispense" | "move" | "add";
  timestamp: string;
  comment?: string;
};

export const TransactionHistory = () => {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const { toast } = useToast();

  // Replace this with an API call or local storage logic
  useEffect(() => {
    try {
      // Mock data to simulate real transactions
      const mockTransactions: Transaction[] = [
        {
          id: "1",
          medicationName: "Insulin Glargine",
          quantity: 2,
          type: "dispense",
          timestamp: new Date().toISOString(),
          comment: "Patient needed extra due to travel.",
        },
        {
          id: "2",
          medicationName: "Insulin Lispro",
          quantity: 5,
          type: "add",
          timestamp: new Date().toISOString(),
        },
      ];

      setTransactions(
        mockTransactions.sort(
          (a, b) =>
            new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
        )
      );
    } catch (err) {
      console.error("Failed to fetch transactions:", err);
      toast({
        title: "Error",
        description: "Failed to load transaction history.",
        variant: "destructive",
      });
    }
  }, [toast]);

  return (
    <div className="bg-white rounded-xl border shadow p-6 max-w-2xl mx-auto">
      <h3 className="text-2xl font-semibold text-gray-900 mb-6">
        Transaction History
      </h3>

      {transactions.length === 0 ? (
        <p className="text-sm text-gray-500 text-center py-8">
          No transactions have been recorded yet.
        </p>
      ) : (
        <ul className="divide-y divide-gray-200 max-h-96 overflow-y-auto">
          {transactions.map((tx) => (
            <li key={tx.id} className="py-4">
              <div className="flex items-start justify-between">
                <div className="flex flex-col">
                  <span className="text-sm font-medium text-gray-900">
                    {tx.type === "dispense" && "Dispensed"}
                    {tx.type === "add" && "Added"}
                    {tx.type === "move" && "Moved"}{" "}
                    <span className="font-bold">{tx.quantity}</span> units of{" "}
                    {tx.medicationName}.
                  </span>
                  <span className="text-xs text-gray-500 mt-1">
                    {new Date(tx.timestamp).toLocaleString()}
                  </span>
                  {tx.comment && (
                    <div className="mt-2 text-sm text-gray-700 bg-gray-50 p-3 rounded-lg border border-gray-200">
                      <span className="font-semibold text-gray-600">
                        Comment:
                      </span>{" "}
                      {tx.comment}
                    </div>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default function App() {
  return (
    <ToastProvider>
      <div className="p-4 sm:p-8 bg-gray-100 min-h-screen font-sans">
        <header className="flex flex-col items-center justify-center p-4 bg-white rounded-lg shadow-md mb-8 max-w-2xl mx-auto">
          <h1 className="text-3xl font-bold text-gray-800">
            Noor Insulin Inventory
          </h1>
          <p className="text-sm text-gray-500">
            Your medication tracking made simple.
          </p>
        </header>
        <TransactionHistory />
      </div>
    </ToastProvider>
  );
}
