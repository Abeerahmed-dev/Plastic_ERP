import { useEffect, useRef, useState } from 'react';
import { Wifi, WifiOff, RefreshCw, CheckCircle2 } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { offlineVaultService, OFFLINE_VAULT_CHANGED_EVENT } from '../services/offline-vault.service';
import { productsService } from '../services/products.service';
import { getCustomers } from '../services/customers.service';
import { bankAccountsService } from '../services/bank-accounts.service';
import { invalidateAllDomains } from '../utils/querySync';
import { erpSyncBus } from '../utils/erpSyncBus';
import { toast } from '../utils/toast';
import {
  FORCE_OFFLINE_EVENT,
  getForceOfflineMode,
  isEffectivelyOffline,
  isNavigatorOffline,
  setForceOfflineMode,
} from '../utils/networkError';

interface OfflineSyncStatusProps {
  compact?: boolean;
  placement?: 'bottom-right' | 'top-left';
}

export function OfflineSyncStatus({
  compact = false,
  placement = 'bottom-right',
}: OfflineSyncStatusProps = {}) {
  const queryClient = useQueryClient();
  const [navOffline, setNavOffline] = useState<boolean>(() => isNavigatorOffline());
  const [forceOffline, setForceOffline] = useState<boolean>(() => getForceOfflineMode());
  const [pendingCount, setPendingCount] = useState<number>(0);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [menuOpen, setMenuOpen] = useState<boolean>(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const prefetchedRef = useRef<boolean>(false);

  const refreshPending = async () => {
    const count = await offlineVaultService.getPendingCount();
    setPendingCount(count);
  };

  const prefetchMasterData = async () => {
    if (prefetchedRef.current || isEffectivelyOffline()) return;
    prefetchedRef.current = true;
    try {
      await Promise.allSettled([
        productsService.getPOSAvailableProducts(),
        productsService.getProducts(),
        getCustomers({ limit: 5000 }),
        bankAccountsService.getBankAccounts(),
      ]);
    } catch {
      prefetchedRef.current = false;
    }
  };

  const triggerSync = async (silent = false) => {
    if (isSyncing || isEffectivelyOffline()) return;
    try {
      const count = await offlineVaultService.getPendingCount();
      if (count === 0) {
        setPendingCount(0);
        return;
      }
      setIsSyncing(true);
      const res = await offlineVaultService.syncOfflineInvoices();
      const remaining = await offlineVaultService.getPendingCount();
      setPendingCount(remaining);
      if (remaining === 0) {
        if (!silent) toast.success('All offline invoices synced successfully!');
      } else if (res?.synced > 0 && !silent) {
        toast.warning(`${res.synced} synced, ${remaining} failed — check pending queue.`);
      }
      await invalidateAllDomains(queryClient);
      erpSyncBus.emit('offline-sync');
    } catch (err: any) {
      if (!silent) {
        toast.error(err?.response?.data?.error || err?.message || 'Sync failed — will retry automatically.');
      }
    } finally {
      setIsSyncing(false);
    }
  };

  useEffect(() => {
    void refreshPending();
    void prefetchMasterData();

    const onOnline = () => {
      setNavOffline(false);
      void prefetchMasterData();
      if (!getForceOfflineMode()) {
        void triggerSync(true);
      }
    };

    const onOffline = () => {
      setNavOffline(true);
    };

    const onVaultChange = () => {
      void refreshPending();
    };

    const onForceChange = (e: Event) => {
      const custom = e as CustomEvent<boolean>;
      const next = typeof custom.detail === 'boolean' ? custom.detail : getForceOfflineMode();
      setForceOffline(next);
      if (!next && !isNavigatorOffline()) {
        void prefetchMasterData();
        void triggerSync(true);
      }
    };

    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    window.addEventListener(OFFLINE_VAULT_CHANGED_EVENT, onVaultChange);
    window.addEventListener(FORCE_OFFLINE_EVENT, onForceChange);

    // Background periodic retry every 30s if online and pending items exist
    const interval = setInterval(() => {
      if (!isEffectivelyOffline()) {
        void offlineVaultService.getPendingCount().then((c) => {
          setPendingCount(c);
          if (c > 0) void triggerSync(true);
        });
      }
    }, 30000);

    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
      window.removeEventListener(OFFLINE_VAULT_CHANGED_EVENT, onVaultChange);
      window.removeEventListener(FORCE_OFFLINE_EVENT, onForceChange);
      clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  const offline = navOffline || forceOffline;

  return (
    <div ref={containerRef} className="relative flex items-center gap-1.5">
      <button
        type="button"
        onClick={() => setMenuOpen((prev) => !prev)}
        className={`flex items-center gap-1.5 ${
          compact ? 'px-2 py-1.5 rounded-lg' : 'px-2.5 py-1.5 rounded-xl'
        } text-xs font-bold border transition-all cursor-pointer ${
          offline
            ? 'bg-rose-500/15 text-rose-300 border-rose-500/50 hover:bg-rose-500/25'
            : pendingCount > 0
              ? 'bg-amber-500/15 text-amber-300 border-amber-500/50 hover:bg-amber-500/25'
              : 'bg-slate-800/90 text-emerald-300 border-slate-700 hover:bg-slate-800'
        }`}
        title={
          offline
            ? 'Offline billing active — invoices save locally & print immediately'
            : pendingCount > 0
              ? `${pendingCount} offline invoice(s) waiting to sync`
              : 'Online — Offline Vault Ready'
        }
        aria-label={
          forceOffline
            ? 'Manual Offline'
            : navOffline
              ? 'Offline'
              : pendingCount > 0
                ? `${pendingCount} Pending`
                : 'Online'
        }
      >
        {offline ? (
          <WifiOff className="w-3.5 h-3.5 text-rose-400 shrink-0" />
        ) : isSyncing ? (
          <RefreshCw className="w-3.5 h-3.5 text-amber-400 animate-spin shrink-0" />
        ) : (
          <Wifi className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
        )}
        {!compact && (
          <span className="hidden md:inline">
            {forceOffline
              ? 'Manual Offline'
              : navOffline
                ? 'Offline'
                : isSyncing
                  ? 'Syncing…'
                  : pendingCount > 0
                    ? `${pendingCount} Pending`
                    : 'Online'}
          </span>
        )}
        {pendingCount > 0 && (
          <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-amber-500 text-slate-950 text-[10px] font-black">
            {pendingCount}
          </span>
        )}
      </button>

      {menuOpen && (
        <div
          className={`absolute w-72 rounded-2xl bg-slate-900 border border-slate-700 shadow-2xl p-3.5 z-50 text-slate-100 ${
            placement === 'top-left'
              ? 'left-0 bottom-full mb-2'
              : 'right-0 top-full mt-2'
          }`}
        >
          <div className="flex items-center justify-between pb-2.5 border-b border-slate-800">
            <div className="flex items-center gap-2">
              {offline ? (
                <WifiOff className="w-4 h-4 text-rose-400" />
              ) : (
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              )}
              <div>
                <div className="text-xs font-bold">
                  {navOffline ? 'No Internet Connection' : forceOffline ? 'Manual Offline Mode ON' : 'Connection Active'}
                </div>
                <div className="text-[10px] text-slate-400">
                  {pendingCount} invoice{pendingCount === 1 ? '' : 's'} in local offline vault
                </div>
              </div>
            </div>
          </div>

          <div className="py-2.5 space-y-2.5 text-xs">
            <label className="flex items-center justify-between gap-2 p-2 rounded-xl bg-slate-800/70 cursor-pointer hover:bg-slate-800">
              <div>
                <div className="font-bold text-slate-100">Fast Offline Mode</div>
                <div className="text-[10px] text-slate-400">
                  Slow net par wait kiye bina direct offline bill + print karein
                </div>
              </div>
              <input
                type="checkbox"
                checked={forceOffline}
                onChange={(e) => {
                  const next = e.target.checked;
                  setForceOfflineMode(next);
                  setForceOffline(next);
                  toast.info(
                    next
                      ? 'Fast Offline Mode ON: Bills & slips will save locally and print instantly.'
                      : 'Online Mode restored.'
                  );
                }}
                className="h-4 w-4 rounded accent-amber-500 cursor-pointer"
              />
            </label>

            {pendingCount > 0 && (
              <button
                type="button"
                disabled={offline || isSyncing}
                onClick={() => void triggerSync(false)}
                className="w-full flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:bg-slate-700 disabled:text-slate-400 text-slate-950 font-bold transition cursor-pointer"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
                <span>{isSyncing ? 'Syncing Vault…' : `Sync Now (${pendingCount})`}</span>
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
