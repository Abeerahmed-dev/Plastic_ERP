import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PurchaseReturnModal } from '../../src/pages/Payments/PurchaseReturnModal';
import { purchasesService } from '../../src/services/purchases.service';

describe('PurchaseReturnModal Component Testing (React State Isolation)', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
        },
      },
    });
    vi.restoreAllMocks();
  });

  it('isolates input state when mounting invoice with two identical products, ensuring row 1 changes do not mirror to row 2', async () => {
    const user = userEvent.setup();

    // Mock invoice return summary containing two identical products in separate line items
    const mockSummary = {
      parentInvoice: {
        id: 'pur-inv-12345',
        invoice_number: 'PUR-2026-0001',
        supplier_name: 'Engro Polymers Ltd',
        date: '2026-11-10',
        total_amount: 50000,
        balance_due: 50000,
        status: 'UNPAID',
      },
      items: [
        {
          id: 'line-item-1',
          line_item_id: 'line-item-1',
          batch_id: 'batch-001',
          product_id: 'prod-identical-99',
          product_name: 'HDPE Injection Grade 01',
          product_size: 'Standard',
          selected_unit: 'KG',
          original_quantity: 100,
          previously_returned: 0,
          batch_remaining_qty: 100,
          remaining_quantity: 100,
          can_return_qty: 100,
          unit_price: 250,
        },
        {
          id: 'line-item-2',
          line_item_id: 'line-item-2',
          batch_id: 'batch-002',
          product_id: 'prod-identical-99', // Identical product_id to row 1
          product_name: 'HDPE Injection Grade 01',
          product_size: 'Standard',
          selected_unit: 'KG',
          original_quantity: 100,
          previously_returned: 0,
          batch_remaining_qty: 100,
          remaining_quantity: 100,
          can_return_qty: 100,
          unit_price: 250,
        },
      ],
    };

    vi.spyOn(purchasesService, 'getInvoiceReturnSummary').mockResolvedValue(mockSummary);

    render(
      <QueryClientProvider client={queryClient}>
        <PurchaseReturnModal
          parentInvoiceId="pur-inv-12345"
          isOpen={true}
          onClose={vi.fn()}
          onSuccess={vi.fn()}
        />
      </QueryClientProvider>
    );

    // Wait for the modal and invoice data to mount
    await waitFor(() => {
      expect(screen.getByText('PUR-2026-0001')).toBeInTheDocument();
    });

    const inputs = screen.getAllByRole('spinbutton') as HTMLInputElement[];
    expect(inputs).toHaveLength(2);

    // Pre-assertion: initial return quantities should display 0
    expect(inputs[0].value === '' || inputs[0].value === '0').toBe(true);
    expect(inputs[1].value === '' || inputs[1].value === '0').toBe(true);

    // Simulate user typing "10" into the return quantity of the first row
    await user.clear(inputs[0]);
    await user.type(inputs[0], '10');

    // Assert that the first row's input reflects "10"
    expect(inputs[0].value).toBe('10');

    // Strict Anti-Mirroring Assertion:
    // Verify the second row's input remains "0" (not 10), confirming permanent state isolation fix
    expect(inputs[1].value).not.toBe('10');
    expect(inputs[1].value === '' || inputs[1].value === '0').toBe(true);
    expect(inputs[1].placeholder).toBe('0');
  });
});

