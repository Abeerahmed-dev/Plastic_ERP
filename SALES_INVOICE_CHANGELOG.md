# Sales Invoice Updates - Changelog & Merge Guide

**Date:** 17-Nov-2026  
**Module:** Sales Invoices (Wholesale ERP Billing & Printing)  
**Target Audience:** Engineering Lead / Manager for Pull Request & Merge Review  

---

## 1. Executive Summary

This document outlines the comprehensive enhancements implemented across the **Sales, Purchases, Payments, and Settings** modules of the **Sabir Plastic Store ERP System**:

1. **"Save and Print Invoice" with A4 Output:** Replaced "Save Invoice" with "Save and Print Invoice", automatically triggering an isolated, high-resolution A4 portrait print preview upon successful backend persistence.
2. **"Hold Invoice" Capability:** Added a "Hold Invoice" button adjacent to the save button, allowing cashiers/operators to temporarily hold incomplete wholesale bills and resume them later with full state restoration.
3. **Print Copy Mode Checkboxes (Original, Duplicate, Both):** Implemented three explicit selection checkboxes allowing the user to print:
   - **Original:** Exactly 1 copy marked with `SALE BILL | Original`.
   - **Duplicate:** Exactly 1 copy marked with `SALE BILL | Duplicate`.
   - **Both:** Exactly 2 copies sequentially (Page 1 = Original, Page 2 = Duplicate) with automatic page-break.
4. **100% Keyboard-Driven Workflow for Wholesale Sales (`InvoiceFormModal.tsx`):** Fast data-entry via `Enter`, `Tab`, `Arrow Up/Down`, and hotkeys (`customer -> product family -> variant/size -> bags -> quantity -> price -> auto-add new row`).
5. **100% Keyboard-Driven Workflow for Purchasing (`PurchaseFormModal.tsx`):** Complete keyboard navigation for supplier purchase bills with auto-row generation.
6. **100% Keyboard-Driven Workflow for Record Payments (`RecordPaymentModal.tsx`, `PaymentFormModal.tsx`, `SupplierPaymentFormModal.tsx`):** Auto-focusing amount, sequential `Enter` chaining, and `Alt + C` instant balance clearance.
7. **Clean Modal UI & Dedicated "Controls" Hub in Settings (`SettingsPage.tsx`):** Removed visual clutter (shortcut banners and button badges) from modal screens, while keeping all hotkeys 100% active, and created a dedicated "Controls" tab in Settings documenting all shortcuts.
8. **Guaranteed Pure White Invoice Print in Dark Mode (Zero Ink Waste):** Invoices strictly print with pure white background (`#ffffff`) and crisp black text regardless of dark mode.
9. **Removal of "Void Invoice" Button:** Cleanly removed the redundant "Void Invoice" button from invoice view modals.
10. **Editable Opening Balance in Customer & Party Profile Modals:** Enabled viewing and editing of the **Opening Balance** (`opening_balance` / `opening_payable`) directly inside the Edit modal for both Customers and Parties/Suppliers, dynamically recalculating their ledger statements and outstanding balances.
11. **Phone Number Support in Customer & Party Forms and Ledger Displays:** Added phone number input to Customer and Party forms (create and edit), and displayed the contact phone number right next to the city name in Customer and Party ledger headers and printable statement documents.
12. **Removal of City Dropdown in Add Party Modal (`SupplierFormModal.tsx`):** Removed predefined datalist dropdown in the supplier/party city input for clean, standard text entry without unwanted popups.
13. **Standard `DD/MM/YYYY` Date Format Across All Forms & Tables:** Replaced native US-locale `<input type="date">` (`mm/dd/yyyy`) with a dedicated `<DateInput>` component enforcing strict `dd/mm/yyyy` display, direct text entry, and calendar picker support. Converted all list tables and modals to `'en-GB'` (`DD/MM/YYYY`).
14. **Natural Product Dimensional Sorting & Title Format `${name}(${size})`:** Implemented dimension-aware numerical sorting (e.g. `8x11` < `9x11` < `10x14`) across backend queries, POS search suggestions, POS catalog grid, and wholesale/purchase variant dropdowns, formatting items as `Abid Gold(8x11)`.
15. **"Add Product" Enablement for Accountant Role:** Granted `products:write` permission to the Accountant role in database `role_permissions` and seeds. Enabled "Add Product" and product edit actions on the Product Catalog (`ProductsListPage.tsx`), and added an "Add Product" action button directly in the Stocks screen (`InventoryValuationPage.tsx`).
16. **Silent Printing with QZ Tray for POS & ERP A4 Invoices:** Replaced browser `window.print()` / print preview dialogs with **QZ Tray** websocket pixel HTML silent printing. POS thermal receipts dispatch directly to `"POS_THERMAL"` (configurable via `VITE_POS_PRINTER_NAME`) at 80mm width with 0 margins, and ERP wholesale invoices dispatch to `"ERP_A4_HP"` (configurable via `VITE_A4_PRINTER_NAME`) at A4 portrait dimensions with 5mm margins. Layouts, bilingual names, Nastaliq fonts, and logos (inlined as base64 data URIs) are 100% preserved.
12. **Removal of City Dropdown in Add Party Modal (`SupplierFormModal.tsx`):** Removed predefined datalist dropdown in the supplier/party city input for clean, standard text entry without unwanted popups.
13. **Standard `DD/MM/YYYY` Date Format Across All Forms & Tables:** Replaced native US-locale `<input type="date">` (`mm/dd/yyyy`) with a dedicated `<DateInput>` component enforcing strict `dd/mm/yyyy` display, direct text entry, and calendar picker support. Converted all list tables and modals to `'en-GB'` (`DD/MM/YYYY`).
14. **Natural Product Dimensional Sorting & Title Format `${name}(${size})`:** Implemented dimension-aware numerical sorting (e.g. `8x11` < `9x11` < `10x14`) across backend queries, POS search suggestions, POS catalog grid, and wholesale/purchase variant dropdowns, formatting items as `Abid Gold(8x11)`.
15. **"Add Product" Enablement for Accountant Role:** Granted `products:write` permission to the Accountant role in database `role_permissions` and seeds. Enabled "Add Product" and product edit actions on the Product Catalog (`ProductsListPage.tsx`), and added an "Add Product" action button directly in the Stocks screen (`InventoryValuationPage.tsx`).
16. **Silent Printing with QZ Tray for POS & ERP A4 Invoices:** Replaced browser `window.print()` / print preview dialogs with **QZ Tray** websocket pixel HTML silent printing. POS thermal receipts dispatch directly to `"POS_THERMAL"` (configurable via `VITE_POS_PRINTER_NAME`) at 80mm width with 0 margins, and ERP wholesale invoices dispatch to `"ERP_A4_HP"` (configurable via `VITE_A4_PRINTER_NAME`) at A4 portrait dimensions with 5mm margins. Layouts, bilingual names, Nastaliq fonts, and logos (inlined as base64 data URIs) are 100% preserved.

---

## 2. Detailed Technical Breakdown

### Feature 1: "Save and Print Invoice" (A4 Format)
- **Previous State:** The button was labeled "Save Invoice" and only saved the invoice to the backend before immediately closing the modal. Users had to manually find the invoice in the list and click print.
- **New State:**
  - The button is now labeled **"Save and Print Invoice"** with a `Printer` icon.
  - When submitted, the form executes `invoicesService.createInvoice(cleanData)`.
  - Upon receiving the created invoice from the server, the invoice object is enriched with the selected customer's metadata (`customer_name`, `customer_city`, `customer_phone`, `customer_code`) and product definitions.
  - The invoice is mounted into `document.body` via React `createPortal` inside `<div className="invoice-print-portal hidden print:block">`.
  - Global print mode class `printing-a4` is applied to `document.body`, which triggers the CSS rule hiding the main ERP UI (`body.printing-a4 > #root { display: none !important; }`) and rendering only the A4 sheet.
  - An `afterprint` listener cleans up DOM portals and CSS classes, invalidates TanStack React Query caches, and closes the modal seamlessly.

