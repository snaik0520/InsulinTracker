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

  async createMedication(insertMedication: InsertMedication): Promise<Medication> {
    console.log('Creating medication:', insertMedication);
    await this.syncFromSheets();

    // Check if medication with same properties already exists
    const existingMedication = Array.from(this.cache.values()).find(med => 
      med.genericName === insertMedication.genericName &&
      med.medicalName === insertMedication.medicalName &&
      med.dose === insertMedication.dose &&
      med.expirationDate === insertMedication.expirationDate &&
      med.location === insertMedication.location
    );

    let resultMedication: Medication;

    if (existingMedication) {
      // Update existing medication quantity
      existingMedication.quantity += insertMedication.quantity;
      this.cache.set(existingMedication.id, existingMedication);
      resultMedication = existingMedication;
      console.log('Updated existing medication:', existingMedication.id);
    } else {
      // Create new medication
      const id = randomUUID();
      const medication: Medication = { ...insertMedication, id };
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
