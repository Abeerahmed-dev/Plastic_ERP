import { toast } from 'sonner';

/**
 * Extracts a specific human-readable error message from an API error response.
 * Prioritizes field-specific validation errors over generic messages like "Validation failed".
 */
export const extractApiErrorMessage = (error: any): string => {
  const data = error?.response?.data;

  // 1. Direct array response (e.g., res.status(400).json([{ message: "..." }]))
  if (Array.isArray(data) && data.length > 0) {
    const first = data[0];
    if (typeof first === 'string') return first;
    if (first && typeof first === 'object' && first.message) return first.message;
    if (first && typeof first === 'object' && first.error) return first.error;
  }

  // 2. Parsed field-specific details from backend Zod/Express error handler
  if (data?.details) {
    if (Array.isArray(data.details) && data.details.length > 0) {
      const first = data.details[0];
      if (typeof first === 'string') return first;
      if (first && typeof first === 'object' && first.message) return first.message;
    } else if (typeof data.details === 'object') {
      const fieldErrors = Object.values(data.details)
        .flatMap((val: any) => (Array.isArray(val) ? val : [val]))
        .filter((msg: any) => typeof msg === 'string' && msg.trim().length > 0);
      if (fieldErrors.length > 0) {
        return fieldErrors[0];
      }
    } else if (typeof data.details === 'string') {
      return data.details;
    }
  }

  // 3. Parsed field-specific errors array or object
  if (data?.errors) {
    if (Array.isArray(data.errors) && data.errors.length > 0) {
      const first = data.errors[0];
      if (typeof first === 'string') return first;
      if (first && typeof first === 'object' && first.message) return first.message;
    } else if (typeof data.errors === 'object') {
      const fieldErrors = Object.values(data.errors)
        .flatMap((val: any) => (Array.isArray(val) ? val : [val]))
        .filter((msg: any) => typeof msg === 'string' && msg.trim().length > 0);
      if (fieldErrors.length > 0) {
        return fieldErrors[0];
      }
    } else if (typeof data.errors === 'string') {
      return data.errors;
    }
  }

  // 4. Single detail string property
  if (data?.detail && typeof data.detail === 'string') {
    return data.detail;
  }

  // 5. Explicit error or message string (ignoring generic "Validation failed")
  const rawMsg = data?.message || data?.error;
  if (
    typeof rawMsg === 'string' &&
    rawMsg.trim() !== '' &&
    rawMsg.toLowerCase() !== 'validation failed'
  ) {
    return rawMsg;
  }

  // 6. Generic or raw error fallback
  return (
    (typeof rawMsg === 'string' && rawMsg.trim() !== '' ? rawMsg : undefined) ||
    (typeof error === 'string' ? error : undefined) ||
    error?.message ||
    'A network error occurred.'
  );
};

/**
 * Standard API error handler utility.
 * Displays a toast error message extracted from the server response or fallback.
 */
export const handleApiError = (error: any): string => {
  const message = extractApiErrorMessage(error);
  toast.error(message);
  return message;
};

export { toast };
