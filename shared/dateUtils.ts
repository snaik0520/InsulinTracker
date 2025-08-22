/**
 * Date utility functions for consistent ISO date formatting
 */

/**
 * Formats a date to ISO date string (YYYY-MM-DD)
 * @param date - Date object, string, or null/undefined
 * @returns ISO date string or empty string if invalid
 */
export function formatToISODate(date: Date | string | null | undefined): string {
  if (!date) return '';
  
  try {
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    if (isNaN(dateObj.getTime())) return '';
    
    // Format to YYYY-MM-DD
    return dateObj.toISOString().split('T')[0];
  } catch {
    return '';
  }
}

/**
 * Formats a date to ISO datetime string for timestamps
 * @param date - Date object, string, or null/undefined  
 * @returns ISO datetime string or current datetime if invalid
 */
export function formatToISODateTime(date?: Date | string | null): string {
  if (!date) {
    return new Date().toISOString();
  }
  
  try {
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    if (isNaN(dateObj.getTime())) {
      return new Date().toISOString();
    }
    
    return dateObj.toISOString();
  } catch {
    return new Date().toISOString();
  }
}

/**
 * Validates if a string is a valid ISO date (YYYY-MM-DD)
 * @param dateString - String to validate
 * @returns true if valid ISO date format
 */
export function isValidISODate(dateString: string): boolean {
  if (!dateString) return false;
  
  // Check format YYYY-MM-DD
  const isoDateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!isoDateRegex.test(dateString)) return false;
  
  // Check if it's a valid date
  const date = new Date(dateString);
  return !isNaN(date.getTime()) && date.toISOString().split('T')[0] === dateString;
}

/**
 * Parses various date formats and returns ISO date string
 * @param input - Date in various formats
 * @returns ISO date string
 */
export function parseToISODate(input: any): string {
  if (!input) return '';
  
  // If already a valid ISO date string, return as is
  if (typeof input === 'string' && isValidISODate(input)) {
    return input;
  }
  
  // Try to parse and format
  return formatToISODate(input);
}
