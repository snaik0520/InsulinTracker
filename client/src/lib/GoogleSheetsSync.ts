// server/googleSheetsStorage.ts

import { type Medication, type InsertMedication, type MedicationTransaction, type InsertTransaction } from "@shared/schema";
import { type IStorage } from "./storage";
import { randomUUID } from "crypto";

export class GoogleSheetsStorage implements IStorage {
  private webAppUrl='https://script.google.com/macros/s/AKfycbzJH1v1_o07tpyounTULlyWCCS1MaWYJRKZL0RgTz0kuJLXWVopSOTgCBZ2B2XF0WQ/exec';
  private cache = new Map<string, Medication>();
  private transactionCache = new Map<string, MedicationTransaction>();
  private lastSync = 0;
  private syncInterval = 30000; // 30 seconds

  constructor(webAppUrl: string) {
    this.webAppUrl = webAppUrl;
    console.log("GoogleSheetsStorage initialized with URL:", webAppUrl);
  }

  private async syncFromSheets(): Promise<void> {
    const now = Date.now();
    if (now - this.lastSync < this.syncInterval) return;

    try {
      console.log("Syncing from Google Sheets...");
      const res = await fetch(`${this.webAppUrl}?action=read`, {
        method: "GET",
        signal: AbortSignal.timeout(10000),
      });
      const data = await res.json();
      if (data.result === "success" && data.medications) {
        this.cache.clear();
        data.medications.forEach((med: Medication) => {
          this.cache.set(med.id, med);
        });
        this.lastSync = now;
        console.log(`Synced ${data.medications.length} medications`);
      } else {
        console.warn("Read failed:", data.error);
      }
    } catch (e) {
      console.error("Sync error:", e);
    }
  }

  private async syncToSheets(rows: Medication[]): Promise<void> {
    try {
      console.log(`Syncing ${rows.length} medications to Sheets...`);
      const response = await fetch(this.webAppUrl, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          action: "update",
          data: JSON.stringify(rows.map(m => ({
            ...m,
            expirationDate: m.expirationDate, // plain text
          }))),
        }),
        signal: AbortSignal.timeout(15000),
      });
      console.log("Sync response:", await response.text());
    } catch (e) {
      console.error("Sync error:", e);
      throw e;
    }
  }

  async getMedications(): Promise<Medication[]> {
    await this.syncFromSheets();
    return Array.from(this.cache.values());
  }

  async getMedicationById(id: string): Promise<Medication | undefined> {
    await this.syncFromSheets();
    return this.cache.get(id);
  }

  async createMedication(insertMedication: InsertMedication): Promise<Medication> {
    console.log("Creating medication:", insertMedication);
    await this.syncFromSheets();

    // Merge based only on: medicalName, administrativeForm, type, dose, expirationDate, location
    const existing = Array.from(this.cache.values()).find(med =>
      med.medicalName === insertMedication.medicalName &&
      med.administrativeForm === insertMedication.administrativeForm &&
      med.type === insertMedication.type &&
      med.dose === insertMedication.dose &&
      med.expirationDate === insertMedication.expirationDate &&
      med.location === insertMedication.location
    );

    const now = new Date().toISOString();
    let result: Medication;

    if (existing) {
      existing.quantity += insertMedication.quantity;
      existing.lastModified = now;
      this.cache.set(existing.id, existing);
      result = existing;
      console.log("Merged into existing:", existing.id);
    } else {
      const id = randomUUID();
      result = {
        id,
        medicalName: insertMedication.medicalName,
        genericName: insertMedication.genericName,
        type: insertMedication.type,
        dose: insertMedication.dose,
        quantity: insertMedication.quantity,
        expirationDate: insertMedication.expirationDate,
        location: insertMedication.location,
        administrativeForm: insertMedication.administrativeForm,
        notes: insertMedication.notes || "",
        dateAdded: now,
        lastModified: now,
      };
      this.cache.set(id, result);
      console.log("Created new medication:", id);
    }

    // Sync updated cache back to Sheets
    try {
      await this.syncToSheets(Array.from(this.cache.values()));
      console.log("Synced to Google Sheets");
    } catch {
      /* swallow errors, already logged */
    }

    return result;
  }

  async updateMedicationQuantity(id: string, newQuantity: number): Promise<Medication | undefined> {
    await this.syncFromSheets();
    const med = this.cache.get(id);
    if (!med) return undefined;
    med.quantity = newQuantity;
    med.lastModified = new Date().toISOString();
    this.cache.set(id, med);
    try { await this.syncToSheets(Array.from(this.cache.values())); } catch {}
    return med;
  }

  async searchMedications(query: string): Promise<Medication[]> {
    await this.syncFromSheets();
    const q = query.toLowerCase();
    return Array.from(this.cache.values()).filter(m =>
      m.genericName.toLowerCase().includes(q) ||
      m.medicalName.toLowerCase().includes(q)
    );
  }

  async filterMedicationsByType(type: string): Promise<Medication[]> {
    await this.syncFromSheets();
    if (type === "all") return this.getMedications();
    return Array.from(this.cache.values()).filter(m => m.type === type);
  }

  async getLowStockMedications(threshold = 5): Promise<Medication[]> {
    await this.syncFromSheets();
    return Array.from(this.cache.values()).filter(m => m.quantity > 0 && m.quantity <= threshold);
  }

  async getOutOfStockMedications(): Promise<Medication[]> {
    await this.syncFromSheets();
    return Array.from(this.cache.values()).filter(m => m.quantity === 0);
  }

  async getTransactions(): Promise<MedicationTransaction[]> {
    return Array.from(this.transactionCache.values()).sort((a, b) =>
      new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
  }

  async createTransaction(insertTransaction: InsertTransaction): Promise<MedicationTransaction> {
    const id = randomUUID();
    const tx: MedicationTransaction = {
      ...insertTransaction,
      id,
      timestamp: new Date() as any,
      notes: insertTransaction.notes || null,
    };
    this.transactionCache.set(id, tx);
    return tx;
  }

  async dispenseMedication(medicationId: string, quantity: number): Promise<{ medication: Medication; transaction: MedicationTransaction }> {
    const med = await this.getMedicationById(medicationId);
    if (!med) throw new Error("Medication not found");
    if (med.quantity < quantity) throw new Error("Insufficient stock");

    const updated = await this.updateMedicationQuantity(medicationId, med.quantity - quantity);
    if (!updated) throw new Error("Failed to update quantity");

    const tx = await this.createTransaction({
      medicationId,
      medicationName: `${med.medicalName} (${med.genericName}) - ${med.administrativeForm}`,
      type: "dispensed",
      quantity,
      notes: "Dispensed to patient",
    });
    return { medication: updated, transaction: tx };
  }
}
