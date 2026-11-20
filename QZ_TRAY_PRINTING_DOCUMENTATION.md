# QZ Tray Silent Printing Documentation
## Sabir Plastic Store ERP & POS

---

## 1. Overview & Objective

Previously, printing receipts and invoices in the system relied on the native browser `window.print()` API, which opened an OS print preview dialog requiring manual user intervention (selecting printer, paper size, and clicking "Print").

This implementation replaces all browser print preview dialogs with **QZ Tray silent direct printing** across localhost testing and production:
- **POS Thermal Slips (80mm):** Prints silently directly to the thermal printer (`POS_THERMAL`, e.g., Black Copper 80 BC-86AC).
- **ERP Sales/Purchase Invoices (A4):** Prints silently directly to the office A4 printer (`ERP_A4_HP`, e.g., HP LaserJet P205X).
- **Zero Dialog Workflow:** Bypasses print previews for instant cashier checkout and one-click reprint operations.

---

## 2. Architecture & Printing Mechanism

```
┌────────────────────────────────────────────────────────┐
│             Web Application (Browser)                  │
│   • POS Page (Checkout / Alt+R Reprint)                │
│   • Invoices List / Detail Modal (A4 / Thermal)        │
│   • Invoice Creation (Form Modal auto-print)           │
└───────────────────────────┬────────────────────────────┘
                            │ WebSocket (ws:// / wss://)
                            ▼
┌────────────────────────────────────────────────────────┐
│             QZ Tray Desktop Application                │
│   • Running locally on the cashier/user PC             │
│   • Ports: 8182 (insecure ws://) / 8181 (secure wss://)│
└───────────────────────────┬────────────────────────────┘
                            │ Windows Spooler API
                            ▼
┌────────────────────────────────────────────────────────┐
│               Local / Network Printers                 │
│   • POS_THERMAL (80mm width, 0 margin pixel HTML)      │
│   • ERP_A4_HP (A4 210x297mm, 5mm margin pixel HTML)    │
└────────────────────────────────────────────────────────┘
```

### Key Technical Details:
1. **Pixel HTML Rendering:** QZ Tray renders complete self-contained HTML directly into a printer canvas (`type: 'pixel'`, `format: 'html'`, `flavor: 'plain'`).
2. **Asset Inlining (Base64):** All images (e.g. Sabir Plastic logo) are converted to Base64 Data URIs (`urlToBase64`) to ensure zero network dependencies during print rendering.
3. **Bilingual & Typography Preservation:** Full Urdu font support (`Jameel Noori Nastaleeq`, `Segoe UI`, `Tahoma`), Urdu RTL reversal isolation (`unicode-bidi: isolate; dir: rtl`), and exact borders/tables.
4. **Multi-Protocol Connection Fallback:** Connects automatically trying standard ports, explicit insecure port (`ws://localhost:8182`), direct IPv4 loopback (`127.0.0.1:8182`), and secure port (`wss://localhost.qz.io:8181`).

---

## 3. Files Created & Modified

| File | Action | Purpose |
|------|--------|---------|
| `frontend/src/types/qz-tray.d.ts` | **Created** | Full TypeScript type definitions for `qz-tray` websocket, configs, printers, and print calls. |
| `frontend/src/utils/qzPrint.ts` | **Created** | Centralized QZ printing utility: `connectQzLocal`, `printPosThermalSlip`, `printErpA4Invoice`, `generateA4InvoiceHtml`, `findPrinters`. |
| `frontend/src/utils/printThermal.ts` | **Modified** | Extracted `generateThermalReceiptHtml`, replaced `window.print()` / hidden iframe with direct call to `printPosThermalSlip`. |
| `frontend/src/pages/POS/POSPage.tsx` | **Modified** | Replaced `window.print()` with silent thermal printing on sale checkout, Alt+R, and header reprint buttons; added **"Test QZ Tray"** connection verification button. |
| `frontend/src/components/InvoiceDetailModal.tsx` | **Modified** | Converted "Print A4 Invoice" and "Print Slip" buttons to silent QZ dispatch with Sonner loading and success/error toasts. |
| `frontend/src/pages/Invoices/InvoiceFormModal.tsx` | **Modified** | Made `triggerA4Print` asynchronous, dispatching silent A4 print directly via QZ Tray upon invoice creation. |
| `frontend/src/pages/Invoices/InvoicesListPage.tsx` | **Modified** | Updated row-level "Print Slip" button to silent thermal print dispatch with toast feedback. |
| `frontend/.env` & `.env.example` | **Modified** | Added configurable printer environment variables: `VITE_POS_PRINTER_NAME` and `VITE_A4_PRINTER_NAME`. |
| `frontend/package.json` | **Modified** | Added official `qz-tray` dependency (`^2.3.0`). |

