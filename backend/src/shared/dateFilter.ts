import { ValidationError } from './errors';

export interface ParsedDateFilter {
  startDate?: Date;
  endDate?: Date;
  startDateStr?: string; // YYYY-MM-DD
  endDateStr?: string;   // YYYY-MM-DD
}

/**
 * Safely parses a date query param into a valid Date object.
 * Supports:
 * - YYYY-MM-DD format (sets to 00:00:00.000Z for start, 23:59:59.999Z for end)
 * - Full ISO 8601 strings (e.g. 2026-09-30T19:00:00.000Z or 2026-10-21T18:59:59.999Z)
 * Throws ValidationError (HTTP 400) if string is not a valid date.
 */
export function parseDateParam(
  dateValue: unknown,
  paramName: 'startDate' | 'endDate',
  boundary: 'start' | 'end' = 'start'
): Date | undefined {
  if (dateValue === undefined || dateValue === null) {
    return undefined;
  }

  const str = String(dateValue).trim();
  if (str === '') {
    return undefined;
  }

  // Pure YYYY-MM-DD (e.g. 2026-10-01)
  const isDateOnly = /^\d{4}-\d{2}-\d{2}$/.test(str);
  if (isDateOnly) {
    const timeSuffix = boundary === 'end' ? 'T23:59:59.999Z' : 'T00:00:00.000Z';
    const parsed = new Date(`${str}${timeSuffix}`);
    if (isNaN(parsed.getTime())) {
      throw new ValidationError(`Invalid ${paramName} format: "${str}". Expected valid date (e.g. YYYY-MM-DD or ISO 8601).`);
    }
    return parsed;
  }

  // Full ISO / DateTime string (e.g. 2026-09-30T19:00:00.000Z)
  const parsed = new Date(str);
  if (isNaN(parsed.getTime())) {
    throw new ValidationError(`Invalid ${paramName} format: "${str}". Expected valid date (e.g. YYYY-MM-DD or ISO 8601).`);
  }

  return parsed;
}

/**
 * Extracts clean YYYY-MM-DD string for reporting display from Date or ISO string
 */
export function toDateOnlyString(date: Date | string | undefined | null): string | undefined {
  if (!date) return undefined;
  if (typeof date === 'string') {
    const trimmed = date.trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
    const d = new Date(trimmed);
    if (!isNaN(d.getTime())) return d.toISOString().split('T')[0];
    return trimmed.split('T')[0];
  }
  return date.toISOString().split('T')[0];
}

/**
 * Parse both startDate and endDate query parameters safely with validation
 */
export function parseDateFilter(
  startDateQuery: unknown,
  endDateQuery: unknown
): ParsedDateFilter {
  const startDate = parseDateParam(startDateQuery, 'startDate', 'start');
  const endDate = parseDateParam(endDateQuery, 'endDate', 'end');

  return {
    startDate,
    endDate,
    startDateStr: toDateOnlyString(startDate),
    endDateStr: toDateOnlyString(endDate),
  };
}
