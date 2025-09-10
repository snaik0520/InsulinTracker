// server/storage.ts
import { type Medication, type InsertMedication, type MedicationTransaction, type InsertTransaction } from "@shared/schema";
import { formatToISODateTime, formatToISODate } from "@shared/dateUtils";
import { randomUUID } from "crypto";

export interface IStorage {
  getMedications(): Promise<Medication[]>;
  getMedicationById(id: string): Promise<Medication | undefined>;
  createMedication(
    medication: InsertMedication
  ): Promise<{ medication: Medication; isNewMedication: boolean; addedQuantity: number }>;
  updateMedicationQuantity(id: string, newQuantity: number): Promise<Medication | undefined>;
  updateMedication(id: string, updatedData: Partial<Medication>): Promise<Medication | undefined>;
  searchMedications(query: string): Promise<Medication[]>;
  filterMedicationsByType(type: string): Promise<Medication[]>;
  getLowStockMedications(threshold?: number): Promise<Medication[]>;
  getOutOfStockMedications(): Promise<Medication[]>;
  getTransactions(): Promise<MedicationTransaction[]>;
  createTransaction(transaction: InsertTransaction): Promise<MedicationTransaction>;
  moveMedication(medicationId: string, quantity: number, destinationLocation: string): Promise<{
    success: boolean;
    error?: string;
    sourceMedication?: Medication;
    destinationMedication?: Medication;
    message?: string;
  }>;
  dispenseMedication?(medicationId: string, quantity: number): Promise<{ medication: Medication; transaction: MedicationTransaction }>;
  deleteMedication(id: string): Promise<boolean>;
}

export class MemStorage implements IStorage {
  private medications = new Map<string, Medication>();
  private transactions = new Map<string, MedicationTransaction>();

  // Sort helper: oldest-expiration first
  private sortByExpiration(meds: Medication[]): Medication[] {
    return meds.sort((a, b) =>
      new Date(a.expirationDate).getTime() - new Date(b.expirationDate).getTime()
    );
  }

  async getMedications(): Promise<Medication[]> {
    return this.sortByExpiration(Array.from(this.medications.values()));
  }

  async getMedicationById(id: string): Promise<Medication | undefined> {
    return this.medications.get(id);
  }

  async createMedication(
    insertMedication: InsertMedication
  ): Promise<{ medication: Medication; isNewMedication: boolean; addedQuantity: number }> {
    const medicationWithFormattedDate = {
      ...insertMedication,
      expirationDate: formatToISODate(insertMedication.expirationDate),
    };

    const existing = Array.from(this.medications.values()).find(
      med =>
        med.genericName === medicationWithFormattedDate.genericName &&
        med.medicalName === medicationWithFormattedDate.medicalName &&
        med.dose === medicationWithFormattedDate.dose &&
        med.expirationDate === medicationWithFormattedDate.expirationDate &&
        med.location === medicationWithFormattedDate.location
    );

    if (existing) {
      const addedQuantity = medicationWithFormattedDate.quantity;
      existing.quantity += addedQuantity;
      this.medications.set(existing.id, existing);
      return { medication: existing, isNewMedication: false, addedQuantity };
    } else {
      const id = randomUUID();
      const medication: Medication = { ...medicationWithFormattedDate, id };
      this.medications.set(id, medication);
      return { medication, isNewMedication: true, addedQuantity: medication.quantity };
    }
  }

  async updateMedication(id: string, updatedData: Partial<Medication>): Promise<Medication | undefined> {
    const medication = this.medications.get(id);
    if (!medication) return undefined;

    if (updatedData.expirationDate) {
      updatedData.expirationDate = formatToISODate(updatedData.expirationDate);
    }

    for (const key of Object.keys(updatedData) as (keyof Medication)[]) {
      if (updatedData[key] !== undefined) {
        (medication as any)[key] = updatedData[key]!;
      }
    }

    this.medications.set(id, medication);
    return medication;
  }

