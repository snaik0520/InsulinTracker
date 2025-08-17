
// medicationStorage.ts
// Add this new file to your client/src/lib/ directory

import { GoogleSheetsSync } from './GoogleSheetsSync';
import type { Medication } from '@shared/schema';

const GOOGLE_SHEETS_WEB_APP_URL = 'https://script.google.com/macros/s/AKfycbzJH1v1_o07tpyounTULlyWCCS1MaWYJRKZL0RgTz0kuJLXWVopSOTgCBZ2B2XF0WQ/exec';
const LOCAL_STORAGE_KEY = 'insulin_medications_backup';

export class MedicationStorage {
  private sheetsSync: GoogleSheetsSync;
  private isOnline = false;

  constructor() {
    this.sheetsSync = new GoogleSheetsSync(GOOGLE_SHEETS_WEB_APP_URL);
    this.checkConnection();
  }

  private async checkConnection() {
    this.isOnline = await this.sheetsSync.isAvailable();
    console.log('Google Sheets sync:', this.isOnline ? 'ONLINE' : 'OFFLINE');
  }

  // Save medications to local storage as backup
  private saveToLocalStorage(medications: Medication[]) {
    try {
      const dataWithTimestamp = {
        medications,
        lastModified: new Date().toISOString(),
        source: 'local'
      };
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(dataWithTimestamp));
    } catch (error) {
      console.error('Error saving to localStorage:', error);
    }
  }

  // Get medications from local storage
  private getFromLocalStorage(): Medication[] {
    try {
      const stored = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (stored) {
        const data = JSON.parse(stored);
        return data.medications || [];
      }
    } catch (error) {
      console.error('Error reading from localStorage:', error);
    }
    return [];
  }

  // Get medications with fallback strategy
  async getMedications(): Promise<Medication[]> {
    if (this.isOnline) {
      try {
        const sheetData = await this.sheetsSync.getFromSheets();
        if (sheetData) {
          // Save to localStorage as backup
          this.saveToLocalStorage(sheetData);
          return sheetData;
        }
      } catch (error) {
        console.warn('Failed to get from sheets, using localStorage:', error);
      }
    }

    // Fallback to localStorage
    return this.getFromLocalStorage();
  }

  // Save medications with sync
  async saveMedications(medications: Medication[]): Promise<boolean> {
    // Always save to localStorage first for immediate response
    this.saveToLocalStorage(medications);

    // Try to sync to sheets if online
    if (this.isOnline) {
      try {
        const success = await this.sheetsSync.syncToSheets(medications);
        if (!success) {
          console.warn('Failed to sync to sheets, data saved locally only');
        }
        return success;
      } catch (error) {
        console.error('Error syncing to sheets:', error);
        return false;
      }
    }

    return true; // Local save succeeded even if sheets sync failed
  }

  // Force a sync from sheets (useful for manual refresh)
  async syncFromSheets(): Promise<Medication[]> {
    if (!this.isOnline) {
      await this.checkConnection();
    }

    if (this.isOnline) {
      const sheetData = await this.sheetsSync.getFromSheets();
      if (sheetData) {
        this.saveToLocalStorage(sheetData);
        return sheetData;
      }
    }

    return this.getFromLocalStorage();
  }

  // Clear all stored data (useful for troubleshooting)
  clearStorage() {
    localStorage.removeItem(LOCAL_STORAGE_KEY);
    console.log('Local medication storage cleared');
  }

  // Get sync status
  getSyncStatus() {
    return {
      isOnline: this.isOnline,
      hasLocalData: this.getFromLocalStorage().length > 0,
      lastLocalUpdate: (() => {
        try {
          const stored = localStorage.getItem(LOCAL_STORAGE_KEY);
          if (stored) {
            const data = JSON.parse(stored);
            return data.lastModified;
          }
        } catch (error) {
          // ignore
        }
        return null;
      })()
    };
  }
}

// Create a singleton instance
export const medicationStorage = new MedicationStorage();