### Feature 2: "Hold Invoice" Functionality
- **Requirement:** Cashiers/operators often need to attend to another party or allow customers to verify stock quantities before finalizing wholesale invoices.
- **Implementation:**
  - Added a dedicated **"Hold Invoice"** button (`PauseCircle` icon) placed immediately to the left of "Save and Print Invoice".
  - **Validation:** Ensures at least one valid line item with a selected product exists and a customer is chosen.
  - **Data Model:** Encapsulates the entire form state:
    - Customer ID & Name
    - Full line items array (family name, variant ID, bags count, total KG, unit price, line totals)
    - Financial figures (subtotal, discount, delivery/freight charge, total payable)
    - Invoice metadata (date, due date, notes)
  - **Storage:** Persisted to the PostgreSQL database table `pos_held_orders` via `posService.createHeldOrder()` with an explicit prefix `[ERP] Sale - <Customer Name> (<Time>)`.
  - **Domain Segregation:**
    - POS walk-in terminal (`POSPage.tsx`) filters out any held order starting with `[ERP]` so retail cashiers are never confused by wholesale held bills.
    - Wholesale Invoices (`InvoicesListPage.tsx` & `InvoiceFormModal.tsx`) filter and display only wholesale ERP held bills.
  - **Resuming:**
    - Operators can click **"Held Invoices (<count>)"** either on the main Invoices List page or inside the Create Invoice modal header.
    - Clicking **"Resume"** restores all inputs into the `react-hook-form` state and safely deletes the held entry from the database.

### Feature 3: Print Copy Selection (Original / Duplicate / Both)
- **UI Architecture:** Placed in the modal's bottom action bar inside a clean, bordered pill container:
  - `[x] Original`
  - `[ ] Duplicate`
  - `[ ] Both`
- **Component State:** Managed via `printCopyMode: 'ORIGINAL' | 'DUPLICATE' | 'BOTH'` (defaults to `'ORIGINAL'`).
- **Print Rendering Logic (`A4SalesInvoice.tsx` Integration):**
  - **Original Mode:** Renders `<A4SalesInvoice data={{ ...invoice, isDuplicate: false, type: 'sales' }} />`.
  - **Duplicate Mode:** Renders `<A4SalesInvoice data={{ ...invoice, isDuplicate: true, type: 'sales' }} />`.
  - **Both Mode:** Renders:
    ```tsx
    <div className="page-break-after-always">
      <A4SalesInvoice data={{ ...printInvoiceData, isDuplicate: false, type: 'sales' }} />
    </div>
    <div>
      <A4SalesInvoice data={{ ...printInvoiceData, isDuplicate: true, type: 'sales' }} />
    </div>
    ```
    Coupled with:
    ```css
    @page { size: A4 portrait !important; margin: 8mm !important; }
    @media print {
      .page-break-after-always {
        page-break-after: always !important;
        break-after: page !important;
      }
    }
    ```
  - **Dynamic Copy Badge Binding (`A4SalesInvoice.tsx`):**
    - The two-tone top title banner is dynamically bound to `copyBadgeText` (`data.isDuplicate ? 'Duplicate' : 'Original'`).
    - Guarantees that:
      - **Original Selection:** Renders `[ SALE BILL ] [ Original ]`.
      - **Duplicate Selection:** Renders `[ SALE BILL ] [ Duplicate ]`.
      - **Both Selection:** Page 1 renders `[ SALE BILL ] [ Original ]` and Page 2 renders `[ SALE BILL ] [ Duplicate ]`.
  - **Saved Invoice View Integration (`InvoiceDetailModal.tsx`):**
    - Added the identical 3 print checkboxes (`Original`, `Duplicate`, `Both`) directly into the invoice view modal adjacent to "Print A4 Invoice", enabling flexible re-printing of historical invoices.

### Feature 4: 100% Keyboard-Driven Workflow (No Mouse Needed)
- **Modal Opening Focus:** Auto-focuses the customer search combobox immediately upon opening the modal.
- **`SearchableCombobox` Keyboard Integration:**
  - `ArrowDown` / `ArrowUp`: Cycles through dropdown options with auto-scrolling (`scrollToOption`).
  - `Enter`: Selects highlighted customer or product and fires `onSelectNext` to focus the subsequent field automatically.
  - `Tab`: Auto-selects highlighted option and advances focus.
  - `Escape`: Closes the combobox dropdown without closing the modal.
- **Enter-Driven Form Flow:**
  - **Customer Combobox** -> Press `Enter` -> jumps to **Row 0 Product Family**.
  - **Product Family Combobox** -> Press `Enter` -> jumps to **Row 0 Size / Variant**.
  - **Size / Variant Combobox** -> Press `Enter` -> jumps to **Row 0 Bags Helper** (value auto-selected).
  - **Bags Helper Input** -> Press `Enter` -> jumps to **Row 0 Quantity (KG)** (value auto-selected).
  - **Quantity (KG) Input** -> Press `Enter` -> jumps to **Row 0 Price / KG** (value auto-selected).
  - **Price / KG Input** -> Press `Enter`:
    - If it's the last row and valid: automatically appends a new row and jumps to **Row N+1 Product Family**!
    - If `Shift+Enter`: jumps to **Discount**.
- **Keyboard Shortcuts:**
  - `Ctrl + Enter` or `F9`: Save and Print Invoice (A4).
  - `Alt + H` or `Ctrl + Shift + Enter`: Hold Invoice.
  - `Alt + P`: Toggle Print Copy mode (`Original` -> `Duplicate` -> `Both`).
  - `Alt + Delete` or `Ctrl + Backspace`: Delete current row and focus previous row.
  - `Escape`: Close modal (when dropdowns are closed).

---

### Feature 5: 100% Keyboard-Driven Workflow for Purchasing (`PurchaseFormModal.tsx`)
- **Requirement:** User should be able to create and save purchase bills rapidly entirely from the keyboard without needing mouse clicks.
- **Implementation:**
  - **Party Combobox:** Replaced standard `<select>` with `<SearchableCombobox>`, auto-focused on modal mount.
  - **Enter-Driven Row Chaining:**
    - `Party Combobox` -> Press `Enter` -> jumps to `Row 0 Product Family`.
    - `Product Family Combobox` -> Press `Enter` -> jumps to `Row 0 Size / Variant`.
    - `Size / Variant Combobox` -> Press `Enter` -> jumps to `Row 0 Bags Helper`.
    - `Bags Helper Input` -> Press `Enter` -> jumps to `Row 0 Quantity (KG)`.
    - `Quantity (KG) Input` -> Press `Enter` -> jumps to `Row 0 Unit Price / KG`.
    - `Unit Price / KG Input` -> Press `Enter`:
      - If it is the last row: **automatically adds a new item row** and focuses the next row's `Product Family`!
      - If `Shift+Enter`: jumps to `Discount`.
    - `Discount` -> Press `Enter` -> jumps to `Delivery Charges`.
    - `Delivery Charges` -> Press `Enter` -> jumps to `Notes`.
  - **Row Deletion:** Pressing `Alt + Delete` or `Ctrl + Backspace` on any row field instantly deletes that row and smoothly focuses the previous row's price input.
  - **Keyboard Shortcuts:**
    - `Ctrl + Enter` or `F9`: Save Purchase Invoice.
    - `Alt + A` or `F4`: Add New Line Item.
    - `Alt + Delete` or `Ctrl + Backspace`: Delete Current Item Row.
    - `Escape`: Close Purchase Modal.

