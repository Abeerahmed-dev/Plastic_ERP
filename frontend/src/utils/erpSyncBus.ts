import { useEffect } from 'react';
import {
  invalidateSalesInvoiceQueries,
  invalidatePurchaseQueries,
  invalidateCustomerPaymentQueries,
  invalidateSupplierPaymentQueries,
  invalidateExpenseQueries,
  invalidateProductQueries,
  invalidateAllDomains,
} from './querySync';

export type ErpSyncDomain =
  | 'invoice'
  | 'invoices'
  | 'pos'
  | 'payment'
  | 'payments'
  | 'purchase'
  | 'purchases'
  | 'product'
  | 'products'
  | 'stock'
  | 'stocks'
  | 'void'
  | 'expense'
  | 'expenses'
  | 'bank-account'
  | 'customer'
  | 'customers'
  | 'offline-sync'
  | 'all';

export interface ErpSyncEvent {
  domain: ErpSyncDomain;
  timestamp: number;
  meta?: any;
}

type ErpSyncListener = (event: ErpSyncEvent) => void;

class ErpSyncBus {
  private listeners: Set<ErpSyncListener> = new Set();

  /**
   * Subscribe to ERP mutation events.
   * Returns an unsubscribe function.
   */
  public on(listener: ErpSyncListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  /**
   * Emit a data mutation event.
   *
   * Automatically invalidates relevant React Query cache keys and triggers
   * background Zustand report updates, then notifies all mounted subscribers.
   */
  public async emit(domain: ErpSyncDomain | 'DATA_MUTATED', meta?: any): Promise<void> {
    const actualDomain: ErpSyncDomain = domain === 'DATA_MUTATED' ? (meta?.domain || 'all') : domain;
    const event: ErpSyncEvent = {
      domain: actualDomain,
      timestamp: Date.now(),
      meta,
    };

    // 1. Invalidate targeted query domains
    switch (actualDomain) {
      case 'invoice':
      case 'pos':
        await invalidateSalesInvoiceQueries();
        break;
      case 'purchase':
        await invalidatePurchaseQueries();
        break;
      case 'payment':
        if (meta?.type === 'supplier') {
          await invalidateSupplierPaymentQueries();
        } else {
          await invalidateCustomerPaymentQueries();
        }
        break;
      case 'product':
        await invalidateProductQueries();
        break;
      case 'stock':
        await Promise.all([
          invalidateProductQueries(),
          invalidatePurchaseQueries(),
          invalidateSalesInvoiceQueries(),
        ]);
        break;
      case 'void':
        await Promise.all([
          invalidateSalesInvoiceQueries(),
          invalidatePurchaseQueries(),
        ]);
        break;
      case 'expense':
        await invalidateExpenseQueries();
        break;
      case 'customer':
        await invalidateCustomerPaymentQueries();
        break;
      case 'offline-sync':
      case 'all':
      default:
        await invalidateAllDomains();
        break;
    }

    // 2. Notify all UI subscribers
    this.listeners.forEach((listener) => {
      try {
        listener(event);
      } catch (err) {
        console.warn('[erpSyncBus] Error in sync listener:', err);
      }
    });
  }
}

export const erpSyncBus = new ErpSyncBus();

/**
 * React hook that subscribes a component to real-time cross-page ERP mutations.
 *
 * @param onSync Callback executed when any mutation occurs (or filtered by domains).
 * @param domains Optional domain filter (e.g. ['invoice', 'pos']). If omitted, listens to all.
 */
export function useErpSync(
  onSync?: (event: ErpSyncEvent) => void,
  domains?: ErpSyncDomain[],
) {
  useEffect(() => {
    if (!onSync) return;

    const unsubscribe = erpSyncBus.on((event) => {
      if (!domains || domains.length === 0 || domains.includes(event.domain) || event.domain === 'all') {
        onSync(event);
      }
    });

    return unsubscribe;
  }, [onSync, domains]);
}

