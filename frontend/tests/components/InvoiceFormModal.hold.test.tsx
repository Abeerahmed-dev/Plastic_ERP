import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { InvoiceFormModal } from '../../src/pages/Invoices/InvoiceFormModal';
import * as customersService from '../../src/services/customers.service';
import { productsService } from '../../src/services/products.service';
import { bankAccountsService } from '../../src/services/bank-accounts.service';
import { posService } from '../../src/services/pos.service';

describe('InvoiceFormModal Cash Customer Hold Invoice', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    Element.prototype.scrollIntoView = vi.fn();
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    vi.restoreAllMocks();
    vi.spyOn(customersService, 'getCustomers').mockResolvedValue({
      data: [
        {
          id: 'cust-cash-1',
          code: 'CUST-0001',
          name: 'Saved Cash Buyer',
          customer_type: 'CASH',
          phone: '03001112223',
        } as any,
      ],
      meta: { total: 1, page: 1, limit: 5000, totalPages: 1 },
    });
    vi.spyOn(productsService, 'getProducts').mockResolvedValue([
      {
        id: 'prod-4x18',
        name: 'abid gold',
        size: '4x18',
        bag_weight_kg: 25,
        sale_price: 200,
        total_stock_kg: 500,
      } as any,
    ]);
    vi.spyOn(bankAccountsService, 'getBankAccounts').mockResolvedValue([]);
    vi.spyOn(posService, 'getHeldOrders').mockResolvedValue([]);
  });

  it('enables and submits Hold Invoice immediately when typing a walk-in cash customer name after adding a product', async () => {
    const createHeldSpy = vi.spyOn(posService, 'createHeldOrder').mockResolvedValue({
      id: 'held-1',
      reference_note: '[ERP] Sale - scsac',
      items: [],
      subtotal: 0,
      discount: 0,
      total_amount: 0,
      payment_method: 'CASH',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
    const onClose = vi.fn();
    const onSuccess = vi.fn();

    render(
      <QueryClientProvider client={queryClient}>
        <InvoiceFormModal isOpen={true} onClose={onClose} onSuccess={onSuccess} />
      </QueryClientProvider>
    );

    // Switch to Cash Invoice mode
    fireEvent.click(screen.getByRole('button', { name: /Cash Invoice/i }));

    // Select product first
    const prodInput = screen.getByPlaceholderText('Select product...');
    fireEvent.focus(prodInput);
    fireEvent.click(await screen.findByRole('button', { name: /abid gold/i }));

    // Type walk-in cash customer name WITHOUT blurring/pressing Enter first
    const cashInput = screen.getByPlaceholderText('Search cash customer or type walk-in name...');
    fireEvent.focus(cashInput);
    fireEvent.change(cashInput, { target: { value: 'scsac' } });

    expect(screen.getByText(/Using/i).textContent).toContain('scsac');

    const holdBtn = screen.getByRole('button', { name: /Hold Invoice/i });
    expect(holdBtn).not.toBeDisabled();

    fireEvent.click(holdBtn);

    await waitFor(() => {
      expect(createHeldSpy).toHaveBeenCalledTimes(1);
    });

    expect(createHeldSpy.mock.calls[0][0]).toMatchObject({
      customer_id: null,
      customer_name: 'scsac',
      payment_method: 'CASH',
    });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('allows holding a Cash Invoice as Walk-In Customer even when Cash Customer field is left empty', async () => {
    const createHeldSpy = vi.spyOn(posService, 'createHeldOrder').mockResolvedValue({
      id: 'held-2',
      reference_note: '[ERP] Sale - Walk-In Customer',
      items: [],
      subtotal: 0,
      discount: 0,
      total_amount: 0,
      payment_method: 'CASH',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    render(
      <QueryClientProvider client={queryClient}>
        <InvoiceFormModal isOpen={true} onClose={vi.fn()} onSuccess={vi.fn()} />
      </QueryClientProvider>
    );

    fireEvent.click(screen.getByRole('button', { name: /Cash Invoice/i }));

    const prodInput = screen.getByPlaceholderText('Select product...');
    fireEvent.focus(prodInput);
    fireEvent.click(await screen.findByRole('button', { name: /abid gold/i }));

    const holdBtn = screen.getByRole('button', { name: /Hold Invoice/i });
    expect(holdBtn).not.toBeDisabled();

    fireEvent.click(holdBtn);

    await waitFor(() => {
      expect(createHeldSpy).toHaveBeenCalledTimes(1);
    });

    expect(createHeldSpy.mock.calls[0][0]).toMatchObject({
      customer_id: null,
      customer_name: 'Walk-In Customer',
      payment_method: 'CASH',
    });
  });
});
