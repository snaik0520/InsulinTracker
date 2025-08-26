import { type Medication, type InsertMedication, type MedicationTransaction, type InsertTransaction } from "@shared/schema";
import { randomUUID } from "crypto";

export interface IStorage {
  getMedications(): Promise<Medication[]>;
  getMedicationById(id: string): Promise<Medication | undefined>;
  createMedication(medication: InsertMedication): Promise<Medication>;
  updateMedicationQuantity(id: string, newQuantity: number): Promise<Medication | undefined>;
  updateMedicationLocation(id: string, newLocation: string): Promise<Medication | undefined>;
  searchMedications(query: string): Promise<Medication[]>;
  filterMedicationsByType(type: string): Promise<Medication[]>;
  getLowStockMedications(threshold?: number): Promise<Medication[]>;
  getOutOfStockMedications(): Promise<Medication[]>;
  getTransactions(): Promise<MedicationTransaction[]>;
  createTransaction(transaction: InsertTransaction): Promise<MedicationTransaction>;
}

export class MemStorage implements IStorage {
  private medications: Map<string, Medication>;
  private transactions: Map<string, MedicationTransaction>;

  constructor() {
    this.medications = new Map();
    this.transactions = new Map();
  }

  async getMedications(): Promise<Medication[]> {
    return Array.from(this.medications.values());
  }

  async getMedicationById(id: string): Promise<Medication | undefined> {
    return this.medications.get(id);
  }

  async createMedication(insertMedication: InsertMedication): Promise<Medication> {
    // Check if medication with same name, dose, and expiration date already exists
    const existingMedication = Array.from(this.medications.values()).find(med => 
      med.genericName === insertMedication.genericName &&
      med.medicalName === insertMedication.medicalName &&
      med.dose === insertMedication.dose &&
      med.expirationDate === insertMedication.expirationDate &&
      med.location === insertMedication.location
    );

    if (existingMedication) {
      // Update existing medication quantity instead of creating new one
      existingMedication.quantity += insertMedication.quantity;
      this.medications.set(existingMedication.id, existingMedication);
      return existingMedication;
    } else {
      // Create new medication
      const id = randomUUID();
      const medication: Medication = { ...insertMedication, id };
      this.medications.set(id, medication);
      return medication;
    }
  }

  async updateMedicationQuantity(id: string, newQuantity: number): Promise<Medication | undefined> {
    const medication = this.medications.get(id);
    if (!medication) {
      return undefined;
    }
    
    const updatedMedication = { ...medication, quantity: newQuantity };
    this.medications.set(id, updatedMedication);
    return updatedMedication;
  }

  async updateMedicationLocation(id: string, newLocation: string): Promise<Medication | undefined> {
    const medication = this.medications.get(id);
    if (!medication) {
      return undefined;
    }
    
    const updatedMedication = { ...medication, location: newLocation };
    this.medications.set(id, updatedMedication);
    return updatedMedication;
  }

  async searchMedications(query: string): Promise<Medication[]> {
    const lowerQuery = query.toLowerCase();
    return Array.from(this.medications.values()).filter(medication =>
      medication.genericName.toLowerCase().includes(lowerQuery) ||
      medication.medicalName.toLowerCase().includes(lowerQuery)
    );
  }

  async filterMedicationsByType(type: string): Promise<Medication[]> {
    if (type === "all") {
      return this.getMedications();
    }
    return Array.from(this.medications.values()).filter(medication =>
      medication.type === type
    );
  }

  async getLowStockMedications(threshold: number = 5): Promise<Medication[]> {
    return Array.from(this.medications.values()).filter(medication =>
      medication.quantity > 0 && medication.quantity <= threshold
    );
  }

  async getOutOfStockMedications(): Promise<Medication[]> {
    return Array.from(this.medications.values()).filter(medication =>
      medication.quantity === 0
    );
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
      timestamp: new Date() as any,
      notes: insertTransaction.notes || null,
      fromLocation: insertTransaction.fromLocation || null,
      toLocation: insertTransaction.toLocation || null
    };
    this.transactions.set(id, transaction);
    return transaction;
  }
}

export const storage = new MemStorage();
