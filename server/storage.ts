import { GoogleSheetsStorage } from './googleSheetsStorage';
import { MemStorage } from './storage'; // your existing MemStorage

// Replace this URL with your actual Google Apps Script web app URL
const GOOGLE_APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbwF-ZeJtdQYdiWpZbkynZQE86XfR12qbzSXzxyyrViz_RnOpRRCsjpLYp5b-rqMsWk_/exec';

// Choose storage type based on environment
export const storage = process.env.NODE_ENV === 'development' 
  ? new MemStorage() // Use in-memory for local development
  : new GoogleSheetsStorage(GOOGLE_APPS_SCRIPT_URL); // Use Google Sheets for production
