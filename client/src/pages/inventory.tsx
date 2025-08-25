import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { AddMedicationModal } from "@/components/add-medication-modal";
import { DispenseModal } from "@/components/dispense-modal";
import { MoveModal } from "@/components/move-modal";
import { LowStockTicker } from "@/components/low-stock-ticker";
import { OutOfStockTracker } from "@/components/out-of-stock-tracker";
import { TransactionHistory } from "@/components/transaction-history";
import { type Medication } from "@shared/schema";
import { formatToISODate } from "@shared/dateUtils";
import { Search, Plus, HandHeart, Syringe, Zap, Clock, Scale, HelpCircle, List, ArrowRightLeft } from "lucide-react";
import logo from "../assets/noor-logo.png";

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

const calculateDaysUntilExpiration = (expirationDate: string) => {
  const today = new Date();
  const formattedExpirationDate = formatToISODate(expirationDate);
  const expiry = new Date(formattedExpirationDate);
  const diffTime = expiry.getTime() - today.getTime();
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
};

const getExpirationClassName = (days: number) => {
  if (days < 30) return "text-red-600";
  if (days < 90) return "text-orange-600";
  return "text-green-600";
};

export default function Inventory() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedType, setSelectedType] = useState("all");
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isDispenseModalOpen, setIsDispenseModalOpen] = useState(false);
  const [selectedMedication, setSelectedMedication] = useState<Medication | null>(null);
  const [isMoveModalOpen, setIsMoveModalOpen] = useState(false);
  const [selectedMoveMedication, setSelectedMoveMedication] = useState<Medication | null>(null);

  const { data: medications = [], isLoading } = useQuery({
    queryKey: ["/api/medications"],
  });

  // only render the out-of-stock tracker if there's at least one med at 0 qty
  const outOfStockCount = useMemo(
    () => medications.filter((m) => (m.quantity ?? 0) === 0).length,
    [medications]
  );

  const filteredMedications = useMemo(() => {
    let filtered = medications.filter((med) => (med.quantity ?? 0) > 0);

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
    setSelectedMoveMedication(medication);
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

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="text-xl font-semibold text-gray-600 mb-2">Loading medications…</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="container mx-auto px-4 py-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <img src={logo} alt="Noor Logo" className="h-12 w-12" />
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Insulin Inventory</h1>
              <p className="text-gray-600">Track and manage your insulin medications</p>
            </div>
          </div>
        </div>

        {/* Search and Controls */}
        <div className="flex flex-col lg:flex-row gap-4 mb-6">
          <div className="flex-1">
            <Label htmlFor="search" className="sr-only">
              Search medications
            </Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
              <Input
                id="search"
                placeholder="Search by medication name..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
                data-testid="input-search-medication"
              />
            </div>
          </div>

          <div className="flex gap-2">
            <Button
              onClick={() => setIsAddModalOpen(true)}
              className="bg-green-600 hover:bg-green-700"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Medication
            </Button>
            <Button variant="outline" onClick={scrollToTrackers}>
              <List className="h-4 w-4 mr-2" />
              View Trackers
            </Button>
          </div>
        </div>

        {/* Type Filters */}
        <div className="mb-6">
          <Label className="text-sm font-medium text-gray-700 mb-3 block">
            Filter by insulin type
          </Label>
          <div className="flex flex-wrap gap-2">
            <Button
              variant={selectedType === "all" ? "default" : "outline"}
              size="sm"
              onClick={() => setSelectedType("all")}
              className={selectedType === "all" ? "bg-gray-800 text-white" : ""}
            >
              All Types
            </Button>
            {Object.entries(typeLabels).map(([type, label]) => {
              const Icon = typeIcons[type as keyof typeof typeIcons];
              const selectedCls = (filterSelectedClasses as any)[type];
              const hoverCls = (filterHoverClasses as any)[type];
              return (
                <Button
                  key={type}
                  variant="outline"
                  size="sm"
                  onClick={() => setSelectedType(type)}
                  className={`${selectedType === type ? selectedCls : ""} ${hoverCls}`}
                >
                  <Icon className="h-4 w-4 mr-1" />
                  {label}
                </Button>
              );
            })}
          </div>
        </div>

        {/* Inventory Table */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-xl">Current insulin inventory</CardTitle>
            <p className="text-sm text-gray-600">Manage and track all insulin medications in your clinic</p>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left p-4 font-medium text-gray-700">Medication</th>
                    <th className="text-left p-4 font-medium text-gray-700">Administrative form</th>
                    <th className="text-left p-4 font-medium text-gray-700">Insulin type</th>
                    <th className="text-left p-4 font-medium text-gray-700">Dose</th>
                    <th className="text-left p-4 font-medium text-gray-700">Quantity</th>
                    <th className="text-left p-4 font-medium text-gray-700">Expiration</th>
                    <th className="text-left p-4 font-medium text-gray-700">Location</th>
                    <th className="text-right p-4 font-medium text-gray-700">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredMedications.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="text-center p-8 text-gray-500">
                        {searchQuery || selectedType !== "all"
                          ? "No medications found matching your criteria."
                          : "No medications in inventory. Add your first medication to get started."}
                      </td>
                    </tr>
                  ) : (
                    filteredMedications.map((medication) => {
                      const days = calculateDaysUntilExpiration(medication.expirationDate);
                      const expClass = getExpirationClassName(days);
                      const Icon = typeIcons[medication.type as keyof typeof typeIcons];
                      const adminValue =
                        (medication.administrativeForm as string | undefined) ||
                        (medication.formType as string | undefined) ||
                        "";
                      const adminDisplay =
                        adminValue.toLowerCase() === "pen"
                          ? "Pen"
                          : adminValue.toLowerCase() === "injection"
                          ? "Injection"
                          : "—";
                      const rowTint = getRowClassName(medication.type);

                      return (
                        <tr key={medication.id} className={`border-b border-gray-100 ${rowTint}`}>
                          <td className="p-4">
                            <div className="font-medium">
                              {medication.medicalName ?? medication.genericName ?? "—"}
                            </div>
                            <div className="text-sm text-gray-500">
                              {medication.genericName ? `(${medication.genericName})` : ""}
                            </div>
                          </td>
                          <td className="p-4">{adminDisplay}</td>
                          <td className="p-4">
                            <Badge className={(badgeColors as any)[medication.type]}>
                              <Icon className="h-3 w-3 mr-1" />
                              {(typeLabels as any)[medication.type]}
                            </Badge>
                          </td>
                          <td className="p-4">{medication.dose}</td>
                          <td className="p-4">
                            <div className="flex items-center gap-2">
                              <span className="font-medium">{medication.quantity}</span>
                              {medication.quantity! <= 5 && (
                                <Badge variant="destructive" className="text-xs">
                                  Low stock
                                </Badge>
                              )}
                            </div>
                          </td>
                          <td className={`p-4 ${expClass}`}>
                            {medication.expirationDate ? formatToISODate(medication.expirationDate) : "—"}
                          </td>
                          <td className="p-4">{medication.location ?? "—"}</td>
                          <td className="p-4 text-right space-x-2">
                            <Button
                              size="sm"
                              onClick={() => handleDispense(medication)}
                              className="bg-blue-600 hover:bg-blue-700"
                            >
                              <HandHeart className="h-4 w-4 mr-1" />
                              Dispense
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleMove(medication)}
                              className="border-green-600 text-green-600 hover:bg-green-50"
                            >
                              <ArrowRightLeft className="h-4 w-4 mr-1" />
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

        {/* Give the LowStockTicker a stable id so the button can scroll to it */}
        <div id="low-stock-ticker">
          <LowStockTicker />
        </div>

        {outOfStockCount > 0 && <OutOfStockTracker />}

        <TransactionHistory />
      </div>

      <AddMedicationModal
        open={isAddModalOpen}
        onOpenChange={setIsAddModalOpen}
        onSave={(newMed) => {
          medications.push(newMed);
          setIsAddModalOpen(false);
        }}
      />

      <DispenseModal
        open={isDispenseModalOpen}
        onOpenChange={setIsDispenseModalOpen}
        medication={selectedMedication}
      />

      <MoveModal
        open={isMoveModalOpen}
        onOpenChange={setIsMoveModalOpen}
        medication={selectedMoveMedication}
      />
    </div>
  );
}
2. Updated routes.ts
typescript
import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { GoogleSheetsStorage } from "./googleSheetsStorage";
import { insertMedicationSchema } from "@shared/schema";
import { z } from "zod";

const dispenseSchema = z.object({
  medicationId: z.string(),
  quantity: z.number().min(1),
});

const moveSchema = z.object({
  medicationId: z.string(),
  quantity: z.number().min(1),
  destinationLocation: z.string().min(1),
});

export async function registerRoutes(app: Express): Promise<Server> {
  app.get("/api/medications", async (req, res) => {
    try {
      const meds = await storage.getMedications();
      res.json(meds);
    } catch {
      res.status(500).json({ error: "Failed to fetch medications" });
    }
  });

  app.get("/api/medications/search", async (req, res) => {
    try {
      const q = req.query.q as string;
      if (!q) return res.status(400).json({ error: "Search query is required" });
      const results = await storage.searchMedications(q);
      res.json(results);
    } catch {
      res.status(500).json({ error: "Failed to search medications" });
    }
  });

  app.get("/api/medications/filter/:type", async (req, res) => {
    try {
      const { type } = req.params;
      const filtered = await storage.filterMedicationsByType(type);
      res.json(filtered);
    } catch {
      res.status(500).json({ error: "Failed to filter medications" });
    }
  });

  app.post("/api/medications", async (req, res) => {
    try {
      const data = insertMedicationSchema.parse(req.body);
      const result = await storage.createMedication(data);
      const { medication, isNewMedication, addedQuantity } = result;

      // Single transaction for both new and stock increases
      await storage.createTransaction({
        medicationId: medication.id,
        medicationName: `${medication.medicalName} (${medication.genericName}) - ${medication.administrativeForm}`,
        type: "addition", // always "Added"
        quantity: addedQuantity,
        dose: medication.dose,
        notes: isNewMedication
          ? "New medication added to inventory"
          : "Medication quantity increased in existing stock",
      });

      res.status(201).json(medication);
    } catch (e) {
      res.status(e instanceof z.ZodError ? 400 : 500).json({
        error: e instanceof z.ZodError ? "Invalid data" : "Failed to create medication",
      });
    }
  });

  app.put("/api/medications/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const data = insertMedicationSchema.parse(req.body);

      const original = await storage.getMedicationById(id);
      if (!original) return res.status(404).json({ error: "Medication not found" });

      const updated = await storage.updateMedication(id, data);
      if (!updated) return res.status(404).json({ error: "Medication not found" });

      const originalQty = original.quantity || 0;
      const newQty = updated.quantity || 0;
      if (newQty > originalQty) {
        const addedQty = newQty - originalQty;
        await storage.createTransaction({
          medicationId: id,
          medicationName: `${updated.medicalName} (${updated.genericName}) - ${updated.administrativeForm}`,
          type: "addition", // logs "Added" for stock increases
          quantity: addedQty,
          dose: updated.dose,
          notes: "Medication quantity increased in existing stock",
        });
      }

      res.json(updated);
    } catch (e) {
      res.status(e instanceof z.ZodError ? 400 : 500).json({
        error: e instanceof z.ZodError ? "Invalid data" : "Failed to update medication",
      });
    }
  });

  app.post("/api/medications/dispense", async (req, res) => {
    try {
      const { medicationId, quantity } = dispenseSchema.parse(req.body);
      const med = await storage.getMedicationById(medicationId);
      if (!med) return res.status(404).json({ error: "Medication not found" });
      if (med.quantity < quantity) return res.status(400).json({ error: "Insufficient stock" });

      const updated = await storage.updateMedicationQuantity(medicationId, med.quantity - quantity);
      await storage.createTransaction({
        medicationId: med.id,
        medicationName: `${med.medicalName} (${med.genericName}) - ${med.administrativeForm}`,
        type: "dispensed",
        quantity,
        dose: med.dose,
        notes: "Dispensed to patient",
      });

      res.json(updated);
    } catch (e) {
      res.status(e instanceof z.ZodError ? 400 : 500).json({
        error: e instanceof z.ZodError ? "Invalid data" : "Failed to dispense medication",
      });
    }
  });

  app.post("/api/medications/move", async (req, res) => {
    try {
      const { medicationId, quantity, destinationLocation } = moveSchema.parse(req.body);
      
      const sourceMed = await storage.getMedicationById(medicationId);
      if (!sourceMed) {
        return res.status(404).json({ error: "Source medication not found" });
      }
      
      if (sourceMed.quantity < quantity) {
        return res.status(400).json({ error: "Insufficient stock to move" });
      }

      if (sourceMed.location === destinationLocation) {
        return res.status(400).json({ error: "Source and destination locations cannot be the same" });
      }

      const result = await storage.moveMedication(medicationId, quantity, destinationLocation);
      
      // Create transaction records for the move
      await storage.createTransaction({
        medicationId: sourceMed.id,
        medicationName: `${sourceMed.medicalName} (${sourceMed.genericName}) - ${sourceMed.administrativeForm}`,
        type: "moved",
        quantity: -quantity, // negative for source
        dose: sourceMed.dose,
        notes: `Moved to ${destinationLocation}`,
      });

      if (result.destinationMedication) {
        await storage.createTransaction({
          medicationId: result.destinationMedication.id,
          medicationName: `${result.destinationMedication.medicalName} (${result.destinationMedication.genericName}) - ${result.destinationMedication.administrativeForm}`,
          type: "moved",
          quantity: quantity, // positive for destination
          dose: result.destinationMedication.dose,
          notes: `Moved from ${sourceMed.location}`,
        });
      }

      res.json(result);
    } catch (e) {
      res.status(e instanceof z.ZodError ? 400 : 500).json({
        error: e instanceof z.ZodError ? "Invalid data" : "Failed to move medication",
      });
    }
  });

  app.get("/api/medications/low-stock", async (_, res) => {
    try {
      const meds = await storage.getLowStockMedications();
      res.json(meds);
    } catch {
      res.status(500).json({ error: "Failed to fetch low stock medications" });
    }
  });

  app.get("/api/medications/out-of-stock", async (_, res) => {
    try {
      const meds = await storage.getOutOfStockMedications();
      res.json(meds);
    } catch {
      res.status(500).json({ error: "Failed to fetch out of stock medications" });
    }
  });

  app.get("/api/transactions", async (_, res) => {
    try {
      const txs = await storage.getTransactions();
      res.json(txs);
    } catch {
      res.status(500).json({ error: "Failed to fetch transactions" });
    }
  });

  return createServer(app);
}
