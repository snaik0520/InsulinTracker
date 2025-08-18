// client/src/lib/GoogleSheetsSync.ts

import { type Medication } from "@shared/schema";

export class GoogleSheetsSync {
  private webAppUrl = 'https://script.google.com/macros/s/AKfycbzd_dwmLQj9r5ef8MZYI3jH0EsjbunFgPtNEAOMWID30F67F_VLKMjoEKXvyjQsdJ7m/exec';
  private syncInProgress = false;

  /** Send inventory data to Google Sheets */
  async syncToSheets(medications: Medication[]): Promise<boolean> {
    if (this.syncInProgress) return false;
    this.syncInProgress = true;
    try {
      const response = await fetch(this.webAppUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          action: 'update',
          data: JSON.stringify(medications),
        }),
      });
      console.log('Sync to Sheets successful:', await response.text());
      return true;
    } catch (error) {
      console.error('Error syncing to Sheets:', error);
      return false;
    } finally {
      this.syncInProgress = false;
    }
  }

  /** Fetch inventory data from Google Sheets */
  async getFromSheets(): Promise<Medication[] | null> {
    try {
      const response = await fetch(`${this.webAppUrl}?action=read`);
      const data = await response.json();
      if (data.result === 'success') return data.medications || [];
      console.error('Sheets read error:', data.error);
      return null;
    } catch (error) {
      console.error('Error fetching from Sheets:', error);
      return null;
    }
  }

  /** Check availability of the Sheets endpoint */
  async isAvailable(): Promise<boolean> {
    try {
      const response = await fetch(`${this.webAppUrl}?action=status`, {
        method: 'GET',
        signal: AbortSignal.timeout(5000),
      });
      const data = await response.json();
      return data.result === 'success' && data.status === 'Online';
    } catch {
      return false;
    }
  }
}
