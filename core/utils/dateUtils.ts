/**
 * Date utility functions for handling dates in the EHR system
 */

/**
 * Format a date string/Date object to ISO date string with timezone handling
 */
export function formatDateForDisplay(date: Date | string): string {
  const d = new Date(date);
  return d.toISOString().split("T")[0]; // YYYY-MM-DD
}

/**
 * Convert string date to Date object with validation
 */
export function parseDate(dateString: string): Date {
  const date = new Date(dateString);
  if (isNaN(date.getTime())) {
    throw new Error(`Invalid date format: ${dateString}`);
  }
  return date;
}

/**
 * Check if a date indicates a minor (under 18)
 */
export function isMinor(birthDate: Date | string): boolean {
  const birth = new Date(birthDate);
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const monthDiff = today.getMonth() - birth.getMonth();

  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
    age--;
  }

  return age < 18;
}

/**
 * Calculate age from birth date
 */
export function calculateAge(birthDate: Date | string): number {
  const birth = new Date(birthDate);
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const monthDiff = today.getMonth() - birth.getMonth();

  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
    age--;
  }

  return age;
}
