
// server/googleSheetsStorage.ts
import { type Medication, type InsertMedication, type MedicationTransaction, type InsertTransaction } from "@shared/schema";
import { formatToISODateTime, formatToISODate } from "@shared/dateUtils";
import { randomUUID } from "crypto";

export interface IStorage {
  getMedications(): Promise<Medication[]>;
  getMedicationById(id: string): Promise<Medication | undefined>;
  createMedication(medication: InsertMedication): Promise<Medication>;
  updateMedicationQuantity(id: string, newQuantity: number): Promise<Medication | undefined>;
  updateMedication(id: string, updatedData: Partial<Medication>): Promise<Medication | undefined>;
  searchMedications(query: string): Promise<Medication[]>;
  filterMedicationsByType(type: string): Promise<Medication[]>;
  getLowStockMedications(threshold?: number): Promise<Medication[]>;
  getTransactions(): Promise<MedicationTransaction[]>;
  createTransaction(transaction: InsertTransaction): Promise<MedicationTransaction>;
}

export class MemStorage implements IStorage {
  // ... existing MemStorage unchanged ...
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
    const medicationWithFormattedDate = {
      ...insertMedication,
      expirationDate: formatToISODate(insertMedication.expirationDate)
    };

    const existingMedication = Array.from(this.medications.values()).find(med =>
      med.genericName === medicationWithFormattedDate.genericName &&
      med.medicalName === medicationWithFormattedDate.medicalName &&
      med.dose === medicationWithFormattedDate.dose &&
      med.expirationDate === medicationWithFormattedDate.expirationDate &&
      med.location === medicationWithFormattedDate.location
    );

    if (existingMedication) {
      existingMedication.quantity += medicationWithFormattedDate.quantity;
      this.medications.set(existingMedication.id, existingMedication);
      return existingMedication;
    } else {
      const id = randomUUID();
      const medication: Medication = { ...medicationWithFormattedDate, id };
      this.medications.set(id, medication);
      return medication;
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
    const updatedMedication = { ...medication, quantity: newQuantity };
    this.medications.set(id, updatedMedication);
    return updatedMedication;
  }

  async searchMedications(query: string): Promise<Medication[]> {
    const lowerQuery = query.toLowerCase();
    return Array.from(this.medications.values()).filter(med =>
      med.genericName.toLowerCase().includes(lowerQuery) ||
      med.medicalName.toLowerCase().includes(lowerQuery)
    );
  }

  async filterMedicationsByType(type: string): Promise<Medication[]> {
    if (type === "all") return this.getMedications();
    return Array.from(this.medications.values()).filter(med => med.type === type);
  }

  async getLowStockMedications(threshold: number = 5): Promise<Medication[]> {
    return Array.from(this.medications.values()).filter(med =>
      med.quantity > 0 && med.quantity <= threshold
    );
  }