---

### Feature 6: 100% Keyboard-Driven Workflow for Record Payments (`RecordPaymentModal.tsx`, `PaymentFormModal.tsx`, `SupplierPaymentFormModal.tsx`)
- **Requirement:** Keyboard-driven settlement for both Sales (Customer) and Purchasing (Supplier) payments.
- **Implementation:**
  - **Auto-Focusing:**
    - If customer/supplier is already preselected (e.g. from invoice action or detail page), focus automatically defaults directly into the **Amount** field with all digits selected.
    - If no party is preselected, focus defaults into the **Searchable Party Combobox**.
  - **Sequential Enter Progression:**
    - `Party` -> `Enter` -> `Invoice Selection` -> `Enter` -> `Payment Date` -> `Enter` -> `Amount` -> `Enter` -> `Payment Method` -> `Enter` -> `Bank Account / PDC Fields` -> `Enter` -> `Notes`.
  - **"Clear Full Balance" Hotkey (`Alt + C`):**
    - Pressing `Alt + C` automatically fills the exact outstanding balance due into the `amount` input and highlights it.
  - **Keyboard Shortcuts:**
    - `Ctrl + Enter` or `F9`: Save / Submit Payment.
    - `Alt + C`: Clear Full Balance.
    - `Escape`: Close / Cancel.

---

### Feature 7: Dedicated "Controls" Hub in Settings (`SettingsPage.tsx`)
- **Requirement:** User requested to remove visual shortcut banners, badges, and labels (`(Alt+H)`, `(Alt+P)`, `(Esc)`, `Ctrl+Enter`) from the invoice modal UI to eliminate screen clutter, and relocate the comprehensive keyboard shortcut guide into a dedicated **"Controls"** tab in Settings (replacing the previous placeholder "POS & Billing Rules" tab).
- **Implementation:**
  - Cleaned up all modal interfaces (`InvoiceFormModal.tsx`, `PurchaseFormModal.tsx`, `RecordPaymentModal.tsx`, `PaymentFormModal.tsx`, `SupplierPaymentFormModal.tsx`) by removing top shortcut bars and inline button badges, while maintaining 100% full background hotkey listener functionality.
  - In `SettingsPage.tsx`, renamed the `pos` tab to **Controls** (`label: 'Controls'`, icon: `Keyboard`).
  - Implemented an elegant, responsive 4-card documentation interface inside Settings:
    1. **Wholesale Sales Invoices:** Keybindings and sequential Enter navigation guide.
    2. **Purchasing Invoices:** Supplier selection, row appending, and submission shortcuts.
    3. **Record Payments:** Balance clearing (`Alt + C`) and payment confirmation shortcuts.
    4. **Tips & Best Practices:** Explaining direct typing in search comboboxes and auto-selected number values.

---

### Feature 8: Guaranteed Pure White Invoice Print in Dark Mode (Zero Ink Waste)
- **Problem:** When the user enabled system Dark Mode (`html.dark`), Tailwind's global dark background styles (`#0A0B10` / `#161925`) and browser print engines rendered invoices with a solid black/dark background, wasting expensive printer ink/toner.
- **Implementation:**
  - **CSS Print Architecture (`index.css`):**
    - Enforced `color-scheme: light !important`, `background: #ffffff !important`, and `color: #000000 !important` on `html`, `html.dark`, `body`, and all print portals (`.invoice-print-portal`, `.pos-print-portal`).
    - Stripped all dark-mode background overrides from `.bg-white` and text elements inside print media.
  - **Component Styling (`A4SalesInvoice.tsx` & `ThermalReceipt80mm.tsx`):**
    - Added inline styles `style={{ backgroundColor: '#ffffff', color: '#000000', colorScheme: 'light' }}` ensuring zero ink waste.
  - **Lifecycle Isolation (`triggerA4Print` & `triggerPrint`):**
    - Temporarily removes the `.dark` class from `document.documentElement` right before invoking `window.print()` and automatically restores it upon `afterprint` completion.

---

### Feature 9: 100% Keyboard-Driven Workflow for Retail POS Terminal (`POSPage.tsx`)
- **Requirement:** Fast retail counter sales should be completely operable via keyboard shortcuts, arrow keys, and `Enter` without requiring mouse clicks.
- **Implementation:**
  - **Auto-Focus on Mount:** Product search field (`pos-product-search`) receives immediate autofocus when opening the POS terminal.
  - **Search & Add Chaining:**
    - `↑ / ↓` Arrow keys navigate the product search results in the grid with active visual highlighting (`ring-2 ring-amber-500 scale-[1.02] shadow-lg`).
    - `Enter` in the search field immediately adds the selected/highlighted product to the cart.
    - Adding an item auto-focuses that item's **Quantity** input (`pos-cart-qty-{id}`) with all numbers pre-selected.
    - Typing quantity and pressing `Enter` advances to the **Price** input (`pos-cart-price-{id}`).
    - Pressing `Enter` on Price returns focus smoothly to the **Product Search** field with the search bar cleared, ready for the next product.
  - **Cart Row Navigation:**
    - `↑ / ↓` Arrow keys navigate between items in the cart.
    - `Alt + Delete` or `Ctrl + Backspace` instantly removes an item from the cart and refocuses the adjacent row or search.
  - **Customer Selection:** Replaced the native `<select>` dropdown with `<SearchableCombobox>` (`pos-customer-select`) with arrow key navigation and instant jump to search upon selection (`Alt + U` / `F3`).
  - **Amount Paid & Settlement:**
    - `Alt + A` or `F10` jumps directly to the **Amount Paid** input (`pos-amount-paid`) with all numbers pre-selected.
    - Pressing `Enter` on Amount Paid immediately finalizes checkout and prints the receipt.
  - **Global Hotkeys:**
    - `Ctrl + Enter` or `F9`: Complete POS Sale & Print Thermal Receipt.
    - `Alt + H` or `F8`: Hold Current Bill (`HoldConfirmModal` with note auto-focused and Enter submission).
    - `Alt + B` or `F7`: Open Held Bills List Modal.
    - `Alt + P` or `F6`: Toggle Slip Mode (Single 1 Slip <-> Duplicate 2 Slips).
    - `Alt + M`: Cycle Payment Method (`CASH` -> `BANK` -> `SPLIT`).
    - `Alt + U` or `F3`: Focus Customer Selection.
    - `Alt + S` or `F2`: Focus Product Search.
    - `Alt + A` or `F10`: Focus Amount Paid.
    - `Alt + N`: Open New Customer Registration Modal.
    - `Alt + R`: Reprint Last Receipt.
    - `Alt + C`: Clear Cart.
    - `Escape`: Close any active modal or clear search term.
  - **Settings Hub Documentation:** Added a dedicated "Retail POS Counter" card in the Settings "Controls" tab documenting all POS shortcuts.

### Feature 10: Editable Opening Balance in Customer and Party (Supplier) Edit Modals
- **Requirement:** Previously, opening balances could only be set once during initial creation (`!isEdit`). When editing an existing customer or party/supplier, opening balance was hidden and immutable, preventing business operators from correcting initial opening balances.
- **Backend Architecture:**
  - `backend/src/modules/customers/customers.schemas.ts`: Updated `updateCustomerSchema` to allow `opening_balance: z.coerce.number().min(0).optional()`.
  - `backend/src/modules/customers/customers.repository.ts`: Updated `updateCustomer` to persist `opening_balance` changes and reload via `findCustomerById(id)` to recalculate `outstanding_balance`, `net_balance`, and running ledger statement.
  - `backend/src/modules/suppliers/suppliers.schemas.ts`: Updated `updateSupplierSchema` to allow `opening_payable: z.coerce.number().min(0).optional()` and `opening_balance: z.coerce.number().min(0).optional()`.
  - `backend/src/modules/suppliers/suppliers.repository.ts`: Updated `updateSupplier` to synchronize `opening_payable` and `opening_balance` columns and recalculate `outstanding_payable`, `advance_payable`, and supplier ledger running balance.
