import { type Medication, type InsertMedication, type MedicationTransaction, type InsertTransaction } from "@shared/schema";
import { type IStorage } from "./storage";
import { randomUUID } from "crypto";

export class GoogleSheetsStorage implements IStorage {
  private webAppUrl: string;
  private cache: Map<string, Medication> = new Map();
  private transactionCache: Map<string, MedicationTransaction> = new Map();
  private lastSync: number = 0;
  private syncInterval: number = 30000; // 30 seconds

  constructor(webAppUrl: string) {
    this.webAppUrl = webAppUrl;
    console.log('GoogleSheetsStorage initialized with URL:', webAppUrl);
  }

  private async syncFromSheets(): Promise<void> {
    const now = Date.now();
    if (now - this.lastSync < this.syncInterval) {
      return; // Skip sync if too recent
    }
    try {
      console.log('Syncing from Google Sheets...');
      const response = await fetch(this.webAppUrl + '?action=read', {
        method: 'GET',
        signal: AbortSignal.timeout(10000) // 10 second timeout
      });
      const data = await response.json();
      console.log('Google Sheets response:', data);
      if (data.result === 'success' && data.medications) {
        this.cache.clear();
        data.medications.forEach((med: Medication) => {
          this.cache.set(med.id, med);
        });
        this.lastSync = now;
        console.log('Synced', data.medications.length, 'medications from Google Sheets');
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
      console.log('Syncing', medications.length, 'medications to Google Sheets...');
      const response = await fetch(this.webAppUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          action: 'update',
          data: JSON.stringify(medications)
        }),
        signal: AbortSignal.timeout(15000) // 15 second timeout
      });
      const result = await response.text();
      console.log('Synced to Google Sheets successfully:', result);
    } catch (error) {
      console.error('Error syncing to Google Sheets:', error);
      throw error; // Re-throw to handle at higher level
    }
  }

  async getMedications(): Promise<Medication[]> {
    await this.syncFromSheets();
    const medications = Array.from(this.cache.values());
    console.log('Retrieved', medications.length, 'medications from cache');
    return medications;
  }

  async getMedicationById(id: string): Promise<Medication | undefined> {
    await this.syncFromSheets();
    return this.cache.get(id);
  }

  // Helper to normalize values for robust equality checks
  private normalizeForCompare(value: any): string {
    if (value === null || value === undefined) return "";
    if (typeof value === "string") return value.trim().toLowerCase();
    if (typeof value === "number" || typeof value === "boolean") return String(value);
    if (value instanceof Date) return value.toISOString();
    // For objects (e.g., nested), stringify in a stable-ish way
    try {
      return String(value).trim().toLowerCase();
    } catch {
      return JSON.stringify(value);
    }
  }

  // Match an InsertMedication to an existing Medication by comparing all insert fields (except quantity/id)
  private medicationMatchesInsert(med: Medication, insert: InsertMedication): boolean {
    const insertAny = insert as any;
    const medAny = med as any;

    // Compare each key present on the insert object (except quantity and id)
    for (const key of Object.keys(insertAny)) {
      if (key === "quantity" || key === "id") continue;
      const insertVal = this.normalizeForCompare(insertAny[key]);
      const medVal = this.normalizeForCompare(medAny[key]);
      if (insertVal !== medVal) {
        return false;
      }
    }

    // Also ensure there are no extra keys on med that the insert doesn't have which might make them different.
    // (Only necessary if you want strict equality; comment out if you prefer looser matching.)
    // for (const key of Object.keys(medAny)) {
    //   if (key === "quantity" || key === "id") continue;
    //   if (!(key in insertAny)) {
    //     // If med has a defined property that insert doesn't, treat as mismatch only if med's value is non-empty
    //     const medVal = this.normalizeForCompare(medAny[key]);
    //     if (medVal !== "") return false;
    //   }
    // }

    return true;
  }

  async createMedication(insertMedication: InsertMedication): Promise<Medication> {
    console.log('Creating medication:', insertMedication);
    await this.syncFromSheets();

    // Look for an existing medication that matches all identifying fields of the insert.
    let existingMedication: Medication | undefined;
    for (const med of Array.from(this.cache.values())) {
      if (this.medicationMatchesInsert(med, insertMedication)) {
        existingMedication = med;
        break;
      }
    }

    let resultMedication: Medication;
    if (existingMedication) {
      // Update existing medication quantity
      const newQty = (existingMedication.quantity || 0) + (insertMedication.quantity || 0);
      const updated = { ...existingMedication, quantity: newQty };
      this.cache.set(existingMedication.id, updated);
      resultMedication = updated;
      console.log('Updated existing medication (merged quantities):', existingMedication.id, 'newQuantity=', newQty);
    } else {
      // Create new medication
      const id = randomUUID();
      // ensure we include id on the medication object
      const medication: Medication = { ...(insertMedication as any), id };
      this.cache.set(id, medication);
      resultMedication = medication;
      console.log('Created new medication:', id);
    }

    // Sync to Google Sheets immediately
    try {
      await this.syncToSheets(Array.from(this.cache.values()));
      console.log('Successfully synced medication to Google Sheets');
    } catch (error) {
      console.error('Failed to sync new medication to sheets:', error);
      // Continue anyway - data is cached locally
    }

    return resultMedication;
  }

  async updateMedicationQuantity(id: string, newQuantity: number): Promise<Medication | undefined> {
    console.log('Updating medication quantity:', id, newQuantity);
    await this.syncFromSheets();
    const medication = this.cache.get(id);
    if (!medication) {
      console.warn('Medication not found for update:', id);
      return undefined;
    }
    const updatedMedication = { ...medication, quantity: newQuantity };
    this.cache.set(id, updatedMedication);
    // Sync to Google Sheets
    try {
      await this.syncToSheets(Array.from(this.cache.values()));
      console.log('Successfully synced quantity update to Google Sheets');
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

  async getOutOfStockMedications(): Promise<Medication[]> {
    await this.syncFromSheets();
    return Array.from(this.cache.values()).filter(medication =>
      medication.quantity === 0
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
      timestamp: new Date() as any,
      notes: insertTransaction.notes || null
    };
    this.transactionCache.set(id, transaction);
    console.log('Created transaction:', id, transaction.type);
    return transaction;
  }

  async dispenseMedication(medicationId: string, quantity: number): Promise<{ medication: Medication; transaction: MedicationTransaction }> {
    console.log('Dispensing medication:', medicationId, quantity);
    const medication = await this.getMedicationById(medicationId);
    if (!medication) {
      throw new Error('Medication not found');
    }
    if (medication.quantity < quantity) {
      throw new Error('Insufficient stock');
    }
    // Update quantity
    const updatedMedication = await this.updateMedicationQuantity(
      medicationId,
      medication.quantity - quantity
    );
    if (!updatedMedication) {
      throw new Error('Failed to update medication quantity');
    }
    // Create transaction
    const transaction = await this.createTransaction({
      medicationId,
      medicationName: `${medication.medicalName} (${medication.genericName}) - ${medication.administrativeForm}`,
      type: "dispensed",
      quantity: quantity,
      notes: "Dispensed to patient"
    });
    return { medication: updatedMedication, transaction };
  }
}
