import { isOfflineOrNetworkError, isNavigatorOffline } from '../utils/networkError';

export type MasterCacheKey = 'pos_products' | 'all_products' | 'customers' | 'bank_accounts';

interface CacheEntry<T = any> {
  key: MasterCacheKey;
  data: T;
  updatedAt: number;
}

const CACHE_DB_NAME = 'sabir_erp_master_cache';
const CACHE_DB_VERSION = 1;
const CACHE_STORE_NAME = 'cache_entries';

class OfflineMasterCacheService {
  private dbPromise: Promise<IDBDatabase> | null = null;

  private async getDB(): Promise<IDBDatabase> {
    if (this.dbPromise) return this.dbPromise;

    this.dbPromise = new Promise((resolve, reject) => {
      if (typeof window === 'undefined' || !window.indexedDB) {
        return reject(new Error('IndexedDB is not supported'));
      }

      const request = window.indexedDB.open(CACHE_DB_NAME, CACHE_DB_VERSION);

      request.onupgradeneeded = (event: IDBVersionChangeEvent) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(CACHE_STORE_NAME)) {
          db.createObjectStore(CACHE_STORE_NAME, { keyPath: 'key' });
        }
      };

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => {
        this.dbPromise = null;
        reject(request.error);
      };
    });

    return this.dbPromise;
  }

  public async get<T>(key: MasterCacheKey): Promise<CacheEntry<T> | null> {
    try {
      const db = await this.getDB();
      return await new Promise((resolve, reject) => {
        const tx = db.transaction(CACHE_STORE_NAME, 'readonly');
        const store = tx.objectStore(CACHE_STORE_NAME);
        const req = store.get(key);
        req.onsuccess = () => resolve((req.result as CacheEntry<T>) || null);
        req.onerror = () => reject(req.error);
      });
    } catch {
      return null;
    }
  }

  public async set<T>(key: MasterCacheKey, data: T): Promise<void> {
    try {
      const db = await this.getDB();
      const entry: CacheEntry<T> = {
        key,
        data,
        updatedAt: Date.now(),
      };
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(CACHE_STORE_NAME, 'readwrite');
        const store = tx.objectStore(CACHE_STORE_NAME);
        const req = store.put(entry);
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      });
    } catch {
      // Cache persistence is best-effort
    }
  }

  /**
   * Executes networkFetcher when online; caches fresh data automatically.
   * When offline or on network/timeout failures, seamlessly falls back to cached data.
   */
  public async fetchWithCache<T>(key: MasterCacheKey, networkFetcher: () => Promise<T>): Promise<T> {
    const cached = await this.get<T>(key);

    if (isNavigatorOffline() && cached?.data !== undefined) {
      return cached.data;
    }

    try {
      const fresh = await networkFetcher();
      void this.set(key, fresh);
      return fresh;
    } catch (err: any) {
      if (isOfflineOrNetworkError(err) && cached?.data !== undefined) {
        return cached.data;
      }
      throw err;
    }
  }

  /**
   * Adjusts cached product stock locally when an offline sale or invoice is created
   * so page reloads while offline continue showing reduced shelf quantities.
   */
  public async adjustCachedProductStock(
    items: Array<{ product_id: string; quantity: number; selected_unit?: string }>
  ): Promise<void> {
    if (!Array.isArray(items) || items.length === 0) return;

    const applyToList = (list: any[]) => {
      if (!Array.isArray(list)) return list;
      return list.map((prod: any) => {
        const matchingItems = items.filter((it) => it.product_id === prod.id);
        if (matchingItems.length === 0) return prod;

        let deltaKg = 0;
        for (const it of matchingItems) {
          const unit = String(it.selected_unit || 'KG').toLowerCase();
          const bagWeight = Number(prod.bag_weight_kg || 25);
          const mult = unit === 'bag' || unit === 'bora' ? bagWeight : 1;
          deltaKg += (Number(it.quantity) || 0) * mult;
        }

        const currentKg = Number(prod.total_stock_kg ?? prod.current_stock ?? 0);
        const nextKg = Math.max(0, Math.round((currentKg - deltaKg) * 1000) / 1000);
        return {
          ...prod,
          total_stock_kg: nextKg,
          current_stock: nextKg,
        };
      });
    };

    for (const key of ['pos_products', 'all_products'] as const) {
      const entry = await this.get<any[]>(key);
      if (entry?.data && Array.isArray(entry.data)) {
        await this.set(key, applyToList(entry.data));
      }
    }
  }
}

export const offlineMasterCache = new OfflineMasterCacheService();