---

## 4. Printer Configuration & Environment Variables

Printer names are defined via Vite environment variables with fallback defaults:

```env
# Frontend .env
VITE_POS_PRINTER_NAME=POS_THERMAL
VITE_A4_PRINTER_NAME=ERP_A4_HP
```

### Windows Printer Setup:
1. Open **Control Panel ➔ Devices and Printers**.
2. Rename the 80mm thermal receipt printer (e.g., Black Copper 80) to:  
   `POS_THERMAL`
3. Rename the A4 laser printer (e.g., HP LaserJet P205X) to:  
   `ERP_A4_HP`

---

## 5. QZ Tray Desktop Application Requirements

### Recommended Version:
* **QZ Tray 2.2.4 (x86_64)**: Bundles **Java 17 LTS**. Extremely stable with zero JavaFX crashes during pixel HTML printing.
  - Download: `https://github.com/qzind/tray/releases/download/v2.2.4/qz-tray-2.2.4-x86_64.exe`

### QZ Tray 2.3.0 Notice:
* If running QZ Tray 2.3.0 (which bundles experimental Java 25), you **must** configure `tray.idle.javafx=false` in:
  `%APPDATA%\qz\prefs.properties`  
  to prevent an idle background Access Violation crash.

---

## 6. Permissions & Silent Printing (No Pop-ups)

### Localhost Anonymous Testing:
1. When printing for the first time or clicking **"Test QZ Tray"**, QZ Tray displays an authorization prompt:
   *"An anonymous request wants to connect to QZ Tray"*
2. **Important Rule:** Do **not** check "Remember this decision" for anonymous untrusted requests (checking it disables the "Allow" button in QZ Tray's security model).
3. Click **"Allow"**. The connection stays active for the entire session.

### Permanent Zero-Popup Mode (Production & Counter PCs):
To eliminate all popups permanently:
1. Generate a self-signed root certificate for the ERP.
2. Place `override.crt` in:
   `C:\Program Files\QZ Tray\override.crt`
3. QZ Tray marks the application as permanently trusted with zero prompts.

---

## 7. Multi-PC & Network Sharing Deployment (3 PCs + 1 Thermal + 1 A4)

When multiple cashier/office PCs share 1 physical thermal printer and 1 A4 printer:

1. **Physical Connection:** Connect both printers via USB to **PC 1 (Main Cashier)**.
2. **Windows Sharing on PC 1:**
   - In Printer Properties ➔ Sharing tab ➔ Check **"Share this printer"** with names `POS_THERMAL` and `ERP_A4_HP`.
3. **Client PCs (PC 2 and PC 3):**
   - Add the network shared printers: `\\PC1\POS_THERMAL` and `\\PC1\ERP_A4_HP`.
   - Install QZ Tray on PC 2 and PC 3 with "Start automatically on boot".
4. **Live URL (`http://108.xxx.xxx.xxx`):**
   - In Chrome on each PC, navigate to `http://108.xxx.xxx.xxx/pos`.
   - Click the site settings icon in the address bar ➔ Set **"Insecure content"** and **"Local network access"** to **Allow**.
5. **Print Spooling:** Windows Print Spooler automatically queues simultaneous print requests from multiple cashiers with zero job collisions.
