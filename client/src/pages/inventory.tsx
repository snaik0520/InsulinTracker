import { useState, useMemo, useEffect, useRef, createContext, useContext } from "react";

// Firebase imports
import { initializeApp } from 'firebase/app';
import { getAuth, signInWithCustomToken, signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, doc, setDoc, onSnapshot, collection, query, where, updateDoc } from 'firebase/firestore';

// Lucide React Icons
import { Search, Plus, HandHeart, Syringe, Zap, Clock, Scale, HelpCircle, List, CornerRightDown, Check, Minus, Plus as PlusIcon, X } from "lucide-react";

// Placeholder for the logo since we don't have the image file
const logo = "https://placehold.co/100x50/F8E5EE/8C5C85?text=NOOR+LOGO";

// --------------------------------------------------
// Type Definitions & Helpers
// --------------------------------------------------

type Medication = {
  id: string;
  genericName?: string;
  medicalName: string;
  location?: string;
  quantity: number;
  dose?: string;
  type: string;
  administrativeForm?: string;
  expirationDate?: string;
}

const typeIcons = {
  rapid: Zap,
  long: Clock,
  intermediate: Scale,
  other: HelpCircle,
} as const;

const badgeColors = {
  rapid: "bg-rose-100 text-rose-800",
  long: "bg-violet-100 text-violet-800",
  intermediate: "bg-emerald-100 text-emerald-800",
  other: "bg-amber-100 text-amber-800",
} as const;

const rowBgClasses = {
  rapid: "bg-rose-50",
  long: "bg-violet-50",
  intermediate: "bg-emerald-50",
  other: "bg-amber-50",
} as const;

const filterSelectedClasses = {
  rapid: "bg-rose-100 text-rose-800 border-rose-200",
  long: "bg-violet-100 text-violet-800 border-violet-200",
  intermediate: "bg-emerald-100 text-emerald-800 border-emerald-200",
  other: "bg-amber-100 text-amber-800 border-amber-200",
} as const;

const filterHoverClasses = {
  rapid: "hover:bg-rose-50 hover:text-rose-700",
  long: "hover:bg-violet-50 hover:text-violet-700",
  intermediate: "hover:bg-emerald-50 hover:text-emerald-700",
  other: "hover:bg-amber-50 hover:text-amber-700",
} as const;

const typeLabels = {
  rapid: "Rapid Acting",
  long: "Long Acting",
  intermediate: "Intermediate",
  other: "Other",
} as const;

const getRowClassName = (type: string) => {
  switch (type) {
    case "rapid":
      return rowBgClasses.rapid;
    case "long":
      return rowBgClasses.long;
    case "intermediate":
      return rowBgClasses.intermediate;
    case "other":
      return rowBgClasses.other;
    default:
      return "";
  }
};

const calculateDaysUntilExpiration = (expirationDate?: string) => {
  if (!expirationDate) return Infinity;
  const today = new Date();
  const expiry = new Date(expirationDate);
  const diffTime = expiry.getTime() - today.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays;
};

// --------------------------------------------------
// Custom UI Components (Replacements for shadcn/ui)
// --------------------------------------------------

const Button = ({ children, onClick, className = "", variant = "default", ...props }: any) => {
  let baseClasses = "inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none";
  let variantClasses = "";
  if (variant === "default") {
    variantClasses = "bg-primary text-primary-foreground hover:bg-primary/90 h-10 py-2 px-4";
  } else if (variant === "outline") {
    variantClasses = "border border-input bg-background hover:bg-accent hover:text-accent-foreground h-10 py-2 px-4";
  }
  return <button onClick={onClick} className={`${baseClasses} ${variantClasses} ${className}`} {...props}>{children}</button>;
};

const Input = ({ className = "", ...props }: any) => {
  return <input className={`flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 ${className}`} {...props} />;
};

const Label = ({ children, className = "", ...props }: any) => {
  return <label className={`text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 ${className}`} {...props}>{children}</label>;
};

const Card = ({ children, className = "", ...props }: any) => {
  return <div className={`rounded-xl border bg-card text-card-foreground shadow ${className}`} {...props}>{children}</div>;
};

const CardHeader = ({ children, className = "", ...props }: any) => {
  return <div className={`flex flex-col space-y-1.5 p-6 ${className}`} {...props}>{children}</div>;
};

