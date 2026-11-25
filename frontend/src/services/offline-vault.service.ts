import api from './api';
import { invalidateAllDomains } from '../utils/querySync';
import { queryClient } from '../utils/queryClient';
import { erpSyncBus } from '../utils/erpSyncBus';
import { generateUuidV4, getLocalDateString } from '../utils/networkError';

export const OFFLINE_VAULT_CHANGED_EVENT = 'erp-offline-vault-changed';

export type OfflineRecordType = 'POS' | 'SALE_INVOICE';

export interface OfflineInvoiceRecord {
  id: string; // standard uuid_generate_v4()
  timestamp: number; // strict Unix timestamp (epoch ms)
  record_type?: OfflineRecordType;
  local_bill_number?: string;
  payload: any;
  printable_preview?: any;
  customer_id?: string;
  customer_name?: string;
  walk_in_customer_name?: string | null;
  items: any[];
  payment_method?: string;
  amount_paid?: number;
  discount?: number;
  delivery_charges?: number;
  slip_charges?: number;
  subtotal?: number;
  total_amount?: number;
  bank_account_id?: string;
  split_cash_amount?: number;
  split_bank_amount?: number;
  created_by_name?: string;
  sync_error?: string;
  status: 'PENDING' | 'SYNCED' | 'FAILED';
}

const DB_NAME = 'sabir_erp_offline_vault';
const DB_VERSION = 1;
const STORE_NAME = 'offline_invoices';

class OfflineVaultService {
  private dbPromise: Promise<IDBDatabase> | null = null;
  private syncInFlight: Promise<any> | null = null;

