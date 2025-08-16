import { type Medication, type InsertMedication, type MedicationTransaction, type InsertTransaction } from "@shared/schema";
import { type IStorage } from "./storage";

export class GoogleSheetsStorage implements IStorage {
  constructor(private baseUrl: string) {}

  private async request(payload: any): Promise<any> {
    const res = await fetch(this.baseUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    if (json.error) throw new Error(json.error);
    return json;
  }

  async getMedications(): Promise<Medication[]> {
    return this.request({ action: "getMedications" });
  }

  async createMedication(med: InsertMedication): Promise<Medication> {
    return this.request({ action: "createMedication", ...med });
  }

  async updateMedicationQuantity(id: string, newQuantity: number): Promise<Medication> {
    return this.request({ action: "updateMedicationQuantity", id, quantity: newQuantity });
  }

  async searchMedications(query: string): Promise<Medication[]> {
    return this.request({ action: "searchMedications", query });
  }

  async filterMedicationsByType(type: string): Promise<Medication[]> {
    return this.request({ action: "filterMedicationsByType", type });
  }

  async getLowStockMedications(threshold = 5): Promise<Medication[]> {
    return this.request({ action: "getLowStockMedications", threshold });
  }

  async getOutOfStockMedications(): Promise<Medication[]> {
    return this.request({ action: "getOutOfStockMedications" });
  }

  async getTransactions(): Promise<MedicationTransaction[]> {
    return this.request({ action: "getTransactions" });
  }

  async createTransaction(tx: InsertTransaction): Promise<MedicationTransaction> {
    return this.request({ action: "createTransaction", ...tx });
  }

  async dispenseMedication(medicationId: string, quantity: number): Promise<{ medication: Medication; transaction: MedicationTransaction }> {
    // 1) Update quantity
    await this.request({ action: "updateMedicationQuantity", id: medicationId, quantity: quantity * -1 });
    // 2) Create transaction
    const transaction = await this.request({
      action: "createTransaction",
      ...{ medicationId, medicationName: "", type: "dispensed", quantity, notes: "Dispensed to patient" },
    });
    // 3) Fetch updated medication
    const meds = await this.getMedications();
    const medication = meds.find(m => m.id === medicationId)!;
    return { medication, transaction };
  }
}
