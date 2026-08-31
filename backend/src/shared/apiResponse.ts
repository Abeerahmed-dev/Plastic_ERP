/**
 * Standard API response envelope used by all endpoints.
 *
 * All responses follow this shape:
 *   { success: true,  data: T,      meta?: PaginationMeta }
 *   { success: false, error: string }
 */

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface ApiSuccess<T = unknown> {
  success: true;
  data: T;
  meta?: PaginationMeta;
}

export interface ApiError {
  success: false;
  error: string;
  details?: Record<string, string[]>;
}

export type ApiResponse<T = unknown> = ApiSuccess<T> | ApiError;

/** Helper — build a success response */
export function ok<T>(data: T, meta?: PaginationMeta): ApiSuccess<T> {
  return meta ? { success: true, data, meta } : { success: true, data };
}

/** Helper — build an error response */
export function fail(error: string, details?: Record<string, string[]>): ApiError {
  return details ? { success: false, error, details } : { success: false, error };
}