  async updateMedicationQuantity(id: string, newQuantity: number): Promise<Medication | undefined> {
    const medication = this.medications.get(id);
    if (!medication) return undefined;

    const updated = { ...medication, quantity: newQuantity };
    this.medications.set(id, updated);
    return updated;
  }

  async moveMedication(medicationId: string, quantity: number, destinationLocation: string): Promise<{
    success: boolean;
    error?: string;
    sourceMedication?: Medication;
    destinationMedication?: Medication;
    message?: string;
  }> {
    const sourceMedication = this.medications.get(medicationId);
    if (!sourceMedication) {
      return { success: false, error: "Source medication not found" };
    }

    if (sourceMedication.quantity < quantity) {
      return { success: false, error: "Insufficient stock in source location" };
    }

    if (sourceMedication.location === destinationLocation) {
      return { success: false, error: "Source and destination locations cannot be the same" };
    }

    const existingAtDestination = Array.from(this.medications.values()).find(
      med =>
        med.genericName === sourceMedication.genericName &&
        med.medicalName === sourceMedication.medicalName &&
        med.dose === sourceMedication.dose &&
        med.expirationDate === sourceMedication.expirationDate &&
        med.location === destinationLocation &&
        med.administrativeForm === sourceMedication.administrativeForm &&
        med.type === sourceMedication.type
    );

    sourceMedication.quantity -= quantity;
    this.medications.set(medicationId, sourceMedication);

    let destinationMedication: Medication;
    if (existingAtDestination) {
      existingAtDestination.quantity += quantity;
      this.medications.set(existingAtDestination.id, existingAtDestination);
      destinationMedication = existingAtDestination;
      return {
        success: true,
        sourceMedication,
        destinationMedication,
        message: `Successfully moved ${quantity} units. Added to existing stock at ${destinationLocation}.`
      };
    } else {
      const newId = randomUUID();
      destinationMedication = {
        ...sourceMedication,
        id: newId,
        quantity,
        location: destinationLocation
      };
      this.medications.set(newId, destinationMedication);
      return {
        success: true,
        sourceMedication,
        destinationMedication,
        message: `Successfully moved ${quantity} units. Created new stock entry at ${destinationLocation}.`
      };
    }
  }

  async searchMedications(query: string): Promise<Medication[]> {
    const q = query.toLowerCase();
    const filtered = Array.from(this.medications.values()).filter(
      med => med.genericName.toLowerCase().includes(q) || med.medicalName.toLowerCase().includes(q)
    );
    return this.sortByExpiration(filtered);
  }

  async filterMedicationsByType(type: string): Promise<Medication[]> {
    if (type === "all") return this.getMedications();
    const filtered = Array.from(this.medications.values()).filter(med => med.type === type);
    return this.sortByExpiration(filtered);
  }

  async getLowStockMedications(threshold: number = 5): Promise<Medication[]> {
    // 1. Group by identity key (ignore expiration)
    const grouped = new Map<string, Medication>();

    for (const med of this.medications.values()) {
      const key = [
        med.genericName,
        med.medicalName,
        med.dose,
        med.location
      ].join("|");

      if (!grouped.has(key)) {
        // Clone without expirationDate or choose one arbitrarily
        grouped.set(key, { ...med, expirationDate: med.expirationDate, quantity: 0 });
      }

      // Sum quantities across batches
      grouped.get(key)!.quantity += med.quantity;
    }

    // 2. Filter summed quantities for low‐stock
    return Array.from(grouped.values()).filter(m =>
      m.quantity > 0 && m.quantity <= threshold
    );
  }

  async getOutOfStockMedications(): Promise<Medication[]> {
    // Aggregate across expiration dates
    const grouped = new Map<string, Medication>();

    for (const med of this.medications.values()) {
      const key = [
        med.genericName,
        med.medicalName,
        med.dose,
        med.location
      ].join("|");

      if (!grouped.has(key)) {
        grouped.set(key, { ...med, expirationDate: med.expirationDate, quantity: 0 });
      }

      grouped.get(key)!.quantity += med.quantity;
    }

    // Return only fully depleted groups
    return Array.from(grouped.values()).filter(m => m.quantity === 0);
  }

