import { type Medication, type InsertMedication, type MedicationTransaction, type InsertTransaction } from "@shared/schema";
import { type IStorage } from './storage';

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
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const result = await response.json();
      
      // Check if the response contains an error
      if (result.error) {
        throw new Error(result.error);
      }
      
      return result;
    } catch (error) {
      console.error('Google Sheets API Error:', error);
      throw error;
    }
  }

  async getMedications(): Promise<Medication[]> {
    try {
      const result = await this.makeRequest('getMedications');
      return Array.isArray(result) ? result : [];
    } catch (error) {
      console.error('Error fetching medications:', error);
      return [];
    }
  }

  async getMedicationById(id: string): Promise<Medication | undefined> {
    try {
      const medications = await this.getMedications();
      return medications.find(med => med.id === id);
    } catch (error) {
      console.error('Error fetching medication by ID:', error);
      return undefined;
    }
  }

  async createMedication(medication: InsertMedication): Promise<Medication> {
    try {
      const result = await this.makeRequest('createMedication', { data: medication });
      return result;
    } catch (error) {
      console.error('Error creating medication:', error);
      throw error;
    }
  }

  async updateMedicationQuantity(id: string, newQuantity: number): Promise<Medication | undefined> {
    try {
      const result = await this.makeRequest('updateMedicationQuantity', { id, quantity: newQuantity });
      return result;
    } catch (error) {
      console.error('Error updating medication quantity:', error);
      return undefined;
    }
  }

  async searchMedications(query: string): Promise<Medication[]> {
    try {
      const result = await this.makeRequest('searchMedications', { query });
      return Array.isArray(result) ? result : [];
    } catch (error) {
      console.error('Error searching medications:', error);
      return [];
    }
  }

  async filterMedicationsByType(type: string): Promise<Medication[]> {
    try {
      const result = await this.makeRequest('filterMedicationsByType', { type });
      return Array.isArray(result) ? result : [];
    } catch (error) {
      console.error('Error filtering medications by type:', error);
      return [];
    }
  }

  async getLowStockMedications(threshold: number = 5): Promise<Medication[]> {
    try {
      const result = await this.makeRequest('getLowStockMedications', { threshold });
      return Array.isArray(result) ? result : [];
    } catch (error) {
      console.error('Error fetching low stock medications:', error);
      return [];
    }
  }

  async getOutOfStockMedications(): Promise<Medication[]> {
    try {
      const result = await this.makeRequest('getOutOfStockMedications');
      return Array.isArray(result) ? result : [];
    } catch (error) {
      console.error('Error fetching out of stock medications:', error);
      return [];
    }
  }

  async getTransactions(): Promise<MedicationTransaction[]> {
    try {
      const result = await this.makeRequest('getTransactions');
      return Array.isArray(result) ? result : [];
    } catch (error) {
      console.error('Error fetching transactions:', error);
      return [];
    }
  }

  async createTransaction(transaction: InsertTransaction): Promise<MedicationTransaction> {
    try {
      const result = await this.makeRequest('createTransaction', { data: transaction });
      return result;
    } catch (error) {
      console.error('Error creating transaction:', error);
      throw error;
    }
  }

  // New method for dispensing (combines quantity update + transaction)
  async dispenseMedication(medicationId: string, quantity: number): Promise<{medication: Medication, transaction: MedicationTransaction}> {
    try {
      const result = await this.makeRequest('dispenseMedication', { medicationId, quantity });
      
      if (result.error) {
        throw new Error(result.error);
      }
      
      return result;
    } catch (error) {
      console.error('Error dispensing medication:', error);
      throw error;
    }
  }
}
