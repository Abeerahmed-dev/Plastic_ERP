import { test, expect } from '@playwright/test';

test.describe('POS Golden Path E2E Workflow', () => {
  test.beforeEach(async ({ page }) => {
    // Intercept and mock backend API routes for a deterministic, hermetic E2E test
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

    await page.route('**/api/v1/products/**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: [
            {
              id: 'prod-pos-e2e-001',
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

    await page.route('**/api/v1/bank-accounts**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: [],
        }),
      });
    });

    await page.route('**/api/v1/reports/**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {},
        }),
      });
    });

    await page.route('**/api/v1/pos/held-orders**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: [],
        }),
      });
    });

    await page.route('**/api/v1/pos/checkout', async (route) => {
      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            id: 'inv-pos-golden-path',
            invoice_number: 'POS-2026-9999',
            total_amount: 250,
            paid_amount: 250,
            cash_tendered: 250,
            change_returned: 0,
            status: 'PAID',
          },
        }),
      });
    });
  });

  test('completes full cashier login, navigates to POS, adds item to cart, and completes cash checkout with success toast', async ({ page }) => {
    // 1. Boot app and navigate to login screen
    await page.goto('/login');
    await expect(page).toHaveURL(/.*login/);
    await expect(page.getByRole('heading', { name: /Sabir Plastic Store/i })).toBeVisible();

    // 2. Fill login credentials as cashier@sabirplastic.local
    await page.locator('#email').fill('cashier@sabirplastic.local');
    await page.locator('#password').fill('Cashier@123');

    // 3. Submit login form
    await page.locator('button[type="submit"]').click();

    // 4. Assert cashier role redirects directly to POS screen
    await expect(page).toHaveURL(/.*pos/, { timeout: 15000 });
    await expect(page.getByText('Plastic Pellets Grade A').first()).toBeVisible({ timeout: 10000 });

    // 5. Add product to cart by clicking the product card
    await page.getByText('Plastic Pellets Grade A').first().click();

    // 6. Assert item appears in the cart (Remove button appears and item title is shown in cart)
    await expect(page.getByTitle('Remove item')).toBeVisible({ timeout: 5000 });
    await expect(page.getByTitle('Plastic Pellets Grade A - Standard')).toBeVisible();

    // 7. Verify Cash payment method is selected by default and click Complete POS Sale
    const checkoutButton = page.getByRole('button', { name: /Complete POS Sale/i });
    await expect(checkoutButton).toBeEnabled();
    await checkoutButton.click();

    // 8. Assert the success toast notification appears
    await expect(page.getByText(/Sale completed successfully/i)).toBeVisible({ timeout: 10000 });
  });
});

