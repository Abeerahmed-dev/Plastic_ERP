import qz from 'qz-tray';
import { renderToStaticMarkup } from 'react-dom/server';
import React from 'react';
import { A4SalesInvoice } from '../components/print/A4SalesInvoice';

/**
 * Default printer configurations via Vite environment variables with hardcoded fallbacks
 */
export const POS_PRINTER_DEFAULT = import.meta.env.VITE_POS_PRINTER_NAME || 'POS_THERMAL';
export const A4_PRINTER_DEFAULT = import.meta.env.VITE_A4_PRINTER_NAME || 'ERP_A4_HP';

/**
 * Checks if the QZ Tray websocket connection is currently active
 */
export function isQzConnected(): boolean {
  try {
    return Boolean(qz?.websocket?.isActive());
  } catch {
    return false;
  }
}

/**
 * Connect to local QZ Tray websocket (localhost:8182/8181)
 * Tries default ports, fallback to explicit insecure 8182 and secure 8181
 */
export async function connectQzLocal(): Promise<void> {
  if (isQzConnected()) {
    return;
  }

  // Attempt 1: Standard connection
  try {
    await qz.websocket.connect({
      retries: 2,
      delay: 1,
    });
    return;
  } catch (err1) {
    console.warn('[QZ] Standard connect failed, trying explicit insecure 8182...', err1);
  }

  // Attempt 2: Explicit insecure ws:// on localhost / 127.0.0.1
  try {
    await qz.websocket.connect({
      host: ['localhost', '127.0.0.1'],
      usingSecure: false,
      retries: 1,
      delay: 0.5,
    });
    return;
  } catch (err2) {
    console.warn('[QZ] Insecure connect failed, trying explicit secure 8181...', err2);
  }

  // Attempt 3: Explicit secure wss:// on localhost / localhost.qz.io (port 8181)
  try {
    await qz.websocket.connect({
      host: ['localhost', 'localhost.qz.io'],
      usingSecure: true,
      retries: 1,
      delay: 0.5,
    });
    return;
  } catch (err3: any) {
    const detail = err3?.message || (typeof err3 === 'string' ? err3 : 'Websocket refused or closed');
    throw new Error(
      `QZ Tray is not running or localhost connection failed. Please ensure the QZ Tray desktop app is running on this computer. (${detail})`
    );
  }
}

/**
 * Silent Pixel HTML Thermal Slip Printing (80mm width)
 * @param htmlContent Full self-contained HTML markup of the receipt
 * @param printerName Optional printer name override (defaults to VITE_POS_PRINTER_NAME or 'POS_THERMAL')
 */
export async function printPosThermalSlip(
  htmlContent: string,
  printerName?: string
): Promise<void> {
  const targetPrinter = printerName || POS_PRINTER_DEFAULT;

  try {
    await connectQzLocal();

    const config = qz.configs.create(targetPrinter, {
      size: { width: 80, height: null },
      units: 'mm',
      margins: 0,
      colorType: 'color',
    });

    const data = [
      {
        type: 'pixel' as const,
        format: 'html' as const,
        flavor: 'plain' as const,
        data: htmlContent,
      },
    ];

    await qz.print(config, data);
  } catch (err: any) {
    const detail = err?.message || (typeof err === 'string' ? err : 'Unknown error');
    throw new Error(
      `POS Thermal slip printing failed on printer "${targetPrinter}": ${detail}`
    );
  }
}

/**
 * Silent Pixel HTML A4 Invoice Printing (210mm x 297mm)
 * @param htmlContent Full self-contained HTML markup of the A4 invoice
 * @param printerName Optional printer name override (defaults to VITE_A4_PRINTER_NAME or 'ERP_A4_HP')
 */
export async function printErpA4Invoice(
  htmlContent: string,
  printerName?: string
): Promise<void> {
  const targetPrinter = printerName || A4_PRINTER_DEFAULT;

  try {
    await connectQzLocal();

    const config = qz.configs.create(targetPrinter, {
      size: { width: 210, height: 297 },
      units: 'mm',
      margins: 5,
      colorType: 'color',
    });

    const data = [
      {
        type: 'pixel' as const,
        format: 'html' as const,
        flavor: 'plain' as const,
        data: htmlContent,
      },
    ];

    await qz.print(config, data);
  } catch (err: any) {
    const detail = err?.message || (typeof err === 'string' ? err : 'Unknown error');
    throw new Error(
      `ERP A4 Invoice printing failed on printer "${targetPrinter}": ${detail}`
    );
  }
}

/**
 * Query available printers from QZ Tray
 */
export async function findPrinters(query?: string): Promise<string | string[]> {
  await connectQzLocal();
  return qz.printers.find(query);
}

/**
 * Query default OS printer from QZ Tray
 */
export async function getDefaultPrinter(): Promise<string> {
  await connectQzLocal();
  return qz.printers.getDefault();
}

/**
 * Helper: Convert a relative or absolute image URL into a Base64 data URI
 */
