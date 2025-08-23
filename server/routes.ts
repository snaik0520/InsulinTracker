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
    } catch {
      res.status(500).json({ error: "Failed to fetch medications" });
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

  app.post("/api/medications", async (req, res) => {
    try {
      const data = insertMedicationSchema.parse(req.body);
      // Now returns addedQuantity along with medication
      const { medication, addedQuantity } = await storage.createMedication(data);

      if (!(storage instanceof GoogleSheetsStorage)) {
        await storage.createTransaction({
          medicationId: medication.id,
          medicationName: `${medication.medicalName} (${medication.genericName}) - ${medication.administrativeForm}`,
          type: "addition",
          quantity: addedQuantity,
          dose: medication.dose,
          notes: data.quantity === addedQuantity
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
          dose: med.dose,
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

  // … other routes unchanged …

  return createServer(app);
}
