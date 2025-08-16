import { type Medication, type InsertMedication, type MedicationTransaction, type InsertTransaction } from "@shared/schema";
import { IStorage } from './storage';

export class GoogleSheetsStorage implements IStorage {
  private baseUrl: string;

  constructor(webAppUrl: string) {
    this.baseUrl = webAppUrl;
  }

  private async makeRequest(action: string, params: Record<string, any> = {}): Promise<any> {
    const url = new URL(this.baseUrl);
    url.searchParams.append('action', action);
    
    // Add all parameters to URL
    Object.keys(params).forEach(key => {
      if (params[key] !== undefined && params[key] !== null) {
        if (typeof params[key] === 'object') {
          url.searchParams.append(key, JSON.stringify(params[key]));
        } else {
          url.searchParams.append(key, params[key].toString());
        }
      }
    });

    try {
      const response = await fetch(url.toString(), {
        method: 'POST',
        mode: 'cors',
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error('Google Sheets API Error:', error);
      throw error;
    }
  }

  async getMedications(): Promise<Medication[]> {
    return await this.makeRequest('getMedications');
  }

  async getMedicationById(id: string): Promise<Medication | undefined> {
    const medications = await this.getMedications();
    return medications.find(med => med.id === id);
  }

  async createMedication(medication: InsertMedication): Promise<Medication> {
    return await this.makeRequest('createMedication', { data: medication });
  }

  async updateMedicationQuantity(id: string, newQuantity: number): Promise<Medication | undefined> {
    return await this.makeRequest('updateMedicationQuantity', { id, quantity: newQuantity });
  }

  async searchMedications(query: string): Promise<Medication[]> {
    return await this.makeRequest('searchMedications', { query });
  }

  async filterMedicationsByType(type: string): Promise<Medication[]> {
    if (type === "all") {
      return this.getMedications();
    }
    const medications = await this.getMedications();
    return medications.filter(medication => medication.type === type);
  }

  async getLowStockMedications(threshold: number = 5): Promise<Medication[]> {
    const medications = await this.getMedications();
    return medications.filter(medication =>
      medication.quantity > 0 && medication.quantity <= threshold
    );
  }

  async getOutOfStockMedications(): Promise<Medication[]> {
    const medications = await this.getMedications();
    return medications.filter(medication => medication.quantity === 0);
  }

  async getTransactions(): Promise<MedicationTransaction[]> {
    return await this.makeRequest('getTransactions');
  }

  async createTransaction(transaction: InsertTransaction): Promise<MedicationTransaction> {
    return await this.makeRequest('createTransaction', { data: transaction });
  }

  // New method for dispensing (combines quantity update + transaction)
  async dispenseMedication(medicationId: string, quantity: number): Promise<{medication: Medication, transaction: MedicationTransaction}> {
    return await this.makeRequest('dispenseMedication', { medicationId, quantity });
  }
}
