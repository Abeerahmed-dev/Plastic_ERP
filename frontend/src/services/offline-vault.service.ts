import api from './api';

export interface OfflineInvoiceRecord {
  id: string; // standard uuid_generate_v4()
  timestamp: number; // strict Unix timestamp (epoch ms)
  payload: any;
  customer_id?: string;
  items: any[];
  payment_method?: string;
  amount_paid?: number;
  discount?: number;
  status: 'PENDING' | 'SYNCED' | 'FAILED';
}

const DB_NAME = 'sabir_erp_offline_vault';
const DB_VERSION = 1;
const STORE_NAME = 'offline_invoices';

class OfflineVaultService {
  private dbPromise: Promise<IDBDatabase> | null = null;

  /**
   * Initializes and opens IndexedDB database with offline_invoices object store
   */
  public async getDB(): Promise<IDBDatabase> {
    if (this.dbPromise) return this.dbPromise;

    this.dbPromise = new Promise((resolve, reject) => {
      if (typeof window === 'undefined' || !window.indexedDB) {
        return reject(new Error('IndexedDB is not supported in this environment'));
      }

      const request = window.indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event: IDBVersionChangeEvent) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        }
      };

      request.onsuccess = () => {
        resolve(request.result);
      };

      request.onerror = () => {
        reject(request.error);
      };
    });

    return this.dbPromise;
  }

  /**
   * Store an offline invoice payload with a standard uuid v4 primary key and Unix timestamp
   */
  public async saveOfflineInvoice(orderData: any): Promise<OfflineInvoiceRecord> {
    const db = await this.getDB();

    // Generate standard RFC 4122 v4 UUID
    const uuid = typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
          const r = (Math.random() * 16) | 0;
          const v = c === 'x' ? r : (r & 0x3) | 0x8;
          return v.toString(16);
        });

    const record: OfflineInvoiceRecord = {
      id: uuid,
      timestamp: Date.now(),
      payload: orderData,
      customer_id: orderData.customer_id,
      items: orderData.items || [],
      payment_method: orderData.payment_method || 'CASH',
      amount_paid: orderData.amount_paid,
      discount: orderData.discount,
      status: 'PENDING',
    };

    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const putRequest = store.put(record);

      putRequest.onsuccess = () => resolve(record);
      putRequest.onerror = () => reject(putRequest.error);
    });
  }

  /**
   * Retrieve all queued offline invoices
   */
  public async getOfflineInvoices(): Promise<OfflineInvoiceRecord[]> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const request = store.getAll();

      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Count pending offline invoices
   */
  public async getPendingCount(): Promise<number> {
    try {
      const records = await this.getOfflineInvoices();
      return records.length;
    } catch {
      return 0;
    }
  }

  /**
   * Purge all records from offline vault
   */
  public async clearOfflineInvoices(): Promise<void> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const clearRequest = store.clear();

      clearRequest.onsuccess = () => resolve();
      clearRequest.onerror = () => reject(clearRequest.error);
    });
  }

  /**
   * Flush pending invoices to the backend sync-offline endpoint
   */
  public async syncOfflineInvoices(): Promise<any> {
    const records = await this.getOfflineInvoices();
    if (records.length === 0) return { synced: 0, data: [] };

    const payload = records.map((rec) => ({
      offline_id: rec.id,
      timestamp: rec.timestamp,
      customer_id: rec.customer_id || rec.payload?.customer_id,
      items: (rec.items || rec.payload?.items || []).map((i: any) => ({
        product_id: i.product_id,
        quantity: Number(i.quantity) || 0,
        unit_price: Number(i.unit_price) || 0,
        selected_unit: i.selected_unit || 'KG',
      })),
      payment_method: rec.payment_method || rec.payload?.payment_method || 'CASH',
    }));

    const response = await api.post('/sync-offline', payload);

    if (response.data && response.data.success) {
      await this.clearOfflineInvoices();
    }

    return response.data;
  }
}

export const offlineVaultService = new OfflineVaultService();

