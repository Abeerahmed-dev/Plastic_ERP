import { test, expect } from '@playwright/test';

test.describe('Step 1: E2E Frontend Offline Vault & Local State Protection', () => {
  test.beforeEach(async ({ page }) => {
    // 1. Intercept & mock authentication for Cashier user
    await page.route('**/api/v1/auth/login', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            user: {
              id: 'c0000000-0000-0000-0000-000000000002',
              name: 'Cashier User',
              email: 'cashier@sabirplastic.local',
              role: 'CASHIER',
              roleName: 'CASHIER',
            },
            access_token: 'mock-cashier-jwt-token',
            refresh_token: 'mock-cashier-refresh-token',
          },
        }),
      });
    });

    // 2. Mock product inventory with 100 KG shelf stock
    await page.route('**/api/v1/products/**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: [
            {
              id: 'prod-vault-e2e-001',
              name: 'Plastic Pellets Grade A',
              category: 'Standard Packaging',
              size: 'Standard',
              sale_price: 250,
              fixed_retail_price_per_kg: 250,
              total_stock_kg: 100,
              current_stock: 100,
              bag_weight_kg: 25,
              rolling_avg_cost_per_kg: 150,
            },
          ],
        }),
      });
    });

    // 3. Mock Customers dropdown
    await page.route('**/api/v1/customers**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: [
            {
              id: 'cust-walkin-001',
              name: 'Walk-In Customer (Default)',
              customer_type: 'CASH',
            },
          ],
        }),
      });
    });

    // 4. Mock other background POS queries
    await page.route('**/api/v1/bank-accounts**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: [] }),
      });
    });

    await page.route('**/api/v1/reports/**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: {} }),
      });
    });

    await page.route('**/api/v1/pos/held-orders**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: [] }),
      });
    });
  });

  test('offline checkout stores payload in IndexedDB with UUID v4 & Unix timestamp, decrements local stock immediately, shows warning banner, and auto-syncs on reconnect', async ({ page, context }) => {
    let networkCheckoutAttempted = false;
    let syncRouteCalled = false;
    let syncedPayload: any = null;

    // Monitor /pos/checkout route to assert network request is bypassed when offline
    await page.route('**/api/v1/pos/checkout', async (route) => {
      networkCheckoutAttempted = true;
      await route.abort('failed');
    });

    // Mock the backend sync-offline route
    await page.route('**/api/v1/sync-offline', async (route) => {
      syncRouteCalled = true;
      syncedPayload = route.request().postDataJSON();
      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: [
            {
              id: 'synced-inv-vault-001',
              requested_qty: 20,
              fulfilled_qty: 20,
              deferred_qty: 0,
            },
          ],
        }),
      });
    });

    // 1. Boot app and login as cashier@sabirplastic.local
    await page.goto('/login');
    await expect(page).toHaveURL(/.*login/);
    await page.locator('#email').fill('cashier@sabirplastic.local');
    await page.locator('#password').fill('Cashier@123');
    await page.locator('button[type="submit"]').click();

    // 2. Navigate to POS screen and verify initial 100 KG stock
    await expect(page).toHaveURL(/.*pos/, { timeout: 15000 });
    await expect(page.getByText('Plastic Pellets Grade A').first()).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('100 KG').first()).toBeVisible();

    // 3. Add item to cart and set quantity to 20 KG
    await page.getByText('Plastic Pellets Grade A').first().click();
    await expect(page.getByTitle('Remove item')).toBeVisible({ timeout: 5000 });

    const qtyInput = page.locator('input[type="number"][min="0.001"]').first();
    await qtyInput.fill('20');

    // 4. Disconnect network via context.setOffline(true)
    await context.setOffline(true);

    // 5. Click "Complete POS Sale"
    const checkoutButton = page.getByRole('button', { name: /Complete POS Sale/i });
    await expect(checkoutButton).toBeEnabled();
    await checkoutButton.click();

    // 6. Network Assertion: Assert checkout network request is intercepted and bypassed
    expect(networkCheckoutAttempted).toBe(false);

    // 7. Storage Assertion: Read browser IndexedDB
    // Assert payload safely stored, contains standard uuid_generate_v4() primary key and strict Unix timestamp
    const offlineRecords: any[] = await page.evaluate(async () => {
      return new Promise((resolve, reject) => {
        const req = indexedDB.open('sabir_erp_offline_vault', 1);
        req.onerror = () => reject(req.error);
        req.onsuccess = () => {
          const db = req.result;
          const tx = db.transaction('offline_invoices', 'readonly');
          const store = tx.objectStore('offline_invoices');
          const getAll = store.getAll();
          getAll.onsuccess = () => resolve(getAll.result);
          getAll.onerror = () => reject(getAll.error);
        };
      });
    });

    expect(offlineRecords.length).toBe(1);
    const storedInvoice = offlineRecords[0];

    // Standard UUID v4 regex check (uuid_generate_v4())
    const uuidV4Regex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    expect(storedInvoice.id).toMatch(uuidV4Regex);

    // Strict Unix timestamp check
    expect(typeof storedInvoice.timestamp).toBe('number');
    const now = Date.now();
    expect(storedInvoice.timestamp).toBeGreaterThan(now - 120000); // Created within last 2 minutes
    expect(storedInvoice.timestamp).toBeLessThanOrEqual(now + 5000);

    // Assert stored payload contents
    expect(storedInvoice.items).toBeDefined();
    expect(storedInvoice.items.length).toBe(1);
    expect(Number(storedInvoice.items[0].quantity)).toBe(20);

    // 8. State Assertion:
    // Assert that the cashier's local UI stock quantity decrements immediately to prevent blind overselling (100 KG - 20 KG = 80 KG)
    await expect(page.getByText('80 KG').first()).toBeVisible({ timeout: 5000 });
    await expect(page.getByText('100 KG')).not.toBeVisible();

    // 9. UI Assertion:
    // Assert that the "Offline Sync Pending" warning banner appears
    const syncBanner = page.getByTestId('offline-sync-banner');
    await expect(syncBanner).toBeVisible({ timeout: 5000 });
    await expect(page.getByText(/Offline Sync Pending/i).first()).toBeVisible();

    // 10. Reconnect network via context.setOffline(false)
    await context.setOffline(false);
    await page.evaluate(() => window.dispatchEvent(new Event('online')));

    // 11. Assert sync triggers, the warning banner disappears, and IndexedDB is cleared
    await expect(syncBanner).not.toBeVisible({ timeout: 10000 });
    expect(syncRouteCalled).toBe(true);
    expect(Array.isArray(syncedPayload)).toBe(true);
    expect(syncedPayload[0].offline_id).toBe(storedInvoice.id);

    // Assert IndexedDB is cleared after sync
    const remainingRecords: any[] = await page.evaluate(async () => {
      return new Promise((resolve, reject) => {
        const req = indexedDB.open('sabir_erp_offline_vault', 1);
        req.onerror = () => reject(req.error);
        req.onsuccess = () => {
          const db = req.result;
          const tx = db.transaction('offline_invoices', 'readonly');
          const store = tx.objectStore('offline_invoices');
          const getAll = store.getAll();
          getAll.onsuccess = () => resolve(getAll.result);
          getAll.onerror = () => reject(getAll.error);
        };
      });
    });

    expect(remainingRecords.length).toBe(0);
  });
});