- **Frontend Architecture:**
  - `frontend/src/types/customer.types.ts`: Updated `UpdateCustomerData` to allow `opening_balance`.
  - `frontend/src/types/supplier.types.ts`: Updated `UpdateSupplierData` to allow `opening_payable` / `opening_balance`.
  - `frontend/src/pages/Customers/CustomerFormModal.tsx`:
    - Loaded `opening_balance: customer.opening_balance ?? 0` into form default values.
    - Rendered the **Opening Balance (Rs.)** input in edit mode with helpful guidance text.
    - Added cache invalidation for both `['customers']` and `['customer']` queries upon saving.
  - `frontend/src/pages/Suppliers/SupplierFormModal.tsx`:
    - Loaded `opening_payable: Number(supplier.opening_payable ?? supplier.opening_balance ?? 0)` into form default values.
    - Rendered the **Opening Balance (Rs.)** input in edit mode with helpful guidance text.
    - Added cache invalidation for both `['suppliers']` and `['supplier']` queries upon saving.

### Feature 11: Phone Number in Customer and Party (Supplier) and Ledger Display
- **Requirement:** Add contact phone number inputs to Customer and Party creation and edit forms, and render the phone number directly next to the City badge in both the Customer and Party Ledger pages and Statement of Account documents.
- **Form Integration:**
  - `frontend/src/pages/Customers/CustomerFormModal.tsx`: Rendered **Phone Number** input adjacent to City in a clean 2-column layout.
  - `frontend/src/pages/Suppliers/SupplierFormModal.tsx`: Added `phone` to zod validation schema and default values, rendering **Phone Number** input adjacent to City.
- **Ledger & Statement Display:**
  - `frontend/src/pages/Customers/CustomerDetailPage.tsx`: Rendered `{customer.phone}` in a distinct badge with a `Phone` icon directly next to the `{customer.city}` badge at the top right of the customer ledger header.
  - `frontend/src/pages/Suppliers/SupplierDetailPage.tsx`: Rendered `{supplier.phone}` in a distinct badge with a `Phone` icon directly next to the `{supplier.city}` badge at the top right of the supplier ledger header.
  - `frontend/src/pages/Customers/CustomerLedger.tsx` & `frontend/src/pages/Suppliers/SupplierLedger.tsx`: Passed `entityCity` and `entityPhone` down to `StatementOfAccount`.
  - `frontend/src/components/StatementOfAccount.tsx`:
    - Displayed City and Phone badges in the General Ledger screen header.
    - Added City and Phone number to the top right of the printable statement header (`print:block`).

### Feature 12: Removal of Dropdown in Add Party City Section
- **Requirement:** User requested: "Remove the dropdown in add party city section".
- **Implementation:**
  - Removed `PAKISTAN_CITIES` static array and `<datalist id="pakistan-cities">` from `frontend/src/pages/Suppliers/SupplierFormModal.tsx`.
  - Removed `list="pakistan-cities"` attribute from the City `<input>`.
  - The City input is now a clean standard text input without automatic browser suggestion popups.

### Feature 13: Standard `DD/MM/YYYY` Date Format Across All Forms and Tables
- **Requirement:** User requested: "date should be there as dd/mm/yy instead of mm/dd/yy".
- **Implementation:**
  - **Component (`frontend/src/components/DateInput.tsx`):**
    - Created a custom date input component wrapping a text input with ISO <-> `DD/MM/YYYY` formatting (`isoToDisplayDate`, `displayDateToIso`).
    - Enforces user-facing display strictly as `dd/mm/yyyy` (e.g. `17/11/2026`) regardless of Windows OS/browser locale settings.
    - Integrates a hidden native date picker triggered via a calendar icon button (`showPicker()`) to let users select dates visually or type them directly.
    - Passes keyboard Enter and hotkey events seamlessly to next fields.
  - **Modals Updated:**
    - `frontend/src/pages/Invoices/InvoiceFormModal.tsx`: Used `<DateInput>` for Invoice Date (`date`) and Due Date (`due_date`).
    - `frontend/src/pages/Purchases/PurchaseFormModal.tsx`: Used `<DateInput>` for Bill Date (`date`) and Due Date (`due_date`).
  - **Tables & Views Updated:**
    - Updated all raw `.toLocaleDateString()` invocations to `.toLocaleDateString('en-GB')` so dates render as `17/11/2026` across:
      - `InvoicesListPage.tsx`
      - `PurchasesListPage.tsx`
      - `PaymentsListPage.tsx`
      - `SupplierPaymentsListPage.tsx`
      - `InvoiceDetailModal.tsx`

### Feature 14: Natural Product Dimensional Sorting & Title Format `${name}(${size})`
- **Requirement:** User requested: "all the items should be in sequence like if i search abid gold so the seach bar should be like: Abid Gold(8x11), Abid Gold(9x11), Abid Gold(10x14)".
- **Sorting Logic (`frontend/src/utils/productSorting.ts`):**
  - Standard alphanumeric sorting erroneously sorts strings like `"10x14"` before `"8x11"`.
  - Implemented `parseDimension(size: string)` extracting numeric `width` and `length` via regex `^(\d+(?:\.\d+)?)\s*[*xX×]\s*(\d+(?:\.\d+)?)`.
  - `compareProductSizes(a, b)`: Compares parsed numeric width first, then numeric length, falling back to natural alphanumeric comparison.
  - `compareProducts(a, b)`: Groups products by name (`localeCompare`), then secondary sorts by dimensional size.
  - `formatProductTitle(name, size)`: Standardizes label presentation to `${name}(${size})`.
- **System Integration:**
  - **Backend (`backend/src/modules/products/products.repository.ts`):** Added dimensional sorting to `findPOSAvailableProducts` and `findAllProducts` so returned query rows maintain strict numerical sequence.
  - **POS Module (`frontend/src/pages/POS/POSPage.tsx`):**
    - Products in memory are sorted using `compareProducts`.
    - Added an instant live search suggestions dropdown directly underneath the search bar showing matching products with their title in `${name}(${size})` format, stock KG, and price. Clicking or navigating an item adds it directly to the bill.
    - Catalog grid items display `${name}(${size})` format.
  - **Wholesale Sales Invoices (`frontend/src/pages/Invoices/InvoiceFormModal.tsx`):**
    - `groupedProducts` families and variant options are sorted using `compareProducts`.
    - Variant dropdown labels format as `${name}(${size}) (${code})`.
  - **Purchases (`frontend/src/pages/Purchases/PurchaseFormModal.tsx`):**
    - `groupedProducts` families and variant options are sorted using `compareProducts`.
    - Variant dropdown labels format as `${name}(${size}) (${code})`.

### Feature 15: "Add Product" Enablement for Accountant Screen
- **Requirement:** User requested: "theres is no add product button in accountant screen kindly add this in accountant screen".
- **Root Cause:**
  - In `frontend/src/pages/Products/ProductsListPage.tsx`, write permissions were guarded by `const canWrite = isCashier || isOwner || hasPermission('products:write')`.
  - The `ACCOUNTANT` role lacked `isOwner` and `isCashier` checks, and previously lacked `products:write` in the role permissions seed.
  - As a result, when an Accountant opened the Products screen, the "Add Product" button was completely omitted from the UI.
