import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  getForceOfflineMode,
  isEffectivelyOffline,
  isOfflineOrNetworkError,
  setForceOfflineMode,
} from '../../src/utils/networkError';
import { OfflineSyncStatus } from '../../src/components/OfflineSyncStatus';
import { offlineVaultService } from '../../src/services/offline-vault.service';
import { productsService } from '../../src/services/products.service';
import * as customersService from '../../src/services/customers.service';
import { bankAccountsService } from '../../src/services/bank-accounts.service';

describe('Offline-First Network Detection & Sync UI', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    localStorage.clear();
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    vi.restoreAllMocks();
  });

  afterEach(() => {
    setForceOfflineMode(false);
    localStorage.clear();
  });

  it('classifies slow timeouts, disconnects, and 502/504 gateway errors as offline fallback candidates while keeping 4xx validation errors online', () => {
    expect(isOfflineOrNetworkError({ code: 'ECONNABORTED', message: 'timeout of 6000ms exceeded' })).toBe(true);
    expect(isOfflineOrNetworkError({ code: 'ERR_NETWORK', message: 'Network Error' })).toBe(true);
    expect(isOfflineOrNetworkError({ isAxiosError: true, message: 'Failed to fetch' })).toBe(true);
    expect(isOfflineOrNetworkError({ response: { status: 504 } })).toBe(true);
    expect(isOfflineOrNetworkError({ response: { status: 502 } })).toBe(true);

    // Genuine 400 / 422 business/validation errors must NOT masquerade as offline
    expect(
      isOfflineOrNetworkError({
        isAxiosError: true,
        response: { status: 400, data: { error: 'Credit limit exceeded' } },
      })
    ).toBe(false);
    expect(
      isOfflineOrNetworkError({
        isAxiosError: true,
        response: { status: 422, data: { error: 'Invalid input' } },
      })
    ).toBe(false);
  });

  it('toggles Manual Offline Mode cleanly across header status control', async () => {
    vi.spyOn(offlineVaultService, 'getPendingCount').mockResolvedValue(2);
    const syncSpy = vi.spyOn(offlineVaultService, 'syncOfflineInvoices').mockResolvedValue({ synced: 2, failed: 0 });
    vi.spyOn(productsService, 'getPOSAvailableProducts').mockResolvedValue([]);
    vi.spyOn(productsService, 'getProducts').mockResolvedValue([]);
    vi.spyOn(customersService, 'getCustomers').mockResolvedValue({ data: [], meta: { total: 0, page: 1, limit: 5000, totalPages: 1 } });
    vi.spyOn(bankAccountsService, 'getBankAccounts').mockResolvedValue([]);

    render(
      <QueryClientProvider client={queryClient}>
        <OfflineSyncStatus />
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('2 Pending')).toBeInTheDocument();
    });

    // Open popover and enable Fast Offline Mode
    fireEvent.click(screen.getByRole('button', { name: /2 Pending/i }));
    const toggle = screen.getByRole('checkbox');
    fireEvent.click(toggle);

    expect(getForceOfflineMode()).toBe(true);
    expect(isEffectivelyOffline()).toBe(true);
    expect(screen.getByText('Manual Offline')).toBeInTheDocument();

    // Disable Fast Offline Mode and click Sync Now
    fireEvent.click(toggle);
    expect(getForceOfflineMode()).toBe(false);

    const syncBtn = await screen.findByRole('button', { name: /Sync Now \(2\)/i });
    fireEvent.click(syncBtn);

    await waitFor(() => {
      expect(syncSpy).toHaveBeenCalled();
    });
  });
});
