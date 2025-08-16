import { useState, useEffect, useRef, createContext, useContext } from "react";
import { initializeApp } from "firebase/app";
import { getAuth, signInAnonymously, onAuthStateChanged } from "firebase/auth";
import { getFirestore, collection, onSnapshot, query, orderBy } from "firebase/firestore";

// Placeholder for a Toast system to avoid external dependencies
const ToastContext = createContext(null);
const useToast = () => useContext(ToastContext);
const ToastProvider = ({ children }) => {
  const [toasts, setToasts] = useState([]);

  const toast = (newToast) => {
    setToasts(prev => [...prev, { id: Date.now(), ...newToast }]);
  };

  useEffect(() => {
    if (toasts.length > 0) {
      const timer = setTimeout(() => {
        setToasts(prev => prev.slice(1));
      }, toasts[0].duration || 5000);
      return () => clearTimeout(timer);
    }
  }, [toasts]);

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 w-full max-w-xs">
        {toasts.map(t => (
          <div key={t.id} className={`rounded-md p-4 shadow-md text-white ${t.variant === 'destructive' ? 'bg-red-500' : 'bg-green-500'}`}>
            <h3 className="font-bold">{t.title}</h3>
            <p className="text-sm">{t.description}</p>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
};

// Placeholder UI components for a self-contained app
const Button = ({ children, onClick, className = "", variant = "default", ...props }) => {
  let baseClasses = "inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none";
  let variantClasses = "";
  if (variant === "default") {
    variantClasses = "bg-primary text-primary-foreground hover:bg-primary/90 h-10 py-2 px-4";
  } else if (variant === "outline") {
    variantClasses = "border border-input bg-background hover:bg-accent hover:text-accent-foreground h-10 py-2 px-4";
  }
  return <button onClick={onClick} className={`${baseClasses} ${variantClasses} ${className}`} {...props}>{children}</button>;
};

// Type Definitions
type Transaction = {
  id: string;
  medicationName: string;
  quantity: number;
  type: "dispense" | "move" | "add";
  timestamp: string;
  comment?: string; // Updated to include the optional comment
}

export const TransactionHistory = () => {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const dbRef = useRef(null);
  const userIdRef = useRef(null);
  const { toast } = useToast();

  useEffect(() => {
    const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
    const firebaseConfig = JSON.parse(typeof __firebase_config !== 'undefined' ? __firebase_config : '{}');
    const app = initializeApp(firebaseConfig);
    const auth = getAuth(app);
    const db = getFirestore(app);
    dbRef.current = db;

    const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
      if (user) {
        userIdRef.current = user.uid;
      } else {
        await signInAnonymously(auth);
        userIdRef.current = auth.currentUser.uid;
      }
    });

    return () => unsubscribeAuth();
  }, []);

  useEffect(() => {
    let unsubscribe = () => {};
    if (dbRef.current && userIdRef.current) {
      const db = dbRef.current;
      const userId = userIdRef.current;
      
      // Reference to the 'transactions' collection for the current user
      const transactionsCollectionRef = collection(db, `artifacts/${__app_id}/users/${userId}/transactions`);
      
      // Listen for real-time changes to the transactions collection
      // Note: Ordering is not used due to a known runtime error issue
      unsubscribe = onSnapshot(transactionsCollectionRef, (querySnapshot) => {
        const txs = [];
        querySnapshot.forEach((doc) => {
          const data = doc.data() as Transaction;
          txs.push({ ...data, id: doc.id });
        });
        
        // Sort transactions by timestamp in descending order in memory
        txs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
        setTransactions(txs);
        
      }, (error) => {
        console.error("Failed to fetch transactions:", error);
        toast({
          title: "Error",
          description: "Failed to load transaction history.",
          variant: "destructive",
        });
      });
    }
    return () => unsubscribe();
  }, [toast]); // Added toast to dependency array

  return (
    <div className="bg-white rounded-xl border shadow p-6 max-w-2xl mx-auto">
      <h3 className="text-2xl font-semibold text-gray-900 mb-6">Transaction History</h3>
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
                    {tx.type === "move" && "Moved"}
                    {" "}
                    <span className="font-bold">{tx.quantity}</span> units of {tx.medicationName}.
                  </span>
                  <span className="text-xs text-gray-500 mt-1">
                    {new Date(tx.timestamp).toLocaleString()}
                  </span>
                </div>
              </div>
              {/* Conditional render for the comment */}
              {tx.comment && (
                <div className="mt-2 text-sm text-gray-700 bg-gray-50 p-3 rounded-lg border border-gray-200">
                  <span className="font-semibold text-gray-600">Comment:</span> {tx.comment}
                </div>
              )}
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
          <h1 className="text-3xl font-bold text-gray-800">Noor Insulin Inventory</h1>
          <p className="text-sm text-gray-500">Your medication tracking made simple.</p>
        </header>
        <TransactionHistory />
      </div>
    </ToastProvider>
  );
}
