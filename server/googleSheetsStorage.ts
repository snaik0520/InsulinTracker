import { type Medication, type InsertMedication, type MedicationTransaction, type InsertTransaction } from "@shared/schema";
import { type IStorage } from "./storage";
import { randomUUID } from "crypto";

export class GoogleSheetsStorage implements IStorage {
  private webAppUrl: string;
  private cache = new Map<string, Medication>();
  private transactionCache = new Map<string, MedicationTransaction>();
  private lastSync = 0;
  private syncInterval = 30000; // 30s

  constructor(webAppUrl: string) {
    this.webAppUrl = webAppUrl;
    console.log("GoogleSheetsStorage initialized with URL:", webAppUrl);
  }

  private async syncFromSheets(): Promise<void> {
    const now = Date.now();
    if (now - this.lastSync < this.syncInterval) return;
    try {
      console.log("Syncing from Google Sheets...");
      const res = await fetch(`${this.webAppUrl}?action=read`, { signal: AbortSignal.timeout(10000) });
      const data = await res.json();
      if (data.result === "success" && data.medications) {
        this.cache.clear();
        data.medications.forEach((med: Medication) => this.cache.set(med.id, med));
        this.lastSync = now;
        console.log(`Synced ${data.medications.length} medications`);
      } else {
        console.warn("Read failed:", data.error);
      }
    } catch (e) {
      console.error("Sync error:", e);
    }
  }

  private async syncToSheets(medications: Medication[]): Promise<void> {
    try {
      console.log(`Syncing ${medications.length} meds to Sheets...`);
      const rows = medications.map(m => ({ ...m, expirationDate: m.expirationDate }));
      await fetch(this.webAppUrl, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ action: "update", data: JSON.stringify(rows) }),
        signal: AbortSignal.timeout(15000),
      });
      console.log("Sync successful");
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

    const existing = Array.from(this.cache.values()).find(m =>
      m.genericName === insertMedication.genericName &&
      m.medicalName === insertMedication.medicalName &&
      m.dose === insertMedication.dose &&
      m.expirationDate === insertMedication.expirationDate &&
      m.location === insertMedication.location &&
      m.administrativeForm === insertMedication.administrativeForm
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
      result = { id, ...insertMedication, dateAdded: now, lastModified: now };
      this.cache.set(id, result);
      console.log("Created new med:", id);
    }

    try {
      await this.syncToSheets(Array.from(this.cache.values()));
    } catch {}

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
    return Array.from(this.transactionCache.values()).sort((a,b) =>
      new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
  }

  async createTransaction(insertTransaction: InsertTransaction): Promise<MedicationTransaction> {
    const id = randomUUID();
    const tx: MedicationTransaction = { ...insertTransaction, id, timestamp: new Date() as any, notes: insertTransaction.notes || null };
    this.transactionCache.set(id, tx);
    return tx;
  }

  async dispenseMedication(medicationId: string, quantity: number): Promise<{ medication: Medication; transaction: MedicationTransaction }> {
    const med = await this.getMedicationById(medicationId);
    if (!med) throw new Error("Medication not found");
    if (med.quantity < quantity) throw new Error("Insufficient stock");

    const updated = await this.updateMedicationQuantity(medicationId, med.quantity - quantity);
    if (!updated) throw new Error("Update failed");

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
