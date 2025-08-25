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
  updateMedication(id: string, updatedData: Partial<InsertMedication>): Promise<Medication | undefined>;
  searchMedications(query: string): Promise<Medication[]>;
  filterMedicationsByType(type: string): Promise<Medication[]>;
  getLowStockMedications(threshold?: number): Promise<Medication[]>;
  getOutOfStockMedications(): Promise<Medication[]>;
  getTransactions(): Promise<MedicationTransaction[]>;
  createTransaction(transaction: InsertTransaction): Promise<MedicationTransaction>;
  dispenseMedication?(medicationId: string, quantity: number): Promise<{ medication: Medication; transaction: MedicationTransaction }>;
  moveMedication(
    sourceMedicationId: string, 
    quantity: number, 
    destinationLocation: string
  ): Promise<{
    sourceMedication: Medication;
    destinationMedication: Medication | null;
    isNewDestination: boolean;
  }>;
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

  async updateMedication(id: string, updatedData: Partial<InsertMedication>): Promise<Medication | undefined> {
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
    const filtered = Array.from(this.medications.values()).filter(
      med => med.quantity > 0 && med.quantity <= threshold
    );
    return this.sortByExpiration(filtered);
  }

  async getOutOfStockMedications(): Promise<Medication[]> {
    const filtered = Array.from(this.medications.values()).filter(med => med.quantity === 0);
    return this.sortByExpiration(filtered);
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

  async moveMedication(
    sourceMedicationId: string,
    quantity: number,
    destinationLocation: string
  ): Promise<{
    sourceMedication: Medication;
    destinationMedication: Medication | null;
    isNewDestination: boolean;
  }> {
    const sourceMed = this.medications.get(sourceMedicationId);
    if (!sourceMed) {
      throw new Error("Source medication not found");
    }

    if (sourceMed.quantity < quantity) {
      throw new Error("Insufficient stock to move");
    }

    // Update source medication quantity
    sourceMed.quantity -= quantity;
    this.medications.set(sourceMedicationId, sourceMed);

    // Find existing medication at destination location
    const existingDestinationMed = Array.from(this.medications.values()).find(
      med =>
        med.genericName === sourceMed.genericName &&
        med.medicalName === sourceMed.medicalName &&
        med.dose === sourceMed.dose &&
        med.expirationDate === sourceMed.expirationDate &&
        med.location === destinationLocation &&
        med.administrativeForm === sourceMed.administrativeForm
    );

    let destinationMed: Medication;
    let isNewDestination: boolean;

    if (existingDestinationMed) {
      // Add to existing medication at destination
      existingDestinationMed.quantity += quantity;
      this.medications.set(existingDestinationMed.id, existingDestinationMed);
      destinationMed = existingDestinationMed;
      isNewDestination = false;
    } else {
      // Create new medication record at destination
      const newId = randomUUID();
      destinationMed = {
        ...sourceMed,
        id: newId,
        location: destinationLocation,
        quantity: quantity,
      };
      this.medications.set(newId, destinationMed);
      isNewDestination = true;
    }

    return {
      sourceMedication: sourceMed,
      destinationMedication: destinationMed,
      isNewDestination,
    };
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
      // fallback to cache
    }
  }

  private async syncToSheets(medications: Medication[]): Promise<void> {
    try {
      const rows = medications.map(med => ({ ...med, expirationDate: med.expirationDate }));
      await fetch(this.webAppUrl, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ action: "update", data: JSON.stringify(rows) }),
        signal: AbortSignal.timeout(15000),
      });
    } catch {
      // ignore
    }
  }

  async getMedications(): Promise<Medication[]> {
    await this.syncFromSheets();
    return this.sortByExpiration(Array.from(this.cache.values()));
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
      result = { id, ...insertMedication, administrativeForm: insertMedication.administrativeForm, dateAdded: new Date().toISOString(), lastModified: new Date().toISOString() };
      addedQuantity = insertMedication.quantity;
      this.cache.set(id, result);
      isNewMedication = true;
    }

    await this.syncToSheets(Array.from(this.cache.values()));
    return { medication: result, isNewMedication, addedQuantity };
  }

  async updateMedication(id: string, updatedData: Partial<InsertMedication>): Promise<Medication | undefined> {
    await this.syncFromSheets();
    const med = this.cache.get(id);
    if (!med) return undefined;
    for (const key of Object.keys(updatedData) as (keyof Medication)[]) {
      if (updatedData[key] !== undefined) med[key] = updatedData[key]!;
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

  async searchMedications(query: string): Promise<Medication[]> {
    await this.syncFromSheets();
    const q = query.toLowerCase();
    const filtered = Array.from(this.cache.values()).filter(
      med => med.genericName.toLowerCase().includes(q) || med.medicalName.toLowerCase().includes(q)
    );
    return this.sortByExpiration(filtered);
  }

  async filterMedicationsByType(type: string): Promise<Medication[]> {
    await this.syncFromSheets();
    if (type === "all") return this.getMedications();
    const filtered = Array.from(this.cache.values()).filter(med => med.type === type);
    return this.sortByExpiration(filtered);
  }

  async getLowStockMedications(threshold: number = 5): Promise<Medication[]> {
    await this.syncFromSheets();
    const filtered = Array.from(this.cache.values()).filter(med => med.quantity > 0 && med.quantity <= threshold);
    return this.sortByExpiration(filtered);
  }

  async getOutOfStockMedications(): Promise<Medication[]> {
    await this.syncFromSheets();
    const filtered = Array.from(this.cache.values()).filter(med => med.quantity === 0);
    return this.sortByExpiration(filtered);
  }

  async getTransactions(): Promise<MedicationTransaction[]> {
    return Array.from(this.transactionCache.values()).sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
  }

  async createTransaction(insertTransaction: InsertTransaction): Promise<MedicationTransaction> {
    const id = randomUUID();
    const transaction: MedicationTransaction = {
      ...insertTransaction,
      id,
      timestamp: new Date().toISOString(),
      notes: insertTransaction.notes || null,
    };
    this.transactionCache.set(id, transaction);
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

  async moveMedication(
    sourceMedicationId: string,
    quantity: number,
    destinationLocation: string
  ): Promise<{
    sourceMedication: Medication;
    destinationMedication: Medication | null;
    isNewDestination: boolean;
  }> {
    await this.syncFromSheets();
    
    const sourceMed = this.cache.get(sourceMedicationId);
    if (!sourceMed) {
      throw new Error("Source medication not found");
    }

    if (sourceMed.quantity < quantity) {
      throw new Error("Insufficient stock to move");
    }

    // Update source medication quantity
    sourceMed.quantity -= quantity;
    sourceMed.lastModified = new Date().toISOString();
    this.cache.set(sourceMedicationId, sourceMed);

    // Find existing medication at destination location
    const existingDestinationMed = Array.from(this.cache.values()).find(
      med =>
        med.genericName === sourceMed.genericName &&
        med.medicalName === sourceMed.medicalName &&
        med.dose === sourceMed.dose &&
        med.expirationDate === sourceMed.expirationDate &&
        med.location === destinationLocation &&
        med.administrativeForm === sourceMed.administrativeForm
    );

    let destinationMed: Medication;
    let isNewDestination: boolean;

    if (existingDestinationMed) {
      // Add to existing medication at destination
      existingDestinationMed.quantity += quantity;
      existingDestinationMed.lastModified = new Date().toISOString();
      this.cache.set(existingDestinationMed.id, existingDestinationMed);
      destinationMed = existingDestinationMed;
      isNewDestination = false;
    } else {
      // Create new medication record at destination
      const newId = randomUUID();
      destinationMed = {
        ...sourceMed,
        id: newId,
        location: destinationLocation,
        quantity: quantity,
        dateAdded: new Date().toISOString(),
        lastModified: new Date().toISOString(),
      };
      this.cache.set(newId, destinationMed);
      isNewDestination = true;
    }

    await this.syncToSheets(Array.from(this.cache.values()));

    return {
      sourceMedication: sourceMed,
      destinationMedication: destinationMed,
      isNewDestination,
    };
  }

  // Re-use server-side sort helper in this class
  private sortByExpiration(meds: Medication[]): Medication[] {
    return meds.sort((a, b) =>
      new Date(a.expirationDate).getTime() - new Date(b.expirationDate).getTime()
    );
  }
}

// Instantiate storage based on environment
const GOOGLE_APPS_SCRIPT_URL = process.env.GOOGLE_APPS_SCRIPT_URL || "";

function createStorage(): IStorage {
  if (GOOGLE_APPS_SCRIPT_URL.trim()) {
    return new GoogleSheetsStorage(GOOGLE_APPS_SCRIPT_URL);
  } else {
    return new MemStorage();
  }
}

export const storage = createStorage();
