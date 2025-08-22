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

  // Update existing medication by ID
  app.put("/api/medications/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const medicationData = insertMedicationSchema.parse(req.body);

      if (storage.updateMedication) {
        const updatedMedication = await storage.updateMedication(id, medicationData);

        if (!updatedMedication) {
          return res.status(404).json({ error: "Medication not found" });
        }

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

  // DELETE medication by ID
  app.delete("/api/medications/:id", async (req, res) => {
    try {
      const { id } = req.params;

      if (storage.deleteMedication) {
        const deleted = await storage.deleteMedication(id);

        if (!deleted) {
          return res.status(404).json({ error: "Medication not found" });
        }

        res.json({ message: "Medication deleted successfully", deleted });
      } else {
        res.status(501).json({ error: "Delete operation not implemented in storage" });
      }
    } catch (error) {
      console.error('Error deleting medication:', error);
      res.status(500).json({ error: "Failed to delete medication" });
    }
  });

  // Bulk delete all out-of-stock medications
  app.delete("/api/medications/out-of-stock/bulk", async (req, res) => {
    try {
      if (storage.deleteOutOfStockMedications) {
        const deletedCount = await storage.deleteOutOfStockMedications();
        res.json({ message: `Successfully deleted ${deletedCount} out-of-stock medications`, deletedCount });
      } else {
        const outOfStockMedications = await storage.getMedications();
        const toDelete = outOfStockMedications.filter(med => med.quantity === 0);
        
        let deletedCount = 0;
        for (const med of toDelete) {
          if (storage.deleteMedication) {
            const deleted = await storage.deleteMedication(med.id);
            if (deleted) deletedCount++;
          }
        }
        
        res.json({ message: `Successfully deleted ${deletedCount} out-of-stock medications`, deletedCount });
      }
    } catch (error) {
      console.error('Error bulk deleting out-of-stock medications:', error);
      res.status(500).json({ error: "Failed to delete out-of-stock medications" });
    }
  });

  // Dispense medication endpoint (unchanged)
  app.post("/api/medications/dispense", async (req, res) => {
    try {
      const { medicationId, quantity } = dispenseSchema.parse(req.body);
      
      if (storage instanceof GoogleSheetsStorage) {
        const result = await storage.dispenseMedication(medicationId, quantity);
        res.json(result.medication);
      } else {
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
        await storage.createTransaction({
          medicationId: medication.id,
          medicationName: `${medication.medicalName} (${medication.genericName}) - ${medication.administrativeForm}`,
          type: "dispensed",
          quantity,
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

  // Low stock medications, out-of-stock medications, transactions endpoints unchanged...

  const httpServer = createServer(app);
  return httpServer;
}
