
// GoogleSheetsSync.ts
// Add this new file to your client/src/lib/ directory

export class GoogleSheetsSync {
  private webAppUrl = 'https://script.google.com/macros/s/AKfycbzJH1v1_o07tpyounTULlyWCCS1MaWYJRKZL0RgTz0kuJLXWVopSOTgCBZ2B2XF0WQ/exec';
  private syncInProgress = false;

  constructor(webAppUrl: string) {
    this.webAppUrl = webAppUrl;
  }

  // Send medication data to Google Sheets
  async syncToSheets(medications: any[]): Promise<boolean> {
    if (this.syncInProgress) return false;

    this.syncInProgress = true;
    try {
      const response = await fetch(this.webAppUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          action: 'update',
          data: JSON.stringify(medications)
        })
      });

      const result = await response.text();
      console.log('Sync to Sheets successful:', result);
      return true;
    } catch (error) {
      console.error('Error syncing to Sheets:', error);
      return false;
    } finally {
      this.syncInProgress = false;
    }
  }

  // Get medication data from Google Sheets
  async getFromSheets(): Promise<any[] | null> {
    try {
      const response = await fetch(this.webAppUrl + '?action=read');
      const data = await response.json();

      if (data.result === 'success') {
        return data.medications || [];
      }

      console.error('Error from sheets:', data.error);
      return null;
    } catch (error) {
      console.error('Error getting data from Sheets:', error);
      return null;
    }
  }

  // Check if Google Sheets sync is available
  async isAvailable(): Promise<boolean> {
    try {
      const response = await fetch(this.webAppUrl + '?action=status', {
        method: 'GET',
        signal: AbortSignal.timeout(5000) // 5 second timeout
      });
      const data = await response.json();
      return data.result === 'success' && data.status === 'Online';
    } catch (error) {
      console.warn('Google Sheets sync not available:', error);
      return false;
    }
  }
}
