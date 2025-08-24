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
      // Adding to existing stock
      const addedQuantity = medicationWithFormattedDate.quantity;
      existing.quantity += addedQuantity;
      this.medications.set(existing.id, existing);

      // NOTE: Removed internal createTransaction to avoid duplicates

      return {
        medication: existing,
        isNewMedication: false,
        addedQuantity,
      };
    } else {
      // Creating new medication
      const id = randomUUID();
      const medication: Medication = { ...medicationWithFormattedDate, id };
      this.medications.set(id, medication);

      // NOTE: Removed internal createTransaction to avoid duplicates

      return {
        medication,
        isNewMedication: true,
        addedQuantity: medication.quantity,
      };
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

  async searchMedications(query: string): Promise<Medication[]> {
    const q = query.toLowerCase();
    return Array.from(this.medications.values()).filter(
      med => med.genericName.toLowerCase().includes(q) || med.medicalName.toLowerCase().includes(q)
    );
  }

  async filterMedicationsByType(type: string): Promise<Medication[]> {
    if (type === "all") return this.getMedications();
    return Array.from(this.medications.values()).filter(med => med.type === type);
  }

  async getLowStockMedications(threshold: number = 5): Promise<Medication[]> {
    return Array.from(this.medications.values()).filter(
      med => med.quantity > 0 && med.quantity <= threshold
    );
  }

  async getOutOfStockMedications(): Promise<Medication[]> {
    return Array.from(this.medications.values()).filter(med => med.quantity === 0);
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

// GoogleSheetsStorage unchanged...

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
      dose: med.dose, // Added dose field
      notes: "Dispensed to patient",
    });
    return { medication: updated, transaction: tx };
  }
}

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