  async getOutOfStockMedications(): Promise<Medication[]> {
    return [];
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
  private syncInterval: number = 30000;

  constructor(webAppUrl: string) {
    this.webAppUrl = webAppUrl;
  }

  private async syncFromSheets(): Promise<void> {
    const now = Date.now();
    if (now - this.lastSync < this.syncInterval) return;
    try {
      const response = await fetch(this.webAppUrl + '?action=read', {
        method: 'GET',
        signal: AbortSignal.timeout(10000)
      });
      const data = await response.json();
      if (data.result === 'success' && data.medications) {
        this.cache.clear();
        data.medications.forEach((med: Medication) => {
          if (med.expirationDate) {
            med.expirationDate = formatToISODate(med.expirationDate);
          }
          this.cache.set(med.id, med);
        });
        this.lastSync = now;
      }
    } catch (error) {
      console.error('Error syncing medications from Google Sheets:', error);
    }
  }

  private async syncToSheets(medications: Medication[]): Promise<void> {
    try {
      const formattedMedications = medications.map(med => ({
        ...med,
        expirationDate: formatToISODate(med.expirationDate)
      }));
      await fetch(this.webAppUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          action: 'update',
          data: JSON.stringify(formattedMedications)
        }),
        signal: AbortSignal.timeout(15000)
      });
    } catch (error) {
      console.error('Error syncing medications to Google Sheets:', error);
      throw error;
    }
  }

  // NEW: transaction sync methods
  private async syncTransactionsFromSheets(): Promise<void> {
    const now = Date.now();
    if (now - this.lastSync < this.syncInterval) return;
    try {
      const response = await fetch(this.webAppUrl + '?action=read_transactions', {
        method: 'GET',
        signal: AbortSignal.timeout(10000)
      });
      const data = await response.json();
      if (data.result === 'success' && data.transactions) {
        this.transactionCache.clear();
        data.transactions.forEach((tx: MedicationTransaction) => {
          this.transactionCache.set(tx.id, tx);
        });
      }
    } catch (error) {
      console.error('Error syncing transactions from Google Sheets:', error);
    }
  }

  private async syncTransactionsToSheets(transactions: MedicationTransaction[]): Promise<void> {
    try {
      await fetch(this.webAppUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          action: 'update_transactions',
          data: JSON.stringify(transactions)
        }),
        signal: AbortSignal.timeout(15000)
      });
    } catch (error) {
      console.error('Error syncing transactions to Google Sheets:', error);
      throw error;
    }
  }

  // NEW: Add individual transaction to Google Sheets
  private async addTransactionToSheets(transaction: MedicationTransaction): Promise<void> {
    try {
      console.log('Sending transaction to Google Sheets:', {
        url: this.webAppUrl,
        action: 'add_transaction',
        transactionId: transaction.id
      });

      const response = await fetch(this.webAppUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          action: 'add_transaction',
          data: JSON.stringify(transaction)
        }),
        signal: AbortSignal.timeout(15000)
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const result = await response.json();
      console.log('Google Sheets response:', result);
      
      if (result.result !== 'success') {
        throw new Error(result.error || 'Failed to add transaction to Google Sheets');
      }
    } catch (error) {
      console.error('Error adding transaction to Google Sheets:', {
        error: error.message,
        transactionId: transaction.id,
        url: this.webAppUrl
      });
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

  async createMedication(insertMedication: InsertMedication): Promise<Medication> {
    await this.syncFromSheets();
    const medData = { ...insertMedication, expirationDate: formatToISODate(insertMedication.expirationDate) };
    const existing = Array.from(this.cache.values()).find(med =>
      med.genericName === medData.genericName &&
      med.medicalName === medData.medicalName &&
      med.dose === medData.dose &&
      med.expirationDate === medData.expirationDate &&
      med.location === medData.location
    );
    let result: Medication;
    if (existing) {
      existing.quantity += medData.quantity;
      this.cache.set(existing.id, existing);
      result = existing;
    } else {
      const id = randomUUID();
      result = { ...medData, id };
      this.cache.set(id, result);
    }
    await this.syncToSheets(Array.from(this.cache.values()));
    return result;
  }

  async updateMedication(id: string, updatedData: Partial<Medication>): Promise<Medication | undefined> {
    await this.syncFromSheets();
    const med = this.cache.get(id);
    if (!med) return undefined;
    if (updatedData.expirationDate) {
      updatedData.expirationDate = formatToISODate(updatedData.expirationDate);
    }
    for (const key of Object.keys(updatedData) as (keyof Medication)[]) {
      if (updatedData[key] !== undefined) {
        (med as any)[key] = updatedData[key]!;
      }
    }
    this.cache.set(id, med);
    await this.syncToSheets(Array.from(this.cache.values()));
    return med;
  }

  async updateMedicationQuantity(id: string, newQuantity: number): Promise<Medication | undefined> {
    await this.syncFromSheets();
    const med = this.cache.get(id);
    if (!med) return undefined;
    med.quantity = newQuantity;
    this.cache.set(id, med);
    await this.syncToSheets(Array.from(this.cache.values()));
    return med;
  }

  async searchMedications(query: string): Promise<Medication[]> {
    await this.syncFromSheets();
    const q = query.toLowerCase();
    return Array.from(this.cache.values()).filter(med =>
      med.genericName.toLowerCase().includes(q) ||
      med.medicalName.toLowerCase().includes(q)
    );
  }

  async filterMedicationsByType(type: string): Promise<Medication[]> {
    await this.syncFromSheets();
    if (type === 'all') return this.getMedications();
    return Array.from(this.cache.values()).filter(med => med.type === type);
  }

  async getLowStockMedications(threshold: number = 5): Promise<Medication[]> {
    await this.syncFromSheets();
    return Array.from(this.cache.values()).filter(med =>
      med.quantity > 0 && med.quantity <= threshold
    );
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
    const tx: MedicationTransaction = {
      ...insertTransaction,
      id,
      timestamp: formatToISODateTime(),
      notes: insertTransaction.notes || null
    };
    this.transactionCache.set(id, tx);
    
    // Add individual transaction to Google Sheets instead of syncing all
    if (this.webAppUrl && this.webAppUrl.trim()) {
      // Retry mechanism for Google Sheets sync
      let retryCount = 0;
      const maxRetries = 3;
      
      while (retryCount < maxRetries) {
        try {
          console.log(`Syncing transaction to Google Sheets (attempt ${retryCount + 1}):`, { 
            id: tx.id, 
            type: tx.type, 
            medicationName: tx.medicationName 
          });
          await this.addTransactionToSheets(tx);
          console.log('Successfully synced transaction to Google Sheets');
          break; // Success, exit retry loop
        } catch (error) {
          retryCount++;
          console.error(`Failed to add transaction to Google Sheets (attempt ${retryCount}):`, error);
          
          if (retryCount >= maxRetries) {
            console.error('Max retries reached, keeping transaction in cache only');
            // Don't throw error - keep transaction in cache even if Google Sheets fails
          } else {
            // Wait before retry (exponential backoff)
            await new Promise(resolve => setTimeout(resolve, Math.pow(2, retryCount) * 1000));
          }
        }
      }
    } else {
      console.warn('Google Apps Script URL not configured, transaction only stored in cache');
    }
    
    return tx;
  }
}

const GOOGLE_APPS_SCRIPT_URL = process.env.GOOGLE_APPS_SCRIPT_URL || '';
export const storage: IStorage = GOOGLE_APPS_SCRIPT_URL.trim()
  ? new GoogleSheetsStorage(GOOGLE_APPS_SCRIPT_URL)
  : new MemStorage();
