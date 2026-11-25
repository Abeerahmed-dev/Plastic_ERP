export const FORCE_OFFLINE_STORAGE_KEY = 'sps_force_offline_mode';
export const FORCE_OFFLINE_EVENT = 'erp-force-offline-changed';

export function getForceOfflineMode(): boolean {
  try {
    return typeof localStorage !== 'undefined' && localStorage.getItem(FORCE_OFFLINE_STORAGE_KEY) === 'true';
  } catch {
    return false;
  }
}

export function setForceOfflineMode(enabled: boolean): void {
  try {
    if (typeof localStorage !== 'undefined') {
      if (enabled) {
        localStorage.setItem(FORCE_OFFLINE_STORAGE_KEY, 'true');
      } else {
        localStorage.removeItem(FORCE_OFFLINE_STORAGE_KEY);
      }
    }
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent(FORCE_OFFLINE_EVENT, { detail: enabled }));
    }
  } catch {
    // ignore storage failures
  }
}

export function isNavigatorOffline(): boolean {
  return typeof navigator !== 'undefined' && navigator.onLine === false;
}

export function isEffectivelyOffline(): boolean {
  return isNavigatorOffline() || getForceOfflineMode();
}

const GATEWAY_OFFLINE_STATUSES = new Set([408, 502, 503, 504, 521, 522, 523, 524]);

export function isOfflineOrNetworkError(err: any): boolean {
  if (isEffectivelyOffline()) return true;
  if (!err) return false;

  const status = err?.response?.status;
  if (typeof status === 'number' && GATEWAY_OFFLINE_STATUSES.has(status)) {
    return true;
  }

  // Request never received a response from server (disconnect, DNS, CORS block on outage, timeout)
  if (err?.isAxiosError && !err?.response) {
    return true;
  }

  const code = String(err?.code || '').toUpperCase();
  if (code === 'ERR_NETWORK' || code === 'ECONNABORTED' || code === 'ETIMEDOUT' || code === 'ERR_INTERNET_DISCONNECTED') {
    return true;
  }

  const msg = String(err?.message || '').toLowerCase();
  return (
    msg.includes('network error') ||
    msg.includes('failed to fetch') ||
    msg.includes('load failed') ||
    msg.includes('timeout of') ||
    msg.includes('internet disconnected') ||
    msg.includes('networkerror')
  );
}

export function generateUuidV4(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export function getNextOfflineReference(kind: 'POS' | 'INV'): string {
  const key = kind === 'POS' ? 'sps_offline_seq_pos' : 'sps_offline_seq_inv';
  try {
    const cur = parseInt(localStorage.getItem(key) || '0', 10);
    const next = (isNaN(cur) ? 0 : cur) + 1;
    localStorage.setItem(key, String(next));
    return `${kind}-OFF-${String(next).padStart(3, '0')}`;
  } catch {
    return `${kind}-OFF-${Date.now().toString().slice(-5)}`;
  }
}

export function getLocalDateString(epochMs?: number): string {
  const d = epochMs !== undefined ? new Date(epochMs) : new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
