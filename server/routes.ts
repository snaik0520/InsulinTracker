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

export async function registerRoutes(app: Express): Promise<Server> {
  app.get("/api/medications", async (req, res) => {
    try {
      const meds = await storage.getMedications();
      res.json(meds);
    } catch (e) {
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
      const { medication, isNewMedication, addedQuantity } = await storage.createMedication(data);

      // Create transaction for both new medications and additions to existing stock
      if (!(storage instanceof GoogleSheetsStorage)) {
        await storage.createTransaction({
          medicationId: medication.id,
          medicationName: `${medication.medicalName} (${medication.genericName}) - ${medication.administrativeForm}`,
          type: "addition",
          quantity: addedQuantity, // Use the added quantity, not the total quantity
          dose: medication.dose,    // Include dose information
          notes: isNewMedication
            ? "New medication added to inventory"
            : "Medication quantity increased in existing stock",
        });
      }

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
      const updated = await storage.updateMedication(id, data);
      if (!updated) return res.status(404).json({ error: "Medication not found" });
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
      if (storage instanceof GoogleSheetsStorage) {
        const result = await storage.dispenseMedication(medicationId, quantity);
        res.json(result.medication);
      } else {
        const med = await storage.getMedicationById(medicationId);
        if (!med) return res.status(404).json({ error: "Medication not found" });
        if (med.quantity < quantity) return res.status(400).json({ error: "Insufficient stock" });
        const updated = await storage.updateMedicationQuantity(medicationId, med.quantity - quantity);
        await storage.createTransaction({
          medicationId: med.id,
          medicationName: `${med.medicalName} (${med.genericName}) - ${med.administrativeForm}`,
          type: "dispensed",
          quantity,
          dose: med.dose, // Include dose information
          notes: "Dispensed to patient",
        });
        res.json(updated);
      }
    } catch (e) {
      res.status(e instanceof z.ZodError ? 400 : 500).json({
        error: e instanceof z.ZodError ? "Invalid data" : "Failed to dispense medication",
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