  async getTransactions(): Promise<MedicationTransaction[]> {
    return Array.from(this.transactions.values()).sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
  }

  async createTransaction(insertTransaction: InsertTransaction): Promise<MedicationTransaction> {
    const id = randomUUID();
    const transaction: MedicationTransaction = {
      ...insertTransaction,
      id,
      timestamp: formatToISODateTime(),
      notes: insertTransaction.notes || null,
    };
    this.transactions.set(id, transaction);
    return transaction;
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
      dose: med.dose,
      notes: "Dispensed to patient",
    });
    return { medication: updated, transaction: tx };
  }

  async deleteMedication(id: string): Promise<boolean> {
  const deleted = this.medications.delete(id);
  return deleted;
}
}

export class GoogleSheetsStorage implements IStorage {
  private webAppUrl: string;
  private cache = new Map<string, Medication>();
  private transactionCache = new Map<string, MedicationTransaction>();
  private lastSync = 0;
  private syncInterval = 30000;

  constructor(webAppUrl: string) {
    this.webAppUrl = webAppUrl;
  }

  private async syncFromSheets(): Promise<void> {
    const now = Date.now();
    if (now - this.lastSync < this.syncInterval) return;
    try {
      const res = await fetch(`${this.webAppUrl}?action=read`, { signal: AbortSignal.timeout(10000) });
      const data = await res.json();
      if (data.result === "success" && data.medications) {
        this.cache.clear();
        data.medications.forEach((med: Medication) => {
          if (med.expirationDate) med.expirationDate = formatToISODate(med.expirationDate);
          this.cache.set(med.id, med);
        });
        this.lastSync = now;
      }
    } catch {
      // ignore
    }
  }