  private notifyChanged(): void {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent(OFFLINE_VAULT_CHANGED_EVENT));
    }
  }

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
        this.dbPromise = null;
        reject(request.error);
      };
    });

    return this.dbPromise;
  }

  private async putRecord(record: OfflineInvoiceRecord): Promise<OfflineInvoiceRecord> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const putRequest = store.put(record);

      putRequest.onsuccess = () => {
        this.notifyChanged();
        resolve(record);
      };
      putRequest.onerror = () => reject(putRequest.error);
    });
  }

  /**
   * Store an offline POS invoice payload with a standard uuid v4 primary key and Unix timestamp
   */
  public async saveOfflineInvoice(orderData: any, customId?: string): Promise<OfflineInvoiceRecord> {
    const uuid = customId || generateUuidV4();

    const record: OfflineInvoiceRecord = {
      id: uuid,
      timestamp: Number(orderData.offline_timestamp || Date.now()),
      record_type: orderData.record_type || 'POS',
      local_bill_number: orderData.local_bill_number || orderData.invoice_number,
      payload: orderData,
      printable_preview: orderData.printable_preview,
      customer_id: orderData.customer_id,
      customer_name: orderData.customer_name,
      walk_in_customer_name: orderData.walk_in_customer_name ?? null,
      items: orderData.items || [],
      payment_method: orderData.payment_method || 'CASH',
      amount_paid: orderData.amount_paid,
      discount: orderData.discount,
      delivery_charges: orderData.delivery_charges ?? orderData.delivery_charge ?? 0,
      slip_charges: orderData.slip_charges ?? orderData.payload?.slip_charges ?? 2,
      subtotal: orderData.subtotal,
      total_amount: orderData.total_amount,
      bank_account_id: orderData.bank_account_id,
      split_cash_amount: orderData.split_cash_amount,
      split_bank_amount: orderData.split_bank_amount,
      created_by_name: orderData.created_by_name,
      status: 'PENDING',
    };

    return this.putRecord(record);
  }

  /**
   * Store an offline full Sale Invoice (Wholesale/Credit/Cash/Split) with printable snapshot
   */
  public async saveOfflineSaleInvoice(
    invoicePayload: any,
    printablePreview: any,
    customId?: string
  ): Promise<OfflineInvoiceRecord> {
    const uuid = customId || invoicePayload.offline_id || generateUuidV4();
    const record: OfflineInvoiceRecord = {
      id: uuid,
      timestamp: Number(invoicePayload.offline_timestamp || Date.now()),
      record_type: 'SALE_INVOICE',
      local_bill_number: printablePreview?.invoice_number || invoicePayload.local_bill_number,
      payload: invoicePayload,
      printable_preview: printablePreview,
      customer_id: invoicePayload.customer_id,
      customer_name: printablePreview?.customer_name || invoicePayload.walk_in_customer_name || 'Customer',
      walk_in_customer_name: invoicePayload.walk_in_customer_name ?? null,
      items: invoicePayload.items || [],
      payment_method: invoicePayload.payment_method || (invoicePayload.customer_id ? 'CREDIT' : 'CASH'),
      amount_paid: printablePreview?.paid_amount,
      discount: invoicePayload.discount ?? 0,
      delivery_charges: invoicePayload.delivery_charge ?? 0,
      slip_charges: invoicePayload.slip_charges ?? 2,
      subtotal: printablePreview?.subtotal,
      total_amount: printablePreview?.total_amount,
      created_by_name: printablePreview?.created_by_name,
      status: 'PENDING',
    };

    return this.putRecord(record);
  }

  /**
   * Retrieve all queued offline invoices sorted newest-first or chronologically
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
      return records.filter((r) => r.status !== 'SYNCED').length;
    } catch {
      return 0;
    }
  }

  /**
   * Remove specific record IDs after successful sync
   */
  public async removeOfflineInvoices(ids: string[]): Promise<void> {
    if (!ids || ids.length === 0) return;
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      for (const id of ids) {
        store.delete(id);
      }
      tx.oncomplete = () => {
        this.notifyChanged();
        resolve();
      };
      tx.onerror = () => reject(tx.error);
    });
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

      clearRequest.onsuccess = () => {
        this.notifyChanged();
        resolve();
      };
      clearRequest.onerror = () => reject(clearRequest.error);
    });
  }

  /**
   * Flush pending POS + Sale Invoices to backend sync-offline endpoint (single-flight locked)
   */
  public async syncOfflineInvoices(): Promise<any> {
    if (this.syncInFlight) {
      return this.syncInFlight;
    }

    this.syncInFlight = (async () => {
      const records = await this.getOfflineInvoices();
      if (records.length === 0) return { synced: 0, failed: 0, data: [] };

      const ordered = [...records].sort((a, b) => Number(a.timestamp || 0) - Number(b.timestamp || 0));

      const payload = ordered.map((rec) => {
        if (rec.record_type === 'SALE_INVOICE') {
          return {
            ...rec.payload,
            date: rec.payload?.date || getLocalDateString(rec.timestamp),
            record_type: 'SALE_INVOICE',
            offline_id: rec.id,
            timestamp: rec.timestamp,
          };
        }

        return {
          record_type: 'POS',
          offline_id: rec.id,
          timestamp: rec.timestamp,
          date: rec.payload?.date || new Date(rec.timestamp).toISOString(),
          customer_id: rec.customer_id || rec.payload?.customer_id,
          items: (rec.items || rec.payload?.items || []).map((i: any) => ({
            product_id: i.product_id,
            quantity: Number(i.quantity) || 0,
            unit_price: Number(i.price !== undefined ? i.price : i.unit_price) || 0,
            price: Number(i.price !== undefined ? i.price : i.unit_price) || 0,
            selected_unit: i.selected_unit || 'KG',
          })),
          discount: rec.discount ?? rec.payload?.discount ?? 0,
          delivery_charges: rec.delivery_charges ?? rec.payload?.delivery_charges ?? rec.payload?.delivery_charge ?? 0,
          delivery_charge: rec.delivery_charges ?? rec.payload?.delivery_charges ?? rec.payload?.delivery_charge ?? 0,
          slip_charges: rec.slip_charges ?? rec.payload?.slip_charges ?? 2,
          amount_paid: rec.amount_paid ?? rec.payload?.amount_paid,
          payment_method: rec.payment_method || rec.payload?.payment_method || 'CASH',
          bank_account_id: rec.bank_account_id ?? rec.payload?.bank_account_id,
          split_cash_amount: rec.split_cash_amount ?? rec.payload?.split_cash_amount,
          split_bank_amount: rec.split_bank_amount ?? rec.payload?.split_bank_amount,
        };
      });

      const response = await api.post('/sync-offline', payload, { timeout: 25000 });

      if (response.data && response.data.success) {
        const resultRows: any[] = Array.isArray(response.data.data) ? response.data.data : [];
        const hasPerItemFailures = resultRows.some((r) => r?.failed && r?.offline_id);

        // Refetch invoices query BEFORE removing local offline entries so rows transition seamlessly
        await queryClient.refetchQueries({ queryKey: ['invoices'] }).catch(() => undefined);

        if (!hasPerItemFailures) {
          await this.removeOfflineInvoices(ordered.map((r) => r.id));
        } else {
          const failedById = new Map<string, string>();
          for (const row of resultRows) {
            if (row?.failed && row?.offline_id) {
              failedById.set(String(row.offline_id), String(row.error || 'Sync failed'));
            }
          }

          const succeededIds: string[] = [];
          for (const rec of ordered) {
            const errMsg = failedById.get(rec.id);
            if (errMsg) {
              await this.putRecord({ ...rec, status: 'FAILED', sync_error: errMsg });
            } else {
              succeededIds.push(rec.id);
            }
          }
          if (succeededIds.length > 0) {
            await this.removeOfflineInvoices(succeededIds);
          }
        }

        await invalidateAllDomains();
        erpSyncBus.emit('offline-sync');
        return {
          ...response.data,
          synced: ordered.length - resultRows.filter((r) => r?.failed).length,
          failed: resultRows.filter((r) => r?.failed).length,
        };
      }

      return response.data;
    })();

    try {
      return await this.syncInFlight;
    } finally {
      this.syncInFlight = null;
    }
  }
}

export const offlineVaultService = new OfflineVaultService();
