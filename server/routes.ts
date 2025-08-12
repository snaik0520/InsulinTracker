import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertMedicationSchema, insertTransactionSchema } from "@shared/schema";
import { z } from "zod";

const dispenseSchema = z.object({
  medicationId: z.string(),
  quantity: z.number().min(1),
});

export async function registerRoutes(app: Express): Promise<Server> {
  // Get all medications
  app.get("/api/medications", async (req, res) => {
    try {
      const medications = await storage.getMedications();
      res.json(medications);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch medications" });
    }
  });

  // Search medications
  app.get("/api/medications/search", async (req, res) => {
    try {
      const query = req.query.q as string;
      if (!query) {
        return res.status(400).json({ error: "Search query is required" });
      }
      
      const medications = await storage.searchMedications(query);
      res.json(medications);
    } catch (error) {
      res.status(500).json({ error: "Failed to search medications" });
    }
  });

  // Filter medications by type
  app.get("/api/medications/filter/:type", async (req, res) => {
    try {
      const type = req.params.type;
      const medications = await storage.filterMedicationsByType(type);
      res.json(medications);
    } catch (error) {
      res.status(500).json({ error: "Failed to filter medications" });
    }
  });

  // Add new medication
  app.post("/api/medications", async (req, res) => {
    try {
      const medicationData = insertMedicationSchema.parse(req.body);
      const medication = await storage.createMedication(medicationData);
      
      // Log the addition transaction
      await storage.createTransaction({
        medicationId: medication.id,
        medicationName: `${medication.genericName} (${medication.medicalName})`,
        type: "addition",
        quantity: medication.quantity,
        notes: "New medication added to inventory"
      });
      
      res.status(201).json(medication);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: "Invalid medication data", details: error.errors });
      } else {
        res.status(500).json({ error: "Failed to create medication" });
      }
    }
  });

  // Dispense medication
  app.post("/api/medications/dispense", async (req, res) => {
    try {
      const { medicationId, quantity } = dispenseSchema.parse(req.body);
      
      const medication = await storage.getMedicationById(medicationId);
      if (!medication) {
        return res.status(404).json({ error: "Medication not found" });
      }

      if (medication.quantity < quantity) {
        return res.status(400).json({ error: "Insufficient stock" });
      }

      const updatedMedication = await storage.updateMedicationQuantity(
        medicationId,
        medication.quantity - quantity
      );

      // Log the dispensing transaction
      await storage.createTransaction({
        medicationId: medication.id,
        medicationName: `${medication.genericName} (${medication.medicalName})`,
        type: "dispensed",
        quantity: quantity,
        notes: `Dispensed to patient`
      });

      res.json(updatedMedication);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: "Invalid dispense data", details: error.errors });
      } else {
        res.status(500).json({ error: "Failed to dispense medication" });
      }
    }
  });

  // Get low stock medications
  app.get("/api/medications/low-stock", async (req, res) => {
    try {
      const threshold = req.query.threshold ? parseInt(req.query.threshold as string) : 5;
      const lowStockMedications = await storage.getLowStockMedications(threshold);
      res.json(lowStockMedications);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch low stock medications" });
    }
  });

  // Get out of stock medications
  app.get("/api/medications/out-of-stock", async (req, res) => {
    try {
      const outOfStockMedications = await storage.getOutOfStockMedications();
      res.json(outOfStockMedications);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch out of stock medications" });
    }
  });

  // Get medication transactions
  app.get("/api/transactions", async (req, res) => {
    try {
      const transactions = await storage.getTransactions();
      res.json(transactions);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch transactions" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