  private async syncToSheets(medications: Medication[]): Promise<void> {
    try {
      await fetch(this.webAppUrl, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          action: "update",
          data: JSON.stringify(medications.map(med => ({ ...med, expirationDate: med.expirationDate })))
        }),
        signal: AbortSignal.timeout(15000)
      });
    } catch {
      // ignore
    }
  }

  private async syncTransactionsFromSheets(): Promise<void> {
    const now = Date.now();
    if (now - this.lastSync < this.syncInterval) return;
    try {
      const res = await fetch(`${this.webAppUrl}?action=read_transactions`, { signal: AbortSignal.timeout(10000) });
      const data = await res.json();
      if (data.result === "success" && data.transactions) {
        this.transactionCache.clear();
        data.transactions.forEach((tx: MedicationTransaction) => this.transactionCache.set(tx.id, tx));
      }
    } catch {
      // ignore
    }
  }

  private async syncTransactionsToSheets(transactions: MedicationTransaction[]): Promise<void> {
    try {
      await fetch(this.webAppUrl, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          action: "update_transactions",
          data: JSON.stringify(transactions)
        }),
        signal: AbortSignal.timeout(15000)
      });
    } catch {
      // ignore
    }
  }

  // NEW: Add individual transaction to Google Sheets
  private async addTransactionToSheets(transaction: MedicationTransaction): Promise<void> {
    try {
      const response = await fetch(this.webAppUrl, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          action: "add_transaction",
          data: JSON.stringify(transaction)
        }),
        signal: AbortSignal.timeout(15000)
      });
      
      const result = await response.json();
      if (result.result !== 'success') {
        throw new Error(result.error || 'Failed to add transaction to Google Sheets');
      }
    } catch (error) {
      console.error('Error adding transaction to Google Sheets:', error);
      throw error;
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

  async createMedication(
    insertMedication: InsertMedication
  ): Promise<{ medication: Medication; isNewMedication: boolean; addedQuantity: number }> {
    await this.syncFromSheets();
    const existing = Array.from(this.cache.values()).find(
      med =>
        med.genericName === insertMedication.genericName &&
        med.medicalName === insertMedication.medicalName &&
        med.dose === insertMedication.dose &&
        med.expirationDate === insertMedication.expirationDate &&
        med.location === insertMedication.location &&
        med.administrativeForm === insertMedication.administrativeForm
    );

    let result: Medication;
    let isNewMedication: boolean;
    let addedQuantity: number;

    if (existing) {
      addedQuantity = insertMedication.quantity;
      existing.quantity += addedQuantity;
      existing.lastModified = new Date().toISOString();
      this.cache.set(existing.id, existing);
      result = existing;
      isNewMedication = false;
    } else {
      const id = randomUUID();
      result = {
        id,
        ...insertMedication,
        administrativeForm: insertMedication.administrativeForm,
        dateAdded: new Date().toISOString(),
        lastModified: new Date().toISOString()
      };
      addedQuantity = insertMedication.quantity;
      this.cache.set(id, result);
      isNewMedication = true;
    }

    await this.syncToSheets(Array.from(this.cache.values()));
    return { medication: result, isNewMedication, addedQuantity };
  }

  async updateMedication(id: string, updatedData: Partial<Medication>): Promise<Medication | undefined> {
    await this.syncFromSheets();
    const med = this.cache.get(id);
    if (!med) return undefined;
    for (const key of Object.keys(updatedData) as (keyof Medication)[]) {
      if (updatedData[key] !== undefined) {
        (med as any)[key] = updatedData[key]!;
      }
    }
    med.lastModified = new Date().toISOString();
    this.cache.set(id, med);
    await this.syncToSheets(Array.from(this.cache.values()));
    return med;
  }

  async updateMedicationQuantity(id: string, newQuantity: number): Promise<Medication | undefined> {
    await this.syncFromSheets();
    const med = this.cache.get(id);
    if (!med) return undefined;
    med.quantity = newQuantity;
    med.lastModified = new Date().toISOString();
    this.cache.set(id, med);
    await this.syncToSheets(Array.from(this.cache.values()));
    return med;
  }

  async moveMedication(medicationId: string, quantity: number, destinationLocation: string): Promise<{
    success: boolean;
    error?: string;
    sourceMedication?: Medication;
    destinationMedication?: Medication;
    message?: string;
  }> {
    await this.syncFromSheets();

    const sourceMedication = this.cache.get(medicationId);
    if (!sourceMedication) {
      return { success: false, error: "Source medication not found" };
    }

    if (sourceMedication.quantity < quantity) {
      return { success: false, error: "Insufficient stock in source location" };
    }

    if (sourceMedication.location === destinationLocation) {
      return { success: false, error: "Source and destination locations cannot be the same" };
    }

    const existingAtDestination = Array.from(this.cache.values()).find(
      med =>
        med.genericName === sourceMedication.genericName &&
        med.medicalName === sourceMedication.medicalName &&
        med.dose === sourceMedication.dose &&
        med.expirationDate === sourceMedication.expirationDate &&
        med.location === destinationLocation &&
        med.administrativeForm === sourceMedication.administrativeForm &&
        med.type === sourceMedication.type
    );

    sourceMedication.quantity -= quantity;
    sourceMedication.lastModified = new Date().toISOString();
    this.cache.set(medicationId, sourceMedication);

    let destinationMedication: Medication;
    if (existingAtDestination) {
      existingAtDestination.quantity += quantity;
      existingAtDestination.lastModified = new Date().toISOString();
      this.cache.set(existingAtDestination.id, existingAtDestination);
      destinationMedication = existingAtDestination;
    } else {
      const newId = randomUUID();
      destinationMedication = {
        ...sourceMedication,
        id: newId,
        quantity,
        location: destinationLocation,
        dateAdded: new Date().toISOString(),
        lastModified: new Date().toISOString()
      };
      this.cache.set(newId, destinationMedication);
    }

    await this.syncToSheets(Array.from(this.cache.values()));
    return {
      success: true,
      sourceMedication,
      destinationMedication,
      message: existingAtDestination
        ? `Successfully moved ${quantity} units. Added to existing stock at ${destinationLocation}.`
        : `Successfully moved ${quantity} units. Created new stock entry at ${destinationLocation}.`
    };
  }

  async searchMedications(query: string): Promise<Medication[]> {
    await this.syncFromSheets();
    const q = query.toLowerCase();
    const filtered = Array.from(this.cache.values()).filter(
      med => med.genericName.toLowerCase().includes(q) || med.medicalName.toLowerCase().includes(q)
    );
    return filtered.sort((a, b) => new Date(a.expirationDate).getTime() - new Date(b.expirationDate).getTime());
  }

  async filterMedicationsByType(type: string): Promise<Medication[]> {
    await this.syncFromSheets();
    if (type === "all") return this.getMedications();
    return Array.from(this.cache.values())
      .filter(med => med.type === type)
      .sort((a, b) => new Date(a.expirationDate).getTime() - new Date(b.expirationDate).getTime());
  }

  async getLowStockMedications(threshold: number = 5): Promise<Medication[]> {
    await this.syncFromSheets();
    return Array.from(this.cache.values())
      .filter(med => med.quantity > 0 && med.quantity <= threshold)
      .sort((a, b) => new Date(a.expirationDate).getTime() - new Date(b.expirationDate).getTime());
  }

  async getOutOfStockMedications(): Promise<Medication[]> {
    await this.syncFromSheets();
    return Array.from(this.cache.values())
      .filter(med => med.quantity === 0)
      .sort((a, b) => new Date(a.expirationDate).getTime() - new Date(b.expirationDate).getTime());
  }

  async getTransactions(): Promise<MedicationTransaction[]> {
    await this.syncTransactionsFromSheets();
    return Array.from(this.transactionCache.values()).sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
  }

  async createTransaction(insertTransaction: InsertTransaction): Promise<MedicationTransaction> {
    await this.syncTransactionsFromSheets();
    const id = randomUUID();
    const transaction: MedicationTransaction = {
      ...insertTransaction,
      id,
      timestamp: formatToISODateTime(),
      notes: insertTransaction.notes || null,
    };
    this.transactionCache.set(id, transaction);
    
    // Add individual transaction to Google Sheets instead of syncing all
    try {
      await this.addTransactionToSheets(transaction);
    } catch (error) {
      console.error('Failed to add transaction to Google Sheets, but keeping in cache:', error);
      // Don't throw error - keep transaction in cache even if Google Sheets fails
    }
    
    return transaction;
  }

  async dispenseMedication(medicationId: string, quantity: number): Promise<{ medication: Medication; transaction: MedicationTransaction }> {
    await this.syncFromSheets();
    const med = this.cache.get(medicationId);
    if (!med) throw new Error("Medication not found");
    if (med.quantity < quantity) throw new Error("Insufficient stock");
    const updated = await this.updateMedicationQuantity(medicationId, med.quantity - quantity);
    if (!updated) throw new Error("Update failed");
    const tx = await this.createTransaction({
      medicationId,
      medicationName: `${med.medicalName} (${med.genericName}) - ${med.administrativeForm}`,
      type: "dispensed",
      quantity,
      dose: med.dose,
      notes: "Dispensed to patient",
    });
    return { medication: updated, transaction: tx };
  }

  async deleteMedication(id: string): Promise<boolean> {
  await this.syncFromSheets();
  const deleted = this.cache.delete(id);
  if (deleted) {
    await this.syncToSheets(Array.from(this.cache.values()));
  }
  return deleted;
}
}

const GOOGLE_APPS_SCRIPT_URL = process.env.GOOGLE_APPS_SCRIPT_URL || "";

function createStorage(): IStorage {
  if (GOOGLE_APPS_SCRIPT_URL.trim()) {
    return new GoogleSheetsStorage(GOOGLE_APPS_SCRIPT_URL);
  } else {
    return new MemStorage();
  }
}

export const storage = createStorage();