export async function urlToBase64(url: string): Promise<string> {
  if (!url || url.startsWith('data:')) return url;
  try {
    const res = await fetch(url);
    const blob = await res.blob();
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = () => resolve(url);
      reader.readAsDataURL(blob);
    });
  } catch {
    try {
      return new URL(url, window.location.origin).href;
    } catch {
      return url;
    }
  }
}

/**
 * Helper: Inlines all <img src="..."> tags in an HTML string to Base64 data URIs
 */
export async function inlineImagesToBase64(html: string): Promise<string> {
  const imgSrcRegex = /<img[^>]+src=["']([^"']+)["']/g;
  let match: RegExpExecArray | null;
  const urlsToConvert = new Set<string>();

  while ((match = imgSrcRegex.exec(html)) !== null) {
    const src = match[1];
    if (src && !src.startsWith('data:')) {
      urlsToConvert.add(src);
    }
  }

  let resultHtml = html;
  for (const url of urlsToConvert) {
    try {
      const base64 = await urlToBase64(url);
      resultHtml = resultHtml.replaceAll(url, base64);
    } catch {
      // Ignore conversion failure and keep original url
    }
  }
  return resultHtml;
}

/**
 * Helper: Extracts all CSS styles, Tailwind utility rules, and font definitions
 * from the active document so that QZ Tray's renderer displays identical styling.
 */
export function extractCurrentStyles(): string {
  let combinedRules = '';

  try {
    for (let i = 0; i < document.styleSheets.length; i++) {
      const sheet = document.styleSheets[i];
      try {
        if (sheet.cssRules) {
          for (let j = 0; j < sheet.cssRules.length; j++) {
            combinedRules += sheet.cssRules[j].cssText + '\n';
          }
        }
      } catch {
        // Cross-origin sheets can fail security checks, will be included via link tag below
      }
    }
  } catch (e) {
    console.warn('extractCurrentStyles styleSheets error:', e);
  }

  let markup = '';

  if (combinedRules.trim()) {
    markup += `<style id="qz-extracted-styles">\n${combinedRules}\n</style>\n`;
  } else {
    // Fallback: Copy all <style> elements directly
    const styleElements = document.querySelectorAll('style');
    styleElements.forEach((el) => {
      markup += el.outerHTML + '\n';
    });
  }

  // Also include link tags pointing to stylesheets with absolute URLs
  const linkElements = document.querySelectorAll<HTMLLinkElement>('link[rel="stylesheet"]');
  linkElements.forEach((el) => {
    try {
      const absHref = new URL(el.getAttribute('href') || '', window.location.origin).href;
      markup += `<link rel="stylesheet" href="${absHref}" />\n`;
    } catch {
      markup += el.outerHTML + '\n';
    }
  });

  return markup;
}

/**
 * Generates complete self-contained HTML markup for an A4 Sales/Purchase Invoice
 * formatted with all Tailwind classes, fonts, borders, and embedded base64 logos.
 */
export async function generateA4InvoiceHtml(params: {
  invoice: any;
  type?: string;
  printCopyMode?: 'ORIGINAL' | 'DUPLICATE' | 'BOTH';
}): Promise<string> {
  const { invoice, type = 'sales', printCopyMode = 'ORIGINAL' } = params;

  let bodyContent = '';

  if (printCopyMode === 'BOTH') {
    const original = renderToStaticMarkup(
      React.createElement(A4SalesInvoice, {
        data: {
          ...invoice,
          isDuplicate: false,
          copyLabel: 'Original',
          type,
        },
      })
    );

    const duplicate = renderToStaticMarkup(
      React.createElement(A4SalesInvoice, {
        data: {
          ...invoice,
          isDuplicate: true,
          copyLabel: 'Duplicate',
          type,
        },
      })
    );

    bodyContent = `
      <div class="page-break-after-always">
        ${original}
      </div>
      <div>
        ${duplicate}
      </div>
    `;
  } else {
    const isDup = printCopyMode === 'DUPLICATE';
    bodyContent = renderToStaticMarkup(
      React.createElement(A4SalesInvoice, {
        data: {
          ...invoice,
          isDuplicate: isDup,
          copyLabel: isDup ? 'Duplicate' : 'Original',
          type,
        },
      })
    );
  }

  // Inline images (including Sabir Plastic logo) to Base64
  bodyContent = await inlineImagesToBase64(bodyContent);

  // Extract application styles and Tailwind classes
  const stylesHtml = extractCurrentStyles();

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>Invoice #${invoice.invoice_number || invoice.code || 'Print'}</title>
  ${stylesHtml}
  <style>
    @page {
      size: 210mm 297mm;
      margin: 5mm;
    }
    *, *::before, *::after {
      box-sizing: border-box !important;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    html, body {
      margin: 0 !important;
      padding: 0 !important;
      background-color: #ffffff !important;
      background: #ffffff !important;
      color: #000000 !important;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
    }
    .page-break-after-always {
      page-break-after: always !important;
      break-after: page !important;
    }
  </style>
</head>
<body style="background-color: #ffffff; color: #000000; margin: 0; padding: 0;">
  <div style="width: 100%; max-width: 210mm; margin: 0 auto; background: #ffffff;">
    ${bodyContent}
  </div>
</body>
</html>`;
}
