
import { type Medication, type InsertMedication, type MedicationTransaction, type InsertTransaction } from "@shared/schema";
import { formatToISODateTime, formatToISODate } from "@shared/dateUtils";
import { randomUUID } from "crypto";

export interface IStorage {
  getMedications(): Promise<Medication[]>;
  getMedicationById(id: string): Promise<Medication | undefined>;
  createMedication(medication: InsertMedication): Promise<Medication>;
  updateMedicationQuantity(id: string, newQuantity: number): Promise<Medication | undefined>;
  // NEW: Added missing updateMedication method to interface
  updateMedication(id: string, updatedData: Partial<Medication>): Promise<Medication | undefined>;
  searchMedications(query: string): Promise<Medication[]>;
  filterMedicationsByType(type: string): Promise<Medication[]>;
  getLowStockMedications(threshold?: number): Promise<Medication[]>;
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
    // Ensure expiration date is in ISO format
    const medicationWithFormattedDate = {
      ...insertMedication,
      expirationDate: formatToISODate(insertMedication.expirationDate)
    };

    // Check if medication with same name, dose, and expiration date already exists
    const existingMedication = Array.from(this.medications.values()).find(med => 
      med.genericName === medicationWithFormattedDate.genericName &&
      med.medicalName === medicationWithFormattedDate.medicalName &&
      med.dose === medicationWithFormattedDate.dose &&
      med.expirationDate === medicationWithFormattedDate.expirationDate &&
      med.location === medicationWithFormattedDate.location
    );

    if (existingMedication) {
      // Update existing medication quantity instead of creating new one
      existingMedication.quantity += medicationWithFormattedDate.quantity;
      this.medications.set(existingMedication.id, existingMedication);
      return existingMedication;
    } else {
      // Create new medication
      const id = randomUUID();
      const medication: Medication = { ...medicationWithFormattedDate, id };
      this.medications.set(id, medication);
      return medication;
    }
  }

  // NEW: Added updateMedication method for MemStorage
  async updateMedication(id: string, updatedData: Partial<Medication>): Promise<Medication | undefined> {
    const medication = this.medications.get(id);
    if (!medication) {
      return undefined;
    }

    // Ensure expiration date is formatted if provided
    if (updatedData.expirationDate) {
      updatedData.expirationDate = formatToISODate(updatedData.expirationDate);
    }

    // Update fields that exist in updatedData
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
    if (!medication) {
      return undefined;
    }

    const updatedMedication = { ...medication, quantity: newQuantity };
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
      timestamp: formatToISODateTime(), // Use ISO datetime format
      notes: insertTransaction.notes || null
    };
    this.transactions.set(id, transaction);
    return transaction;
  }
}

export class GoogleSheetsStorage implements IStorage {
  private webAppUrl: string;
  private cache: Map<string, Medication> = new Map();
  private transactionCache: Map<string, MedicationTransaction> = new Map();
  private lastSync: number = 0;
  private syncInterval: number = 30000; // 30 seconds

  constructor(webAppUrl: string) {
    this.webAppUrl = webAppUrl;
  }

  private async syncFromSheets(): Promise<void> {
    const now = Date.now();
    if (now - this.lastSync < this.syncInterval) {
      return; // Skip sync if too recent
    }

    try {
      const response = await fetch(this.webAppUrl + '?action=read', {
        method: 'GET',
        signal: AbortSignal.timeout(10000) // 10 second timeout
      });

      const data = await response.json();

      if (data.result === 'success' && data.medications) {
        this.cache.clear();
        data.medications.forEach((med: Medication) => {
          // Ensure expiration dates are in ISO format when syncing from sheets
          if (med.expirationDate) {
            med.expirationDate = formatToISODate(med.expirationDate);
          }
          this.cache.set(med.id, med);
        });
        this.lastSync = now;
      } else {
        console.warn('Failed to sync from Google Sheets:', data.error);
      }
    } catch (error) {
      console.error('Error syncing from Google Sheets:', error);
      // Continue with cached data if sync fails
    }
  }

