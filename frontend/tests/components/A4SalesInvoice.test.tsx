import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { A4SalesInvoice } from '../../src/components/print/A4SalesInvoice';

const baseInvoice = {
  invoice_number: 'INV-00010',
  date: '2026-11-28T10:00:00.000Z',
  customer_name: 'Ali Traders',
  customer_phone: '0300-1234567',
  supplier_name: 'Sabir Supplier',
  supplier_phone: '0321-7654321',
  transport: 'Bilal Goods',
  status: 'UNPAID',
  subtotal: 5000,
  total_amount: 5000,
  amount_paid: 0,
  balance_due: 5000,
  items: [
    {
      product_name: 'Shopping Bag',
      size_label: '4x18',
      qty_kg: 10,
      price_per_kg: 500,
      line_total: 5000,
    },
  ],
};

describe('A4SalesInvoice phone visibility', () => {
  it('hides customer phone on sales invoices while keeping customer name and transport', () => {
    render(<A4SalesInvoice data={{ ...baseInvoice, type: 'sales' }} />);

    expect(screen.getByText('Ali Traders')).toBeInTheDocument();
    expect(screen.getByText('Bilal Goods')).toBeInTheDocument();
    expect(screen.queryByText('0300-1234567')).toBeNull();
  });

  it('still shows supplier phone on purchase invoices when provided', () => {
    render(<A4SalesInvoice data={{ ...baseInvoice, type: 'purchase', invoice_type: 'PURCHASE' }} />);

    expect(screen.getByText('Sabir Supplier')).toBeInTheDocument();
    expect(screen.getByText('0321-7654321')).toBeInTheDocument();
  });
});