- **Implementation:**
  - **Permissions & Database:** Granted `products:write` to the `Accountant` role in the PostgreSQL database and updated `backend/src/db/seeds/03_role_permissions.ts`.
  - **Product Catalog Screen (`frontend/src/pages/Products/ProductsListPage.tsx`):**
    - Updated `canWrite` to include `isAccountant` (`const canWrite = isCashier || isOwner || isAccountant || hasPermission('products:write')`).
    - Unlocked the **"Add Product"** button and inline edit button for accountants.
  - **Stocks / Inventory Valuation Screen (`frontend/src/pages/Reports/InventoryValuationPage.tsx`):**
    - Added an **"Add Product"** action button in the top toolbar adjacent to "Update Stocks".
    - Connected `ProductFormModal` with TanStack React Query cache invalidation (`inventoryValuation` and `products`), allowing accountants to quickly register new products/variants directly from the Stocks screen without page navigation.

### Feature 12: Removal of Dropdown in Add Party City Section
- **Requirement:** User requested: "Remove the dropdown in add party city section".
- **Implementation:**
  - Removed `PAKISTAN_CITIES` static array and `<datalist id="pakistan-cities">` from `frontend/src/pages/Suppliers/SupplierFormModal.tsx`.
  - Removed `list="pakistan-cities"` attribute from the City `<input>`.
  - The City input is now a clean standard text input without automatic browser suggestion popups.

### Feature 13: Standard `DD/MM/YYYY` Date Format Across All Forms and Tables
- **Requirement:** User requested: "date should be there as dd/mm/yy instead of mm/dd/yy".
- **Implementation:**
  - **Component (`frontend/src/components/DateInput.tsx`):**
    - Created a custom date input component wrapping a text input with ISO <-> `DD/MM/YYYY` formatting (`isoToDisplayDate`, `displayDateToIso`).
    - Enforces user-facing display strictly as `dd/mm/yyyy` (e.g. `17/11/2026`) regardless of Windows OS/browser locale settings.
    - Integrates a hidden native date picker triggered via a calendar icon button (`showPicker()`) to let users select dates visually or type them directly.
    - Passes keyboard Enter and hotkey events seamlessly to next fields.
  - **Modals Updated:**
    - `frontend/src/pages/Invoices/InvoiceFormModal.tsx`: Used `<DateInput>` for Invoice Date (`date`) and Due Date (`due_date`).
    - `frontend/src/pages/Purchases/PurchaseFormModal.tsx`: Used `<DateInput>` for Bill Date (`date`) and Due Date (`due_date`).
  - **Tables & Views Updated:**
    - Updated all raw `.toLocaleDateString()` invocations to `.toLocaleDateString('en-GB')` so dates render as `17/11/2026` across:
      - `InvoicesListPage.tsx`
      - `PurchasesListPage.tsx`
      - `PaymentsListPage.tsx`
      - `SupplierPaymentsListPage.tsx`
      - `InvoiceDetailModal.tsx`

### Feature 14: Natural Product Dimensional Sorting & Title Format `${name}(${size})`
- **Requirement:** User requested: "all the items should be in sequence like if i search abid gold so the seach bar should be like: Abid Gold(8x11), Abid Gold(9x11), Abid Gold(10x14)".
- **Sorting Logic (`frontend/src/utils/productSorting.ts`):**
  - Standard alphanumeric sorting erroneously sorts strings like `"10x14"` before `"8x11"`.
  - Implemented `parseDimension(size: string)` extracting numeric `width` and `length` via regex `^(\d+(?:\.\d+)?)\s*[*xX×]\s*(\d+(?:\.\d+)?)`.
  - `compareProductSizes(a, b)`: Compares parsed numeric width first, then numeric length, falling back to natural alphanumeric comparison.
  - `compareProducts(a, b)`: Groups products by name (`localeCompare`), then secondary sorts by dimensional size.
  - `formatProductTitle(name, size)`: Standardizes label presentation to `${name}(${size})`.
- **System Integration:**
  - **Backend (`backend/src/modules/products/products.repository.ts`):** Added dimensional sorting to `findPOSAvailableProducts` and `findAllProducts` so returned query rows maintain strict numerical sequence.
  - **POS Module (`frontend/src/pages/POS/POSPage.tsx`):**
    - Products in memory are sorted using `compareProducts`.
    - Added an instant live search suggestions dropdown directly underneath the search bar showing matching products with their title in `${name}(${size})` format, stock KG, and price. Clicking or navigating an item adds it directly to the bill.
    - Catalog grid items display `${name}(${size})` format.
  - **Wholesale Sales Invoices (`frontend/src/pages/Invoices/InvoiceFormModal.tsx`):**
    - `groupedProducts` families and variant options are sorted using `compareProducts`.
    - Variant dropdown labels format as `${name}(${size}) (${code})`.
  - **Purchases (`frontend/src/pages/Purchases/PurchaseFormModal.tsx`):**
    - `groupedProducts` families and variant options are sorted using `compareProducts`.
    - Variant dropdown labels format as `${name}(${size}) (${code})`.

### Feature 15: "Add Product" Enablement for Accountant Screen
- **Requirement:** User requested: "theres is no add product button in accountant screen kindly add this in accountant screen".
- **Root Cause:**
  - In `frontend/src/pages/Products/ProductsListPage.tsx`, write permissions were guarded by `const canWrite = isCashier || isOwner || hasPermission('products:write')`.
  - The `ACCOUNTANT` role lacked `isOwner` and `isCashier` checks, and previously lacked `products:write` in the role permissions seed.
  - As a result, when an Accountant opened the Products screen, the "Add Product" button was completely omitted from the UI.
- **Implementation:**
  - **Permissions & Database:** Granted `products:write` to the `Accountant` role in the PostgreSQL database and updated `backend/src/db/seeds/03_role_permissions.ts`.
  - **Product Catalog Screen (`frontend/src/pages/Products/ProductsListPage.tsx`):**
    - Updated `canWrite` to include `isAccountant` (`const canWrite = isCashier || isOwner || isAccountant || hasPermission('products:write')`).
    - Unlocked the **"Add Product"** button and inline edit button for accountants.
  - **Stocks / Inventory Valuation Screen (`frontend/src/pages/Reports/InventoryValuationPage.tsx`):**
    - Added an **"Add Product"** action button in the top toolbar adjacent to "Update Stocks".
    - Connected `ProductFormModal` with TanStack React Query cache invalidation (`inventoryValuation` and `products`), allowing accountants to quickly register new products/variants directly from the Stocks screen without page navigation.

---

## 3. File Modification Matrix