const CardTitle = ({ children, className = "", ...props }: any) => {
  return <h3 className={`font-semibold leading-none tracking-tight ${className}`} {...props}>{children}</h3>;
};

const CardContent = ({ children, className = "", ...props }: any) => {
  return <div className={`p-6 pt-0 ${className}`} {...props}>{children}</div>;
};

const Badge = ({ children, className = "", ...props }: any) => {
  return <div className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 ${className}`} {...props}>{children}</div>;
};

const Dialog = ({ open, onOpenChange, children }: any) => {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 overflow-auto bg-black/80 flex items-center justify-center p-4">
      <div className="relative z-50 max-w-lg mx-auto my-auto p-6 rounded-lg shadow-lg bg-white" onClick={e => e.stopPropagation()}>
        {children}
        <Button onClick={() => onOpenChange(false)} className="absolute top-2 right-2 p-1" variant="ghost">
          <X className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
};

const DialogContent = ({ children, className = "" }: any) => <div className={`relative p-6 ${className}`}>{children}</div>;
const DialogHeader = ({ children }: any) => <div className="flex flex-col space-y-1.5 text-center sm:text-left">{children}</div>;
const DialogTitle = ({ children }: any) => <h2 className="text-lg font-semibold">{children}</h2>;
const DialogFooter = ({ children, className = "" }: any) => <div className={`flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2 ${className}`}>{children}</div>;

const SelectContext = createContext<any>(null);

const Select = ({ children, onValueChange, value }: any) => {
  const [open, setOpen] = useState(false);
  const toggleOpen = () => setOpen(!open);
  return (
    <SelectContext.Provider value={{ onValueChange, value, toggleOpen, open, setOpen }}>
      {children}
    </SelectContext.Provider>
  );
};

const SelectTrigger = ({ children, className = "" }: any) => {
  const { toggleOpen } = useContext(SelectContext);
  return <Button onClick={toggleOpen} className={`w-full justify-between ${className}`} variant="outline">{children}</Button>;
};

const SelectContent = ({ children }: any) => {
  const { open } = useContext(SelectContext);
  if (!open) return null;
  return (
    <div className="absolute z-50 bg-white border border-gray-200 rounded-md shadow-lg py-1 mt-1 w-full max-h-48 overflow-auto">
      {children}
    </div>
  );
};

const SelectItem = ({ children, value }: any) => {
  const { onValueChange, setOpen } = useContext(SelectContext);
  const handleClick = () => {
    onValueChange(value);
    setOpen(false);
  };
  return <div onClick={handleClick} className="px-4 py-2 cursor-pointer hover:bg-gray-100">{children}</div>;
};

const SelectValue = ({ placeholder }: any) => {
  const { value } = useContext(SelectContext);
  return value ? value : placeholder;
};

// --------------------------------------------------
// Toast Notification System
// --------------------------------------------------

const ToastContext = createContext<any>(null);

const ToastProvider = ({ children }: any) => {
  const [toasts, setToasts] = useState<any[]>([]);

  const toast = (newToast: any) => {
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

const useToast = () => useContext(ToastContext);

// --------------------------------------------------
// Placeholder Components
// --------------------------------------------------

const LowStockTicker = () => <div className="p-4 text-center bg-yellow-50 text-yellow-800 rounded-md">Low Stock Ticker Placeholder</div>;
const OutOfStockTracker = () => <div className="mt-4 p-4 text-center bg-red-50 text-red-800 rounded-md">Out of Stock Tracker Placeholder</div>;
const TransactionHistory = () => <div className="p-2 border rounded-md">Transaction History Placeholder</div>;
const DispenseModal = ({ open, onOpenChange, medication }: any) => {
  // Placeholder for dispense logic
  const { toast } = useToast();
  const dbRef = useRef<any>(null);
  const authRef = useRef<any>(null);
  const userIdRef = useRef<string | null>(null);

  useEffect(() => {
    const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
    const firebaseConfig = JSON.parse(typeof __firebase_config !== 'undefined' ? __firebase_config : '{}');
    const app = initializeApp(firebaseConfig);
    const auth = getAuth(app);
    const db = getFirestore(app);

    dbRef.current = db;
    authRef.current = auth;

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        userIdRef.current = user.uid;
      } else {
        await signInAnonymously(auth);
      }
    });

    return () => unsubscribe();
  }, []);

  const handleDispense = async () => {
    if (!medication || !dbRef.current || !userIdRef.current) return;
    try {
      const medicationRef = doc(dbRef.current, `artifacts/${__app_id}/users/${userIdRef.current}/medications`, medication.id);
      await updateDoc(medicationRef, {
        quantity: medication.quantity - 1,
      });
      toast({
        title: "Success",
        description: `Successfully dispensed one unit of ${medication.medicalName}.`,
      });
      onOpenChange(false);
    } catch (error) {
      console.error("Error dispensing medication:", error);
      toast({
        title: "Error",
        description: "Failed to dispense medication.",
        variant: "destructive",
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Dispense Medication</DialogTitle>
        </DialogHeader>
        <div className="py-4">
          <p>Are you sure you want to dispense one unit of <strong>{medication?.medicalName}</strong>?</p>
          <p className="text-xs text-gray-500 mt-2">Current stock: {medication?.quantity}</p>
        </div>
        <DialogFooter>
          <Button onClick={handleDispense}>Confirm</Button>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

const AddMedicationModal = ({ open, onOpenChange, onSave }: any) => {
  const [genericName, setGenericName] = useState("");
  const [medicalName, setMedicalName] = useState("");
  const [location, setLocation] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [dose, setDose] = useState("");
  const [type, setType] = useState("rapid");
  const [administrativeForm, setAdministrativeForm] = useState("pen");
  const [expirationDate, setExpirationDate] = useState("");

  const handleSave = () => {
    onSave({
      genericName,
      medicalName,
      location,
      quantity: Number(quantity),
      dose,
      type,
      administrativeForm,
      expirationDate,
    });
    setGenericName("");
    setMedicalName("");
    setLocation("");
    setQuantity(1);
    setDose("");
    setType("rapid");
    setAdministrativeForm("pen");
    setExpirationDate("");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Add New Medication</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="medicalName" className="text-right">Medical Name</Label>
            <Input id="medicalName" value={medicalName} onChange={e => setMedicalName(e.target.value)} className="col-span-3" />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="genericName" className="text-right">Generic Name</Label>
            <Input id="genericName" value={genericName} onChange={e => setGenericName(e.target.value)} className="col-span-3" />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="dose" className="text-right">Dose</Label>
            <Input id="dose" value={dose} onChange={e => setDose(e.target.value)} className="col-span-3" />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="quantity" className="text-right">Quantity</Label>
            <Input id="quantity" type="number" value={quantity} onChange={e => setQuantity(Number(e.target.value))} className="col-span-3" />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="location" className="text-right">Location</Label>
            <Input id="location" value={location} onChange={e => setLocation(e.target.value)} className="col-span-3" />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="type" className="text-right">Type</Label>
            <Select onValueChange={setType} value={type}>
              <SelectTrigger className="col-span-3">
                <SelectValue placeholder="Select type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="rapid">Rapid Acting</SelectItem>
                <SelectItem value="long">Long Acting</SelectItem>
                <SelectItem value="intermediate">Intermediate</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="administrativeForm" className="text-right">Form</Label>
            <Select onValueChange={setAdministrativeForm} value={administrativeForm}>
              <SelectTrigger className="col-span-3">
                <SelectValue placeholder="Select form" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="pen">Pen</SelectItem>
                <SelectItem value="injection">Injection</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="expirationDate" className="text-right">Expiration</Label>
            <Input id="expirationDate" type="date" value={expirationDate} onChange={e => setExpirationDate(e.target.value)} className="col-span-3" />
          </div>
        </div>
        <DialogFooter>
          <Button onClick={handleSave}>Save changes</Button>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

// --------------------------------------------------
// MoveModal Component
// --------------------------------------------------

interface MoveModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  medication: Medication | null;
  predefinedLocations: string[];
}

export function MoveModal({ open, onOpenChange, medication, predefinedLocations }: MoveModalProps) {
  const [moveQuantity, setMoveQuantity] = useState(1);
  const [newLocation, setNewLocation] = useState("");
  const [selectedLocation, setSelectedLocation] = useState("");
  const { toast } = useToast();

  // Firestore
  const dbRef = useRef<any>(null);
  const userIdRef = useRef<string | null>(null);

  useEffect(() => {
    const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
    const firebaseConfig = JSON.parse(typeof __firebase_config !== 'undefined' ? __firebase_config : '{}');
    const app = initializeApp(firebaseConfig);
    const auth = getAuth(app);
    const db = getFirestore(app);
    dbRef.current = db;

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        userIdRef.current = user.uid;
      } else {
        await signInAnonymously(auth);
      }
    });
    return () => unsubscribe();
  }, []);

  const handleMove = async () => {
    if (!medication) return;
    if (moveQuantity > (medication.quantity ?? 0)) {
      toast({
        title: "Error",
        description: "Cannot move more than available stock",
        variant: "destructive",
      });
      return;
    }
    if (!selectedLocation && !newLocation) {
        toast({
            title: "Error",
            description: "Please select a location or enter a new one",
            variant: "destructive",
        });
        return;
    }
    
    const db = dbRef.current;
    const userId = userIdRef.current;
    if (!db || !userId) {
        toast({
            title: "Error",
            description: "App not ready. Please try again.",
            variant: "destructive",
        });
        return;
    }

    try {
        const newLocationToUse = selectedLocation || newLocation;
        // Update the original medication's quantity and location
        const medicationRef = doc(db, `artifacts/${__app_id}/users/${userId}/medications`, medication.id);
        await updateDoc(medicationRef, { quantity: medication.quantity - moveQuantity });
        
        // Add a new medication entry with the moved quantity and new location
        const movedMedicationRef = doc(collection(db, `artifacts/${__app_id}/users/${userId}/medications`));
        await setDoc(movedMedicationRef, {
            ...medication,
            id: movedMedicationRef.id,
            quantity: moveQuantity,
            location: newLocationToUse,
        });

        const unit = (medication?.administrativeForm?.toLowerCase() === "pens")
            ? (moveQuantity === 1 ? "pen" : "pens")
            : (moveQuantity === 1 ? "injection" : "injections");

        toast({
            title: "Success",
            description: `Successfully moved ${moveQuantity} ${unit} to ${newLocationToUse}`,
            duration: 3000,
        });
        setMoveQuantity(1);
        setNewLocation("");
        setSelectedLocation("");
        onOpenChange(false);
    } catch (error) {
        console.error("Error moving medication:", error);
        toast({
            title: "Error",
            description: "Failed to move medication. Please try again.",
            variant: "destructive",
            duration: 3000,
        });
    }
  };

  const incrementQuantity = () => {
    if (medication && moveQuantity < (medication.quantity ?? 0)) {
      setMoveQuantity(moveQuantity + 1);
    }
  };

  const decrementQuantity = () => {
    if (moveQuantity > 1) {
      setMoveQuantity(moveQuantity - 1);
    }
  };

  if (!medication) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md" data-testid="modal-move-medication">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CornerRightDown className="h-5 w-5 text-indigo-600" />
            Move Medication
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <p className="text-sm text-gray-900" data-testid="text-medication-name">
              {medication.medicalName} ({medication.genericName})
            </p>
            <p className="text-xs text-gray-500 mt-1" data-testid="text-available-stock">
              Current Location: {medication.location ?? "—"} <br/>
              Current Quantity: {medication.quantity ?? "—"}
            </p>
          </div>
          
          <div>
            <Label htmlFor="moveQuantity">Quantity to Move</Label>
            <div className="flex items-center space-x-2 mt-1">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={decrementQuantity}
                disabled={moveQuantity <= 1}
                data-testid="button-decrement"
              >
                <Minus className="h-4 w-4" />
              </Button>
              <Input
                id="moveQuantity"
                type="number"
                min="1"
                max={medication.quantity}
                value={moveQuantity}
                onChange={(e) => setMoveQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                className="w-20 text-center"
                data-testid="input-move-quantity"
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={incrementQuantity}
                disabled={moveQuantity >= (medication.quantity || 0)}
                data-testid="button-increment"
              >
                <PlusIcon className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div>
            <Label htmlFor="location-select">Select a Destination</Label>
            <Select onValueChange={setSelectedLocation} value={selectedLocation}>
              <SelectTrigger id="location-select" className="mt-1">
                <SelectValue placeholder="Select a pre-saved location" />
              </SelectTrigger>
              <SelectContent>
                {predefinedLocations.map((loc, index) => (
                  <SelectItem key={index} value={loc}>
                    {loc}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          <div className="flex items-center space-x-2">
              <div className="flex-grow border-t border-gray-200"></div>
              <span className="flex-shrink text-xs text-gray-500">OR</span>
              <div className="flex-grow border-t border-gray-200"></div>
          </div>

          <div>
            <Label htmlFor="new-location-input">Enter a New Location</Label>
            <Input
              id="new-location-input"
              className="mt-1"
              placeholder="e.g., Shelf 3, Cabinet B"
              value={newLocation}
              onChange={(e) => {
                  setNewLocation(e.target.value);
                  setSelectedLocation("");
              }}
              disabled={!!selectedLocation}
            />
          </div>
        </div>

        <DialogFooter className="flex flex-col gap-3 pt-4 sm:flex-row sm:justify-end">
          <Button
            onClick={handleMove}
            className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white sm:flex-none"
            disabled={false} // Removed mutation.isPending since we're not using react-query
            data-testid="button-confirm-move"
          >
            <Check className="h-4 w-4 mr-2" />
            Confirm Move
          </Button>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            data-testid="button-cancel-move"
            className="sm:flex-none"
          >
            Cancel
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// --------------------------------------------------
// Main Inventory Component
// --------------------------------------------------

export default function Inventory() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedType, setSelectedType] = useState("all");
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isDispenseModalOpen, setIsDispenseModalOpen] = useState(false);
  const [isMoveModalOpen, setIsMoveModalOpen] = useState(false); // New state for Move modal
  const [selectedMedication, setSelectedMedication] = useState<Medication | null>(null);
  const [medications, setMedications] = useState<Medication[]>([]);
  const [locations, setLocations] = useState<string[]>([]);
  const dbRef = useRef<any>(null);
  const authRef = useRef<any>(null);
  const userIdRef = useRef<string | null>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
    const firebaseConfig = JSON.parse(typeof __firebase_config !== 'undefined' ? __firebase_config : '{}');
    const app = initializeApp(firebaseConfig);
    const auth = getAuth(app);
    const db = getFirestore(app);

    dbRef.current = db;
    authRef.current = auth;

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        userIdRef.current = user.uid;
        console.log("User authenticated:", user.uid);
      } else {
        await signInAnonymously(auth);
        console.log("Signed in anonymously");
      }
      setIsAuthReady(true);
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    let unsubscribe: () => void = () => {};
    if (isAuthReady && dbRef.current && userIdRef.current) {
      const db = dbRef.current;
      const userId = userIdRef.current;
      const medicationCollectionRef = collection(db, `artifacts/${__app_id}/users/${userId}/medications`);
      
      unsubscribe = onSnapshot(medicationCollectionRef, (querySnapshot) => {
        const meds: Medication[] = [];
        const uniqueLocations: Set<string> = new Set();
        querySnapshot.forEach((doc) => {
          const data = doc.data() as Medication;
          meds.push({ ...data, id: doc.id });
          if (data.location) {
            uniqueLocations.add(data.location);
          }
        });
        setMedications(meds);
        setLocations(Array.from(uniqueLocations));
      }, (error) => {
        console.error("Failed to fetch data:", error);
      });
    }
    return () => unsubscribe();
  }, [isAuthReady]);

  const addMedication = async (newMed: any) => {
    const db = dbRef.current;
    const userId = userIdRef.current;
    if (!db || !userId) {
      toast({
        title: "Error",
        description: "App not ready. Please try again.",
        variant: "destructive",
      });
      return;
    }
    try {
      await setDoc(doc(collection(db, `artifacts/${__app_id}/users/${userId}/medications`)), newMed);
      toast({
        title: "Success",
        description: "Medication added successfully!",
      });
    } catch (error) {
      console.error("Error adding document:", error);
      toast({
        title: "Error",
        description: "Failed to add medication. Please try again.",
        variant: "destructive",
      });
    }
  };

  const filteredMedications = useMemo(() => {
    let filtered = medications;
    filtered = filtered.filter((medication) => (medication.quantity ?? 0) > 0);

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (med) =>
          (med.genericName ?? "").toLowerCase().includes(query) ||
          (med.medicalName ?? "").toLowerCase().includes(query)
      );
    }

    if (selectedType !== "all") {
      filtered = filtered.filter((med) => med.type === selectedType);
    }
    return filtered;
  }, [medications, searchQuery, selectedType]);

  const handleDispense = (medication: Medication) => {
    setSelectedMedication(medication);
    setIsDispenseModalOpen(true);
  };
  
  const handleMove = (medication: Medication) => {
    setSelectedMedication(medication);
    setIsMoveModalOpen(true);
  };

  const scrollToTrackers = () => {
    if (typeof document !== "undefined") {
      const el = document.getElementById("low-stock-ticker");
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "start" });
        return;
      }
      window.scrollTo({ top: document.documentElement.scrollHeight, behavior: "smooth" });
    }
  };

  if (!isAuthReady) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-rose-400 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading medications…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gray-50 min-h-screen">
      <header className="bg-gradient-to-r from-rose-50 via-white to-emerald-50 shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <Syringe className="h-6 w-6 text-rose-600 mr-3" />
              <h1 className="text-xl font-semibold text-rose-700">Insulin Inventory</h1>
            </div>
            <div className="flex items-center space-x-4">
              <span className="text-lg text-gray-600 font-medium tracking-wide">SLO Noor Foundation</span>
              <img src={logo} alt="SLO Noor Foundation logo" className="h-14 w-auto object-contain" data-testid="logo" />
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Card className="mb-8">
          <CardContent className="p-6">
            <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between space-y-4 lg:space-y-0 lg:space-x-4">
              <div className="flex-1 max-w-lg">
                <Label htmlFor="medication-search" className="block text-sm font-medium text-gray-700 mb-2">
                  Search medications
                </Label>
                <div className="relative">
                  <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                  <Input
                    id="medication-search"
                    placeholder="Search by generic or medical name"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                    data-testid="input-search-medication"
                  />
                </div>
              </div>

              <div className="flex gap-3 flex-shrink-0">
                <Button
                  onClick={scrollToTrackers}
                  size="sm"
                  variant="outline"
                  className="flex items-center border-rose-200 text-rose-700 hover:bg-rose-50"
                  data-testid="button-jump-low-outstock"
                  title="Jump to low / out of stock trackers"
                >
                  <List className="h-4 w-4 mr-2" />
                  Low / Out of Stock
                </Button>

                <TransactionHistory />

                <Button
                  onClick={() => setIsAddModalOpen(true)}
                  className="bg-rose-600 hover:bg-rose-700 text-white"
                  data-testid="button-add-medication"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add Medication
                </Button>
              </div>
            </div>

            <div className="mt-6">
              <Label className="block text-sm font-medium text-gray-700 mb-3">Filter by insulin type</Label>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant={selectedType === "all" ? "default" : "outline"}
                  onClick={() => setSelectedType("all")}
                  className={`text-sm ${selectedType === "all" ? "bg-white text-gray-700" : "text-gray-700"}`}
                  data-testid="filter-all"
                >
                  <List className="h-4 w-4 mr-2" /> All types
                </Button>

                {Object.entries(typeLabels).map(([type, label]) => {
                  const Icon = typeIcons[type as keyof typeof typeIcons];
                  const selectedCls = (filterSelectedClasses as any)[type];
                  const hoverCls = (filterHoverClasses as any)[type];

                  return (
                    <Button
                      key={type}
                      variant={selectedType === type ? "default" : "outline"}
                      onClick={() => setSelectedType(type)}
                      className={`text-sm ${selectedType === type ? selectedCls : `border-gray-200 ${hoverCls}`} `}
                      data-testid={`filter-${type}`}
                    >
                      <Icon className="h-4 w-4 mr-2" />
                      {label}
                    </Button>
                  );
                })}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg font-medium text-gray-900">Current insulin inventory</CardTitle>
            <p className="text-sm text-gray-600">Manage and track all insulin medications in your clinic</p>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-sm font-medium text-gray-600">Medication</th>
                    <th className="px-6 py-3 text-left text-sm font-medium text-gray-600">Administrative form</th>
                    <th className="px-6 py-3 text-left text-sm font-medium text-gray-600">Insulin type</th>
                    <th className="px-6 py-3 text-left text-sm font-medium text-gray-600">Dose</th>
                    <th className="px-6 py-3 text-left text-sm font-medium text-gray-600">Quantity</th>
                    <th className="px-6 py-3 text-left text-sm font-medium text-gray-600">Expiration</th>
                    <th className="px-6 py-3 text-left text-sm font-medium text-gray-600">Location</th>
                    <th className="px-6 py-3 text-left text-sm font-medium text-gray-600">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredMedications.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-6 py-12 text-center text-gray-500">
                        {searchQuery || selectedType !== "all"
                          ? "No medications found matching your criteria."
                          : "No medications in inventory. Add your first medication to get started."}
                      </td>
                    </tr>
                  ) : (
                    filteredMedications.map((medication) => {
                      const daysUntilExpiration = calculateDaysUntilExpiration(medication.expirationDate);
                      const Icon = typeIcons[medication.type as keyof typeof typeIcons];

                      const adminFormValue =
                        (medication.administrativeForm as string | undefined) ||
                        (medication.formType as string | undefined) ||
                        "";
                      const adminFormDisplay =
                        adminFormValue.toLowerCase() === "pen" ? "Pen" : adminFormValue.toLowerCase() === "injection" ? "Injection" : "—";
                      
                      const rowTint = getRowClassName(medication.type);

                      return (
                        <tr
                          key={medication.id}
                          className={`${rowTint} hover:bg-gray-50`}
                          data-testid={`row-medication-${medication.id}`}
                        >
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div>
                              <div className="text-sm font-medium text-gray-900" data-testid="text-medical-name">
                                {medication.medicalName ?? medication.genericName ?? "—"}
                              </div>
                              <div className="text-sm text-gray-500" data-testid="text-generic-name">
                                {medication.genericName ? `(${medication.genericName})` : ""}
                              </div>
                            </div>
                          </td>

                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900" data-testid="text-administrative-form">
                            {adminFormDisplay}
                          </td>

                          <td className="px-6 py-4 whitespace-nowrap">
                            <Badge className={(badgeColors as any)[medication.type]}>
                              <Icon className="h-3 w-3 mr-1" />
                              {(typeLabels as any)[medication.type]}
                            </Badge>
                          </td>

                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900" data-testid="text-dose">
                            {medication.dose}
                          </td>

                          <td className="px-6 py-4 whitespace-nowrap">
                            <span
                              className={`text-sm font-medium ${
                                (medication.quantity ?? 0) <= 5 ? "text-red-600" : "text-gray-900"
                              }`}
                              data-testid="text-quantity"
                            >
                              {medication.quantity ?? 0}
                            </span>
                            {(medication.quantity ?? 0) <= 5 && <div className="text-xs text-red-600">Low stock</div>}
                          </td>

                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className="text-sm text-gray-900" data-testid="text-expiration-date">
                              {medication.expirationDate ? new Date(medication.expirationDate).toLocaleDateString() : "—"}
                            </span>
                          </td>

                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500" data-testid="text-location">
                            {medication.location ?? "—"}
                          </td>

                          <td className="px-6 py-4 whitespace-nowrap space-x-2">
                            <Button
                              onClick={() => handleDispense(medication)}
                              size="sm"
                              className="bg-emerald-600 hover:bg-emerald-700 text-white"
                              disabled={(medication.quantity ?? 0) === 0}
                              data-testid={`button-dispense-${medication.id}`}
                            >
                              <HandHeart className="h-4 w-4 mr-1" />
                              Dispense
                            </Button>
                            <Button
                                onClick={() => handleMove(medication)}
                                size="sm"
                                variant="outline"
                                className="border-indigo-200 text-indigo-700 hover:bg-indigo-50"
                                disabled={(medication.quantity ?? 0) === 0}
                                data-testid={`button-move-${medication.id}`}
                            >
                                <CornerRightDown className="h-4 w-4 mr-1" />
                                Move
                            </Button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        <div id="low-stock-ticker" className="mt-8">
          <LowStockTicker />
        </div>

        <OutOfStockTracker />
      </main>

      <AddMedicationModal
        open={isAddModalOpen}
        onOpenChange={setIsAddModalOpen}
        onSave={addMedication}
      />

      <DispenseModal open={isDispenseModalOpen} onOpenChange={setIsDispenseModalOpen} medication={selectedMedication} />
      <MoveModal open={isMoveModalOpen} onOpenChange={setIsMoveModalOpen} medication={selectedMedication} predefinedLocations={locations} />
    </div>
  );
}

// --------------------------------------------------
// App Wrapper
// --------------------------------------------------

export default function App() {
  return (
    <ToastProvider>
      <Inventory />
    </ToastProvider>
  );
}
