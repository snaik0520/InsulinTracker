// server/storage.ts

import {
  type Medication,
  type InsertMedication,
  type MedicationTransaction,
  type InsertTransaction,
} from "@shared/schema";
import { formatToISODateTime, formatToISODate } from "@shared/dateUtils";
import { randomUUID } from "crypto";
import { GoogleSheetsStorage } from "./googleSheetsStorage";

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
}

export class MemStorage implements IStorage {
  private medications = new Map<string, Medication>();
  private transactions = new Map<string, MedicationTransaction>();

  async getMedications(): Promise<Medication[]> {
    return Array.from(this.medications.values());
  }

  async getMedicationById(id: string): Promise<Medication | undefined> {
    return this.medications.get(id);
  }

  async createMedication(
    insertMedication: InsertMedication
  ): Promise<{ medication: Medication; isNewMedication: boolean; addedQuantity: number }> {
    const formatted = {
      ...insertMedication,
      expirationDate: formatToISODate(insertMedication.expirationDate),
    };

    const existing = Array.from(this.medications.values()).find(
      (med) =>
        med.genericName === formatted.genericName &&
        med.medicalName === formatted.medicalName &&
        med.dose === formatted.dose &&
        med.expirationDate === formatted.expirationDate &&
        med.location === formatted.location
    );

    if (existing) {
      // add to existing stock
      const addedQuantity = formatted.quantity;
      existing.quantity += addedQuantity;
      this.medications.set(existing.id, existing);
      return { medication: existing, isNewMedication: false, addedQuantity };
    } else {
      // new stock entry
      const id = randomUUID();
      const medication: Medication = { id, ...formatted };
      this.medications.set(id, medication);
      return { medication, isNewMedication: true, addedQuantity: medication.quantity };
    }
  }

  async updateMedication(id: string, updatedData: Partial<InsertMedication>): Promise<Medication | undefined> {
    const med = this.medications.get(id);
    if (!med) return undefined;
    if (updatedData.expirationDate) {
      updatedData.expirationDate = formatToISODate(updatedData.expirationDate);
    }
    for (const key of Object.keys(updatedData) as (keyof Medication)[]) {
      if (updatedData[key] !== undefined) {
        (med as any)[key] = updatedData[key]!;
      }
    }
    this.medications.set(id, med);
    return med;
  }

  async updateMedicationQuantity(id: string, newQuantity: number): Promise<Medication | undefined> {
    const med = this.medications.get(id);
    if (!med) return undefined;
    const updated = { ...med, quantity: newQuantity };
    this.medications.set(id, updated);
    return updated;
  }

  async searchMedications(query: string): Promise<Medication[]> {
    const q = query.toLowerCase();
    return Array.from(this.medications.values()).filter(
      (med) => med.genericName.toLowerCase().includes(q) || med.medicalName.toLowerCase().includes(q)
    );
  }

  async filterMedicationsByType(type: string): Promise<Medication[]> {
    if (type === "all") return this.getMedications();
    return Array.from(this.medications.values()).filter((med) => med.type === type);
  }

  async getLowStockMedications(threshold = 5): Promise<Medication[]> {
    return Array.from(this.medications.values()).filter(
      (med) => med.quantity > 0 && med.quantity <= threshold
    );
  }

  async getOutOfStockMedications(): Promise<Medication[]> {
    return Array.from(this.medications.values()).filter((med) => med.quantity === 0);
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
}

// (GoogleSheetsStorage is implemented similarly, using the same createMedication signature
// and dispatching createTransaction with dose and addedQuantity as above.)

// Configuration
const GOOGLE_APPS_SCRIPT_URL = process.env.GOOGLE_APPS_SCRIPT_URL || "";

function createStorage(): IStorage {
  if (GOOGLE_APPS_SCRIPT_URL.trim()) {
    return new GoogleSheetsStorage(GOOGLE_APPS_SCRIPT_URL);
  } else {
    return new MemStorage();
  }
}

export const storage = createStorage();
