import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { A4SalesInvoice } from './A4SalesInvoice';

export interface A4InvoicePrintPortalProps {
  invoice: any | null;
  copyMode?: 'ORIGINAL' | 'DUPLICATE' | 'BOTH';
  onAfterPrint?: () => void;
}

export function prepareInvoiceForPrint(invoice: any, allProducts: any[] = []): any {
  if (!invoice) return null;

  const enrichedItems = (invoice.items || []).map((item: any) => {
    const prod = allProducts.find((p) => p.id === item.product_id);
    return {
      ...item,
      product_name: item.product_name || item.name || prod?.name || 'Product',
      product_name_urdu: item.product_name_urdu || item.name_urdu || prod?.name_urdu,
      product_code: item.product_code || item.code || prod?.code,
      size: item.size || item.product_size || prod?.size || '',
      category: item.category || prod?.category_name || prod?.category,
    };
  });

  const resolvedWalkIn = invoice.walk_in_customer_name || null;
  const resolvedCustomerName =
    resolvedWalkIn ||
    invoice.customer_name ||
    invoice.customer?.name ||
    'Customer';

  return {
    ...invoice,
    customer_name: resolvedCustomerName,
    walk_in_customer_name: resolvedWalkIn,
    customer_code: invoice.customer_code || invoice.customer?.code || (resolvedWalkIn ? 'WALK-IN' : undefined),
    customer_phone: invoice.customer_phone || invoice.customer?.phone,
    customer_city: invoice.customer_city || invoice.customer?.city || invoice.city,
    transport: invoice.transport ?? null,
    slip_charges: invoice.slip_charges !== undefined ? Number(invoice.slip_charges) : 0,
    delivery_charge:
      invoice.delivery_charge !== undefined
        ? Number(invoice.delivery_charge)
        : invoice.delivery_charges !== undefined
        ? Number(invoice.delivery_charges)
        : 0,
    discount: invoice.discount !== undefined ? Number(invoice.discount) : 0,
    items: enrichedItems.length > 0 ? enrichedItems : invoice.items || [],
    type: invoice.type || 'sales',
  };
}

export const A4InvoicePrintPortal: React.FC<A4InvoicePrintPortalProps> = ({
  invoice,
  copyMode = 'ORIGINAL',
  onAfterPrint,
}) => {
  const portalRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!invoice) return;

    const wasDark = document.documentElement.classList.contains('dark');
    if (wasDark) {
      document.documentElement.classList.remove('dark');
    }
    document.body.classList.add('printing-a4');

    let cleanedUp = false;
    let safetyTimer: any = null;
    const handleAfterPrint = () => {
      if (cleanedUp) return;
      cleanedUp = true;
      if (safetyTimer) clearTimeout(safetyTimer);
      document.body.classList.remove('printing-a4');
      if (wasDark) {
        document.documentElement.classList.add('dark');
      }
      window.removeEventListener('afterprint', handleAfterPrint);
      window.onafterprint = null;
      if (onAfterPrint) {
        onAfterPrint();
      }
    };

    window.addEventListener('afterprint', handleAfterPrint);
    window.onafterprint = handleAfterPrint;

    // Safety fallback timeout in case browser skips onafterprint
    safetyTimer = setTimeout(() => {
      handleAfterPrint();
    }, 15000);

    let cancelled = false;

    // Check all images within the portal (e.g., logo)
    const container = portalRef.current || document.querySelector('.invoice-print-portal');
    const images = container ? Array.from(container.querySelectorAll('img')) : [];

    const waitForImages = Promise.all(
      images.map((img) => {
        if (img.complete && img.naturalHeight !== 0) return Promise.resolve();
        return new Promise<void>((resolve) => {
          const onDone = () => {
            img.removeEventListener('load', onDone);
            img.removeEventListener('error', onDone);
            resolve();
          };
          img.addEventListener('load', onDone);
          img.addEventListener('error', onDone);
          setTimeout(onDone, 500); // 500ms safety limit
        });
      })
    );

    waitForImages.then(() => {
      if (cancelled) return;
      // Double requestAnimationFrame guarantees DOM layout reflow and paint are completed
      requestAnimationFrame(() => {
        if (cancelled) return;
        requestAnimationFrame(() => {
          if (cancelled) return;
          window.print();
        });
      });
    });

    return () => {
      cancelled = true;
      if (safetyTimer) clearTimeout(safetyTimer);
      document.body.classList.remove('printing-a4');
      if (wasDark) {
        document.documentElement.classList.add('dark');
      }
      window.removeEventListener('afterprint', handleAfterPrint);
      window.onafterprint = null;
    };
  }, [invoice]);

  if (!invoice) return null;

  return createPortal(
    <div
      ref={portalRef}
      className="invoice-print-portal hidden print:block"
      style={{ backgroundColor: '#ffffff', color: '#000000', colorScheme: 'light' }}
    >
      <style
        dangerouslySetInnerHTML={{
          __html: `
        @page {
          size: A4 portrait !important;
          margin: 8mm !important;
        }
        html, html.dark, body, html.dark body {
          background-color: #ffffff !important;
          background: #ffffff !important;
          color: #000000 !important;
          color-scheme: light !important;
        }
        .invoice-print-portal,
        .invoice-print-portal * {
          color-scheme: light !important;
        }
        @media print {
          html, html.dark, body, html.dark body {
            background-color: #ffffff !important;
            background: #ffffff !important;
            color: #000000 !important;
            color-scheme: light !important;
          }
          .page-break-after-always {
            page-break-after: always !important;
            break-after: page !important;
          }
        }
      `,
        }}
      />
      {copyMode === 'BOTH' ? (
        <>
          <div className="page-break-after-always">
            <A4SalesInvoice data={{ ...invoice, isDuplicate: false, type: invoice.type || 'sales' }} />
          </div>
          <div>
            <A4SalesInvoice data={{ ...invoice, isDuplicate: true, type: invoice.type || 'sales' }} />
          </div>
        </>
      ) : (
        <A4SalesInvoice
          data={{
            ...invoice,
            isDuplicate: copyMode === 'DUPLICATE',
            type: invoice.type || 'sales',
          }}
        />
      )}
    </div>,
    document.body
  );
};