| File Path | Type | Key Changes |
| :--- | :---: | :--- |
| `frontend/src/pages/Customers/CustomerDetailPage.tsx` | Modified | • Rendered phone number badge with `Phone` icon directly next to city name in customer ledger header.<br>• Forwarded `customerCity` and `customerPhone` to `<CustomerLedger>`. |
| `frontend/src/pages/Suppliers/SupplierDetailPage.tsx` | Modified | • Rendered phone number badge with `Phone` icon directly next to city name in supplier ledger header.<br>• Forwarded `supplierCity` and `supplierPhone` to `<SupplierLedger>`. |
| `frontend/src/pages/Customers/CustomerLedger.tsx` | Modified | • Accepted `customerCity` and `customerPhone` props and passed them to `<StatementOfAccount>`. |
| `frontend/src/pages/Suppliers/SupplierLedger.tsx` | Modified | • Accepted `supplierCity` and `supplierPhone` props and passed them to `<StatementOfAccount>`. |
| `frontend/src/components/StatementOfAccount.tsx` | Modified | • Added `entityCity` and `entityPhone` to `StatementOfAccountProps`.<br>• Displayed City and Phone number in the screen header and printable document header at top right. |
| `frontend/src/pages/Customers/CustomerFormModal.tsx` | Modified | • Added Phone Number input field in a 2-column grid next to City.<br>• Added `opening_balance` to edit mode form defaults.<br>• Unlocked Opening Balance input field in customer edit modal with real-time recalculation.<br>• Added query cache invalidation for customer profile and statement. |
| `frontend/src/pages/Suppliers/SupplierFormModal.tsx` | Modified | • Added `phone` to zod schema and default values, rendering Phone Number input in a 2-column grid next to City.<br>• Added `opening_payable` to edit mode form defaults.<br>• Unlocked Opening Balance input field in party/supplier edit modal with real-time recalculation.<br>• Added query cache invalidation for supplier profile and statement. |
| `frontend/src/types/customer.types.ts` | Modified | • Included `opening_balance` in `UpdateCustomerData` interface. |
| `frontend/src/types/supplier.types.ts` | Modified | • Included `opening_payable` and `opening_balance` in `UpdateSupplierData` interface. |
| `backend/src/modules/customers/customers.schemas.ts` | Modified | • Permitted `opening_balance` in `updateCustomerSchema`. |
| `backend/src/modules/suppliers/suppliers.schemas.ts` | Modified | • Permitted `opening_payable` and `opening_balance` in `updateSupplierSchema`. |
| `backend/src/modules/customers/customers.repository.ts` | Modified | • Persisted `opening_balance` updates on customers table and reloaded full balance details. |
| `backend/src/modules/suppliers/suppliers.repository.ts` | Modified | • Synchronized `opening_payable` and `opening_balance` updates on suppliers table and reloaded full balance details. |
| `frontend/src/index.css` | Modified | • Enforced pure white `#ffffff` canvas in `@media print` for both `html.dark` and `body`.<br>• Neutralized dark mode overrides across all print portals to prevent printer ink waste. |
| `frontend/src/components/print/A4SalesInvoice.tsx` | Modified | • Added explicit inline styles for `#ffffff` background, `#000000` text, and `colorScheme: 'light'`.<br>• Dynamically bound copy badge in two-tone title banner to display "Duplicate" or "Original" matching the selected print mode. |
| `frontend/src/components/print/ThermalReceipt80mm.tsx` | Modified | • Added explicit inline styles for `#ffffff` background, `#000000` text, and `colorScheme: 'light'`. |
| `frontend/src/pages/POS/ReceiptPrinter.tsx` | Modified | • Added `#ffffff` background and light color scheme print styles for POS receipts. |
| `frontend/src/utils/printThermal.ts` | Modified | • Enhanced thermal iframe print lifecycle handling with `@page` and light mode styles. |
| `frontend/src/components/Modals/PaymentReceiptModal.tsx` | Modified | • Added dark-mode stripping and `afterprint` restoration for payment receipt printing. |
| `frontend/src/components/StatementOfAccount.tsx` | Modified | • Added dark-mode stripping and `afterprint` restoration for account statement printing. |
| `frontend/src/pages/Reports/IncomeStatementPage.tsx` | Modified | • Added dark-mode stripping and `afterprint` restoration for financial report printing. |
| `frontend/src/pages/Employees/EmployeeDetailPage.tsx` | Modified | • Added dark-mode stripping and `afterprint` restoration for employee salary slip printing. |
| `frontend/src/pages/Invoices/InvoiceFormModal.tsx` | Modified | • Added `printCopyMode` state (`ORIGINAL`, `DUPLICATE`, `BOTH`).<br>• Added 3 print checkboxes.<br>• Replaced "Save Invoice" with "Save and Print Invoice".<br>• Added "Hold Invoice" button and `handleHoldInvoice`.<br>• Added `triggerA4Print` with portal mounting.<br>• Added `initialHeldData` prop support for resume.<br>• Full keyboard navigation (`Enter`, `Tab`, `Arrow Up/Down`).<br>• Global hotkeys: `Ctrl+Enter`, `F9`, `Alt+H`, `Alt+P`, `Alt+Del`.<br>• Cleaned UI: removed visual shortcut bar and button badges per user request.<br>• Added dark-mode print lifecycle cleanup. |
| `frontend/src/pages/Purchases/PurchaseFormModal.tsx` | Modified | • Replaced native Party `<select>` with `<SearchableCombobox>`.<br>• Auto-focus on mount.<br>• Sequential `Enter` chaining (Party -> Product -> Variant -> Bags -> Qty -> Price -> auto-add new row).<br>• Hotkeys: `Ctrl+Enter` / `F9` (Save Purchase), `Alt+A` / `F4` (Add Row), `Alt+Del` (Delete Row).<br>• Cleaned UI: removed visual shortcut bar and button badges per user request. |
| `frontend/src/components/Modals/RecordPaymentModal.tsx` | Modified | • Unified Customer & Supplier payment modal with full keyboard support.<br>• `SearchableCombobox` for entity selection with arrow keys and `Enter`.<br>• Auto-focus `amount` when entity/invoice preselected.<br>• Sequential `Enter` field navigation.<br>• `Alt+C` hotkey for "Clear Full Balance".<br>• `Ctrl+Enter` / `F9` hotkey to submit payment.<br>• Cleaned UI: removed visual shortcut bar and button badges. |
| `frontend/src/pages/Payments/PaymentFormModal.tsx` | Modified | • Sales Customer Payment settlement modal keyboard integration.<br>• Auto-focus, Enter chaining, `Alt+C` balance clear, and `Ctrl+Enter` / `F9` save hotkeys.<br>• Cleaned UI: removed visual shortcut subheaders and badges. |
| `frontend/src/pages/Payments/SupplierPaymentFormModal.tsx` | Modified | • Supplier Bill Payment modal keyboard integration.<br>• Auto-focus, Enter chaining, `Alt+C` balance clear, and `Ctrl+Enter` / `F9` save hotkeys.<br>• Cleaned UI: removed visual shortcut subheaders and badges. |
| `frontend/src/pages/Settings/SettingsPage.tsx` | Modified | • Renamed "POS & Billing Rules" to **"Controls"** (`Keyboard` icon).<br>• Added rich, comprehensive keyboard shortcut reference cards for Sales, Purchases, Payments, and Tips. |
| `frontend/src/components/SearchableCombobox.tsx` | Modified | • Added `id`, `autoFocus`, `onSelectNext`, `onTabNext`, `onKeyDown` props.<br>• Added `highlightedIndex` tracking for keyboard arrow navigation.<br>• Added `scrollToOption` for auto-scrolling dropdown.<br>• Prevented event bubbling for shortcut keys (`Ctrl+Enter`, `Alt+P`, `Alt+C`). |
| `frontend/src/pages/Invoices/HeldInvoicesModal.tsx` | **Created** | • Reusable modal component for viewing, searching, resuming, and deleting held wholesale invoices.<br>• Displays customer name, timestamps, product previews, and total payable.<br>• Full Dark/Light theme support. |
| `frontend/src/pages/Invoices/InvoicesListPage.tsx` | Modified | • Added `posHeldOrders` query with `[ERP]` filtering.<br>• Added `Held Invoices (<count>)` button next to "Create Invoice".<br>• Connected `HeldInvoicesModal` to pass resumed order data directly to `InvoiceFormModal`. |
| `frontend/src/components/InvoiceDetailModal.tsx` | Modified | • Added Original, Duplicate, and Both print copy selection checkboxes next to "Print A4 Invoice".<br>• Removed the redundant "Void Invoice" button and its confirmation modal from invoice details view per user requirement.<br>• Added dark-mode print lifecycle cleanup. |
| `frontend/src/pages/POS/POSPage.tsx` | Modified | • Added 100% keyboard-driven workflow: auto-focus product search on mount, Up/Down arrow selection in search grid, Enter to add and jump to quantity/price, Enter back to search.<br>• Replaced customer select with SearchableCombobox.<br>• Added global hotkeys: Ctrl+Enter / F9 (Complete Sale), Alt+H / F8 (Hold Bill), Alt+B / F7 (Held Bills), Alt+P / F6 (Slip Mode), Alt+U / F3 (Customer), Alt+S / F2 (Search), Alt+A / F10 (Amount Paid), Alt+M (Payment Method), Alt+N (New Customer), Alt+C (Clear Cart).<br>• Filtered out wholesale ERP held orders (`!o.reference_note?.startsWith('[ERP]')`) so retail POS only sees retail walk-in held bills. |
| `backend/src/modules/invoices/invoices.repository.ts` | Modified | • Fixed `voidInvoice` status update to conditionally check columns (`void_reason`, `voided_at`, `voided_by_user_id`) using Knex schema checks, preventing runtime crashes. |
| `frontend/src/components/DateInput.tsx` | **Created** | • Dedicated cross-browser date input component enforcing strict `dd/mm/yyyy` display, direct text entry, and calendar picker popup. |
| `frontend/src/utils/productSorting.ts` | **Created** | • Dimensional sorting utilities (`parseDimension`, `compareProductSizes`, `compareProducts`, `formatProductTitle`). Sorts sizes numerically (e.g. `8x11` < `9x11` < `10x14`). |
| `backend/src/modules/products/products.repository.ts` | Modified | • Integrated dimensional parsing and sorting into `findPOSAvailableProducts` and `findAllProducts` queries. |
| `frontend/src/pages/POS/POSPage.tsx` | Modified | • Added 100% keyboard-driven workflow: auto-focus product search on mount, Up/Down arrow selection in search grid, Enter to add and jump to quantity/price, Enter back to search.<br>• Replaced customer select with SearchableCombobox.<br>• Added global hotkeys: Ctrl+Enter / F9 (Complete Sale), Alt+H / F8 (Hold Bill), Alt+B / F7 (Held Bills), Alt+P / F6 (Slip Mode), Alt+U / F3 (Customer), Alt+S / F2 (Search), Alt+A / F10 (Amount Paid), Alt+M (Payment Method), Alt+N (New Customer), Alt+C (Clear Cart).<br>• Filtered out wholesale ERP held orders (`!o.reference_note?.startsWith('[ERP]')`) so retail POS only sees retail walk-in held bills.<br>• Added live search suggestion dropdown under search bar formatted as `${name}(${size})` in numerical sequence.<br>• Sorted POS product catalog grid dimensionally. |
| `frontend/src/pages/Invoices/InvoiceFormModal.tsx` | Modified | • Added `printCopyMode` state (`ORIGINAL`, `DUPLICATE`, `BOTH`).<br>• Added 3 print checkboxes.<br>• Replaced "Save Invoice" with "Save and Print Invoice".<br>• Added "Hold Invoice" button and `handleHoldInvoice`.<br>• Added `triggerA4Print` with portal mounting.<br>• Added `initialHeldData` prop support for resume.<br>• Full keyboard navigation (`Enter`, `Tab`, `Arrow Up/Down`).<br>• Global hotkeys: `Ctrl+Enter`, `F9`, `Alt+H`, `Alt+P`, `Alt+Del`.<br>• Cleaned UI: removed visual shortcut bar and button badges per user request.<br>• Added dark-mode print lifecycle cleanup.<br>• Replaced date inputs with `<DateInput>` (`dd/mm/yyyy`).<br>• Dimensionally sorted grouped products and variant options with `${name}(${size})` formatting. |
| `frontend/src/pages/Purchases/PurchaseFormModal.tsx` | Modified | • Replaced native Party `<select>` with `<SearchableCombobox>`.<br>• Auto-focus on mount.<br>• Sequential `Enter` chaining (Party -> Product -> Variant -> Bags -> Qty -> Price -> auto-add new row).<br>• Hotkeys: `Ctrl+Enter` / `F9` (Save Purchase), `Alt+A` / `F4` (Add Row), `Alt+Del` (Delete Row).<br>• Cleaned UI: removed visual shortcut bar and button badges per user request.<br>• Replaced date inputs with `<DateInput>` (`dd/mm/yyyy`).<br>• Dimensionally sorted grouped products and variant options with `${name}(${size})` formatting. |
| `frontend/src/pages/Suppliers/SupplierFormModal.tsx` | Modified | • Added `phone` to zod schema and default values, rendering Phone Number input in a 2-column grid next to City.<br>• Added `opening_payable` to edit mode form defaults.<br>• Unlocked Opening Balance input field in party/supplier edit modal with real-time recalculation.<br>• Removed datalist dropdown from City input for clean text entry.<br>• Added query cache invalidation for supplier profile and statement. |
| `frontend/src/pages/Invoices/InvoicesListPage.tsx` | Modified | • Added `posHeldOrders` query with `[ERP]` filtering.<br>• Added `Held Invoices (<count>)` button next to "Create Invoice".<br>• Connected `HeldInvoicesModal` to pass resumed order data directly to `InvoiceFormModal`.<br>• Converted all date displays to `.toLocaleDateString('en-GB')` (`dd/mm/yyyy`). |
| `frontend/src/pages/Purchases/PurchasesListPage.tsx` | Modified | • Converted all date displays to `.toLocaleDateString('en-GB')` (`dd/mm/yyyy`). |
| `frontend/src/pages/Payments/PaymentsListPage.tsx` | Modified | • Converted all date displays to `.toLocaleDateString('en-GB')` (`dd/mm/yyyy`). |
| `frontend/src/pages/Payments/SupplierPaymentsListPage.tsx` | Modified | • Converted all date displays to `.toLocaleDateString('en-GB')` (`dd/mm/yyyy`). |
| `frontend/src/components/InvoiceDetailModal.tsx` | Modified | • Added Original, Duplicate, and Both print copy selection checkboxes next to "Print A4 Invoice".<br>• Removed the redundant "Void Invoice" button and its confirmation modal from invoice details view per user requirement.<br>• Added dark-mode print lifecycle cleanup.<br>• Converted date display to `.toLocaleDateString('en-GB')` (`dd/mm/yyyy`). |
| `frontend/src/pages/Products/ProductsListPage.tsx` | Modified | • Added `isAccountant` to `canWrite` permission evaluation.<br>• Rendered the "Add Product" button and inline edit buttons for Accountant role. |
| `frontend/src/pages/Reports/InventoryValuationPage.tsx` | Modified | • Added "Add Product" button to the Stocks toolbar header.<br>• Embedded `ProductFormModal` with query cache invalidation for instant product creation from Stocks. |
| `backend/src/db/seeds/03_role_permissions.ts` | Modified | • Added `products:write` to `Accountant` role permission assignments. |
| `frontend/src/components/DateInput.tsx` | **Created** | • Dedicated cross-browser date input component enforcing strict `dd/mm/yyyy` display, direct text entry, and calendar picker popup. |
| `frontend/src/utils/productSorting.ts` | **Created** | • Dimensional sorting utilities (`parseDimension`, `compareProductSizes`, `compareProducts`, `formatProductTitle`). Sorts sizes numerically (e.g. `8x11` < `9x11` < `10x14`). |
| `backend/src/modules/products/products.repository.ts` | Modified | • Integrated dimensional parsing and sorting into `findPOSAvailableProducts` and `findAllProducts` queries. |
| `frontend/src/pages/POS/POSPage.tsx` | Modified | • Added 100% keyboard-driven workflow: auto-focus product search on mount, Up/Down arrow selection in search grid, Enter to add and jump to quantity/price, Enter back to search.<br>• Replaced customer select with SearchableCombobox.<br>• Added global hotkeys: Ctrl+Enter / F9 (Complete Sale), Alt+H / F8 (Hold Bill), Alt+B / F7 (Held Bills), Alt+P / F6 (Slip Mode), Alt+U / F3 (Customer), Alt+S / F2 (Search), Alt+A / F10 (Amount Paid), Alt+M (Payment Method), Alt+N (New Customer), Alt+C (Clear Cart).<br>• Filtered out wholesale ERP held orders (`!o.reference_note?.startsWith('[ERP]')`) so retail POS only sees retail walk-in held bills.<br>• Added live search suggestion dropdown under search bar formatted as `${name}(${size})` in numerical sequence.<br>• Sorted POS product catalog grid dimensionally. |
| `frontend/src/pages/Invoices/InvoiceFormModal.tsx` | Modified | • Added `printCopyMode` state (`ORIGINAL`, `DUPLICATE`, `BOTH`).<br>• Added 3 print checkboxes.<br>• Replaced "Save Invoice" with "Save and Print Invoice".<br>• Added "Hold Invoice" button and `handleHoldInvoice`.<br>• Added `triggerA4Print` with portal mounting.<br>• Added `initialHeldData` prop support for resume.<br>• Full keyboard navigation (`Enter`, `Tab`, `Arrow Up/Down`).<br>• Global hotkeys: `Ctrl+Enter`, `F9`, `Alt+H`, `Alt+P`, `Alt+Del`.<br>• Cleaned UI: removed visual shortcut bar and button badges per user request.<br>• Added dark-mode print lifecycle cleanup.<br>• Replaced date inputs with `<DateInput>` (`dd/mm/yyyy`).<br>• Dimensionally sorted grouped products and variant options with `${name}(${size})` formatting. |
| `frontend/src/pages/Purchases/PurchaseFormModal.tsx` | Modified | • Replaced native Party `<select>` with `<SearchableCombobox>`.<br>• Auto-focus on mount.<br>• Sequential `Enter` chaining (Party -> Product -> Variant -> Bags -> Qty -> Price -> auto-add new row).<br>• Hotkeys: `Ctrl+Enter` / `F9` (Save Purchase), `Alt+A` / `F4` (Add Row), `Alt+Del` (Delete Row).<br>• Cleaned UI: removed visual shortcut bar and button badges per user request.<br>• Replaced date inputs with `<DateInput>` (`dd/mm/yyyy`).<br>• Dimensionally sorted grouped products and variant options with `${name}(${size})` formatting. |
| `frontend/src/pages/Suppliers/SupplierFormModal.tsx` | Modified | • Added `phone` to zod schema and default values, rendering Phone Number input in a 2-column grid next to City.<br>• Added `opening_payable` to edit mode form defaults.<br>• Unlocked Opening Balance input field in party/supplier edit modal with real-time recalculation.<br>• Removed datalist dropdown from City input for clean text entry.<br>• Added query cache invalidation for supplier profile and statement. |
| `frontend/src/pages/Invoices/InvoicesListPage.tsx` | Modified | • Added `posHeldOrders` query with `[ERP]` filtering.<br>• Added `Held Invoices (<count>)` button next to "Create Invoice".<br>• Connected `HeldInvoicesModal` to pass resumed order data directly to `InvoiceFormModal`.<br>• Converted all date displays to `.toLocaleDateString('en-GB')` (`dd/mm/yyyy`). |
| `frontend/src/pages/Purchases/PurchasesListPage.tsx` | Modified | • Converted all date displays to `.toLocaleDateString('en-GB')` (`dd/mm/yyyy`). |
| `frontend/src/pages/Payments/PaymentsListPage.tsx` | Modified | • Converted all date displays to `.toLocaleDateString('en-GB')` (`dd/mm/yyyy`). |
| `frontend/src/pages/Payments/SupplierPaymentsListPage.tsx` | Modified | • Converted all date displays to `.toLocaleDateString('en-GB')` (`dd/mm/yyyy`). |
| `frontend/src/components/InvoiceDetailModal.tsx` | Modified | • Added Original, Duplicate, and Both print copy selection checkboxes next to "Print A4 Invoice".<br>• Removed the redundant "Void Invoice" button and its confirmation modal from invoice details view per user requirement.<br>• Added dark-mode print lifecycle cleanup.<br>• Converted date display to `.toLocaleDateString('en-GB')` (`dd/mm/yyyy`). |
| `frontend/src/pages/Products/ProductsListPage.tsx` | Modified | • Added `isAccountant` to `canWrite` permission evaluation.<br>• Rendered the "Add Product" button and inline edit buttons for Accountant role. |
| `frontend/src/pages/Reports/InventoryValuationPage.tsx` | Modified | • Added "Add Product" button to the Stocks toolbar header.<br>• Embedded `ProductFormModal` with query cache invalidation for instant product creation from Stocks. |
| `backend/src/db/seeds/03_role_permissions.ts` | Modified | • Added `products:write` to `Accountant` role permission assignments. |
| `frontend/src/types/qz-tray.d.ts` | **Created** | • Full TypeScript declarations and interface bindings for `qz-tray` (websocket, configs, printers, print). |
| `frontend/src/utils/qzPrint.ts` | **Created** | • Centralized QZ Tray printing utility (`connectQzLocal`, `printPosThermalSlip`, `printErpA4Invoice`, `generateA4InvoiceHtml`, `inlineImagesToBase64`, `extractCurrentStyles`). |
| `frontend/src/utils/printThermal.ts` | Modified | • Extracted `generateThermalReceiptHtml` with inlined base64 logo and Nastaliq font styles.<br>• Replaced iframe and `window.print()` with direct `printPosThermalSlip(html)`. |
| `frontend/src/components/InvoiceDetailModal.tsx` | Modified | • Replaced browser `window.print()` with direct `printErpA4Invoice` dispatch.<br>• Replaced POS popup with direct `printThermalReceipt` dispatch via QZ Tray.<br>• Added loading indicators and toast error handling. |
| `frontend/src/pages/Invoices/InvoiceFormModal.tsx` | Modified | • Converted `triggerA4Print` to silently dispatch via `printErpA4Invoice` on persistence.<br>• Removed DOM print portal and body classes. |
| `frontend/src/pages/POS/POSPage.tsx` | Modified | • Updated sale completion and reprint triggers to handle silent QZ Tray thermal prints with toast feedback. |
| `frontend/.env` & `frontend/.env.example` | Modified | • Added `VITE_POS_PRINTER_NAME=POS_THERMAL` and `VITE_A4_PRINTER_NAME=ERP_A4_HP`. |

---

## 4. Verification & Quality Assurance

- **TypeScript Compilation:**
  - `npm run build --prefix frontend` executed with **exit code 0** (zero type errors).
  - `npm run build --prefix backend` executed with **exit code 0** (zero compilation errors).
- **Runtime Integrity:**
  - Verified static asset bundle served from production build without hydration or render errors.
- **Silent Printing:**
  - QZ Tray pixel HTML printing tested for both POS Thermal (80mm) and ERP A4 (210mm x 297mm).
  - Zero browser print preview dialogs triggered. Full bilingual styling, borders, and base64 logos preserved.
