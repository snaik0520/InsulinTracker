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

  // Add this route in server/routes.ts
app.delete("/api/medications/:id", async (req, res) => {
  try {
    const { id } = req.params;
    
    // Get the medication before deleting (for transaction record)
    const medication = await storage.getMedicationById(id);
    if (!medication) {
      return res.status(404).json({ error: "Medication not found" });
    }
    
    // Delete the medication
    const deleted = await storage.deleteMedication(id);
    if (!deleted) {
      return res.status(404).json({ error: "Medication not found" });
    }
    
    // Create a transaction record for the deletion
    await storage.createTransaction({
      medicationId: id,
      medicationName: `${medication.medicalName} (${medication.genericName}) - ${medication.administrativeForm}`,
      type: "dispensed", // or create a new "removed" type if preferred
      quantity: medication.quantity,
      dose: medication.dose,
      notes: "Medication removed from inventory (cleared from out-of-stock tracker)",
    });
    
    res.json({ success: true, message: "Medication deleted successfully" });
  } catch (error) {
    res.status(500).json({ 
      error: "Failed to delete medication",
      details: error.toString()
    });
  }
});

  app.post("/api/medications/move", async (req, res) => {
    try {
      const { medicationId, quantity, destinationLocation } = moveSchema.parse(req.body);
      const result = await storage.moveMedication(medicationId, quantity, destinationLocation);

      if (!result.success) {
        return res.status(400).json({ error: result.error });
      }

      // Create transaction for the move operation
      const sourceMed = result.sourceMedication!;
      await storage.createTransaction({
        medicationId: sourceMed.id,
        medicationName: `${sourceMed.medicalName} (${sourceMed.genericName}) - ${sourceMed.administrativeForm}`,
        type: "move",
        quantity,
        dose: sourceMed.dose,
        notes: `Moved ${quantity} units from "${sourceMed.location}" to "${destinationLocation}"`,
      });

      res.json({
        sourceMedication: result.sourceMedication,
        destinationMedication: result.destinationMedication,
        message: result.message
      });
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