  private async syncToSheets(medications: Medication[]): Promise<void> {
    try {
      // Ensure all medications have ISO formatted dates before syncing
      const formattedMedications = medications.map(med => ({
        ...med,
        expirationDate: formatToISODate(med.expirationDate)
      }));

      const response = await fetch(this.webAppUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          action: 'update',
          data: JSON.stringify(formattedMedications)
        }),
        signal: AbortSignal.timeout(15000) // 15 second timeout
      });

      const result = await response.text();
      console.log('Synced to Google Sheets:', result);
    } catch (error) {
      console.error('Error syncing to Google Sheets:', error);
      throw error; // Re-throw to handle at higher level
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
    await this.syncFromSheets();

    // Ensure expiration date is in ISO format
    const medicationWithFormattedDate = {
      ...insertMedication,
      expirationDate: formatToISODate(insertMedication.expirationDate)
    };

    // Check if medication with same properties already exists
    const existingMedication = Array.from(this.cache.values()).find(med => 
      med.genericName === medicationWithFormattedDate.genericName &&
      med.medicalName === medicationWithFormattedDate.medicalName &&
      med.dose === medicationWithFormattedDate.dose &&
      med.expirationDate === medicationWithFormattedDate.expirationDate &&
      med.location === medicationWithFormattedDate.location
    );

    let resultMedication: Medication;

    if (existingMedication) {
      // Update existing medication quantity
      existingMedication.quantity += medicationWithFormattedDate.quantity;
      this.cache.set(existingMedication.id, existingMedication);
      resultMedication = existingMedication;
    } else {
      // Create new medication
      const id = randomUUID();
      const medication: Medication = { ...medicationWithFormattedDate, id };
      this.cache.set(id, medication);
      resultMedication = medication;
    }

    // Sync to Google Sheets
    try {
      await this.syncToSheets(Array.from(this.cache.values()));
    } catch (error) {
      console.error('Failed to sync new medication to sheets:', error);
      // Continue anyway - data is cached locally
    }

    return resultMedication;
  }

  // NEW: Added missing updateMedication method for GoogleSheetsStorage
  async updateMedication(id: string, updatedData: Partial<Medication>): Promise<Medication | undefined> {
    await this.syncFromSheets();
    const med = this.cache.get(id);
    if (!med) return undefined;

    // Ensure expiration date is formatted if provided
    if (updatedData.expirationDate) {
      updatedData.expirationDate = formatToISODate(updatedData.expirationDate);
    }

    // Update fields that exist in updatedData
    for (const key of Object.keys(updatedData) as (keyof Medication)[]) {
      if (updatedData[key] !== undefined) {
        (med as any)[key] = updatedData[key]!;
      }
    }

    this.cache.set(id, med);

    // Sync to Google Sheets
    try {
      await this.syncToSheets(Array.from(this.cache.values()));
    } catch (error) {
      console.error('Failed to sync medication update to sheets:', error);
      // Continue anyway - data is cached locally
    }

    return med;
  }

  async updateMedicationQuantity(id: string, newQuantity: number): Promise<Medication | undefined> {
    await this.syncFromSheets();

    const medication = this.cache.get(id);
    if (!medication) {
      return undefined;
    }

    const updatedMedication = { ...medication, quantity: newQuantity };
    this.cache.set(id, updatedMedication);

    // Sync to Google Sheets
    try {
      await this.syncToSheets(Array.from(this.cache.values()));
    } catch (error) {
      console.error('Failed to sync quantity update to sheets:', error);
      // Continue anyway - data is cached locally
    }

    return updatedMedication;
  }

  async searchMedications(query: string): Promise<Medication[]> {
    await this.syncFromSheets();

    const lowerQuery = query.toLowerCase();
    return Array.from(this.cache.values()).filter(medication =>
      medication.genericName.toLowerCase().includes(lowerQuery) ||
      medication.medicalName.toLowerCase().includes(lowerQuery)
    );
  }

  async filterMedicationsByType(type: string): Promise<Medication[]> {
    await this.syncFromSheets();

    if (type === "all") {
      return this.getMedications();
    }
    return Array.from(this.cache.values()).filter(medication =>
      medication.type === type
    );
  }

  async getLowStockMedications(threshold: number = 5): Promise<Medication[]> {
    await this.syncFromSheets();

    return Array.from(this.cache.values()).filter(medication =>
      medication.quantity > 0 && medication.quantity <= threshold
    );
  }

  async getTransactions(): Promise<MedicationTransaction[]> {
    // For now, transactions are stored locally
    // You could extend this to sync with another sheet tab if needed
    return Array.from(this.transactionCache.values()).sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
  }

  async createTransaction(insertTransaction: InsertTransaction): Promise<MedicationTransaction> {
    const id = randomUUID();
    const transaction: MedicationTransaction = { 
      ...insertTransaction, 
      id, 
      timestamp: formatToISODateTime(), // Use ISO datetime format
      notes: insertTransaction.notes || null
    };
    this.transactionCache.set(id, transaction);
    return transaction;
  }
}

// Configuration
const GOOGLE_APPS_SCRIPT_URL = process.env.GOOGLE_APPS_SCRIPT_URL || '';

// Create storage instance based on environment
function createStorage(): IStorage {
  // Use Google Sheets if URL is provided
  if (GOOGLE_APPS_SCRIPT_URL && GOOGLE_APPS_SCRIPT_URL.trim() !== '') {
    console.log('Using Google Sheets storage with URL:', GOOGLE_APPS_SCRIPT_URL);
    return new GoogleSheetsStorage(GOOGLE_APPS_SCRIPT_URL);
  } else {
    console.log('Using in-memory storage (no Google Sheets URL provided)');
    console.log('To use Google Sheets storage, set GOOGLE_APPS_SCRIPT_URL environment variable');
    return new MemStorage();
  }
}

export const storage = createStorage();
