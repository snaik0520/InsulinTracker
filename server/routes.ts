import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { GoogleSheetsStorage } from './googleSheetsStorage';
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
      console.error('Error fetching medications:', error);
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
      console.error('Error searching medications:', error);
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
      console.error('Error filtering medications:', error);
      res.status(500).json({ error: "Failed to filter medications" });
    }
  });

  // Add new medication
  app.post("/api/medications", async (req, res) => {
    try {
      const medicationData = insertMedicationSchema.parse(req.body);
      const medication = await storage.createMedication(medicationData);
      
      // For MemStorage, manually log the transaction
      // For GoogleSheetsStorage, handled automatically in createMedication method
      if (!(storage instanceof GoogleSheetsStorage)) {
        await storage.createTransaction({
          medicationId: medication.id,
          medicationName: `${medication.medicalName} (${medication.genericName}) - ${medication.administrativeForm}`,
          type: "addition",
          quantity: medication.quantity,
          notes: "New medication added to inventory"
        });
      }
      
      res.status(201).json(medication);
    } catch (error) {
      console.error('Error creating medication:', error);
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: "Invalid medication data", details: error.errors });
      } else {
        res.status(500).json({ error: "Failed to create medication" });
      }
    }
  });

  // NEW: Update existing medication by ID
  app.put("/api/medications/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const medicationData = insertMedicationSchema.parse(req.body);

      // Update medication in storage
      if (storage.updateMedication) {
        const updatedMedication = await storage.updateMedication(id, medicationData);

        if (!updatedMedication) {
          return res.status(404).json({ error: "Medication not found" });
        }

        // Add synchronization with Google Sheets if your storage implementation requires

        res.json(updatedMedication);
      } else {
        res.status(501).json({ error: "Update operation not implemented in storage" });
      }
    } catch (error) {
      console.error('Error updating medication:', error);
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: "Invalid medication data", details: error.errors });
      } else {
        res.status(500).json({ error: "Failed to update medication" });
      }
    }
  });

  // Dispense medication
  app.post("/api/medications/dispense", async (req, res) => {
    try {
      const { medicationId, quantity } = dispenseSchema.parse(req.body);
      
      // Check if we're using GoogleSheetsStorage
      if (storage instanceof GoogleSheetsStorage) {
        // Use the combined dispense method for Google Sheets
        const result = await storage.dispenseMedication(medicationId, quantity);
        res.json(result.medication);
      } else {
        // Keep existing logic for MemStorage
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
          medicationName: `${medication.medicalName} (${medication.genericName}) - ${medication.administrativeForm}`,
          type: "dispensed",
          quantity: quantity,
          notes: `Dispensed to patient`
        });
        res.json(updatedMedication);
      }
    } catch (error) {
      console.error('Error dispensing medication:', error);
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: "Invalid dispense data", details: error.errors });
      } else if (error.message.includes('Insufficient stock') || error.message.includes('not found')) {
        res.status(400).json({ error: error.message });
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
      console.error('Error fetching low stock medications:', error);
      res.status(500).json({ error: "Failed to fetch low stock medications" });
    }
  });

  // Get out of stock medications
  app.get("/api/medications/out-of-stock", async (req, res) => {
    try {
      // Check if storage has the getOutOfStockMedications method
      if ('getOutOfStockMedications' in storage) {
        const outOfStockMedications = await storage.getOutOfStockMedications();
        res.json(outOfStockMedications);
      } else {
        // Fallback: get medications and filter for quantity = 0
        const medications = await storage.getMedications();
        const outOfStockMedications = medications.filter(medication => medication.quantity === 0);
        res.json(outOfStockMedications);
      }
    } catch (error) {
      console.error('Error fetching out of stock medications:', error);
      res.status(500).json({ error: "Failed to fetch out of stock medications" });
    }
  });

  // Get medication transactions
  app.get("/api/transactions", async (req, res) => {
    try {
      const transactions = await storage.getTransactions();
      res.json(transactions);
    } catch (error) {
      console.error('Error fetching transactions:', error);
      res.status(500).json({ error: "Failed to fetch transactions" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
