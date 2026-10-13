import { useMemo } from 'react';
import { SearchableCombobox, ComboboxOption } from './SearchableCombobox';
import { MapPin, User, FileText, RotateCcw, Filter, CheckCircle2 } from 'lucide-react';

export interface CascadingFilterBarProps {
  // State from useCascadingFilters
  selectedCity: string | null;
  selectedName: string | null;
  selectedInvoice?: string | null;
  selectedStatus?: string;

  // State setters from useCascadingFilters
  onCityChange: (city: string | null) => void;
  onNameChange: (name: string | null) => void;
  onInvoiceChange?: (invoice: string | null) => void;
  onStatusChange?: (status: string) => void;

  // Memoized option arrays
  availableCities: (string | ComboboxOption)[];
  availableNames: (string | ComboboxOption)[];
  availableInvoices?: (string | ComboboxOption)[];
  statusOptions?: string[];

  // Optional reset handler
  onReset?: () => void;

  // Configuration
  showInvoice?: boolean;
  showStatus?: boolean;
  cityLabel?: string;
  nameLabel?: string;
  invoiceLabel?: string;
  statusLabel?: string;
  cityPlaceholder?: string;
  namePlaceholder?: string;
  invoicePlaceholder?: string;
  className?: string;
}

function normalizeOptions(items?: (string | ComboboxOption)[]): ComboboxOption[] {
  if (!items || !Array.isArray(items)) return [];
  return items.map((item) => {
    if (typeof item === 'string') {
      return { value: item, label: item };
    }
    return item;
  });
}

/**
 * Phase 2: Reusable <CascadingFilterBar/> component
 * Renders horizontally aligned Searchable Comboboxes & Filters:
 * 1. City: Unrestricted
 * 2. Name: Fed by availableNames, disabled if empty due to upstream filtering
 * 3. Invoice #: Fed by availableInvoices, disabled if no name selected (conditionally rendered)
 * 4. Status: Dropdown filter for Unpaid, Partially Paid, Fully Paid, etc. (conditionally rendered)
 */
export function CascadingFilterBar({
  selectedCity,
  selectedName,
  selectedInvoice = null,
  selectedStatus = 'All',
  onCityChange,
  onNameChange,
  onInvoiceChange,
  onStatusChange,
  availableCities,
  availableNames,
  availableInvoices = [],
  statusOptions = ['All', 'Unpaid', 'Partially Paid', 'Fully Paid', 'Overpaid', 'Wallet Deposit', 'Dead'],
  onReset,
  showInvoice = false,
  showStatus = false,
  cityLabel = 'City',
  nameLabel = 'Entity / Name',
  invoiceLabel = 'Invoice #',
  statusLabel = 'Filter by Status',
  cityPlaceholder = 'Filter by city…',
  namePlaceholder = 'Filter by name…',
  invoicePlaceholder = 'Filter by invoice #…',
  className = '',
}: CascadingFilterBarProps) {
  const cityOptions = useMemo(() => normalizeOptions(availableCities), [availableCities]);
  const nameOptions = useMemo(() => normalizeOptions(availableNames), [availableNames]);
  const invoiceOptions = useMemo(() => normalizeOptions(availableInvoices), [availableInvoices]);

  const isNameDisabled = nameOptions.length === 0;
  const isInvoiceDisabled = !selectedName || invoiceOptions.length === 0;

  const hasStatusFilter = Boolean(selectedStatus && selectedStatus !== 'All');
  const hasActiveFilters = Boolean(selectedCity || selectedName || selectedInvoice || hasStatusFilter);
  const activeCount = [
    selectedCity,
    selectedName,
    selectedInvoice,
    hasStatusFilter ? selectedStatus : null,
  ].filter(Boolean).length;

  const handleReset = () => {
    if (onStatusChange) onStatusChange('All');
    if (onReset) onReset();
  };

  const gridColsClass =
    showInvoice && showStatus
      ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4'
      : showInvoice || showStatus
      ? 'grid-cols-1 sm:grid-cols-2 md:grid-cols-3'
      : 'grid-cols-1 sm:grid-cols-2';

  return (
    <div className={`w-full rounded-2xl border border-slate-200/90 bg-white p-4 shadow-sm transition-all ${className}`}>
      {/* Top Header Bar with Filter Indicator and Reset */}
      <div className="flex flex-wrap items-center justify-between gap-2 pb-3 mb-3 border-b border-slate-100">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
            <Filter className="h-4 w-4" />
          </div>
          <span className="text-xs font-bold uppercase tracking-wider text-slate-700">
            Cascading Filters
          </span>
          {hasActiveFilters && (
            <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-2 py-0.5 text-[11px] font-semibold text-blue-800">
              <CheckCircle2 className="h-3 w-3 text-blue-600" />
              {activeCount} active
            </span>
          )}
        </div>

        {hasActiveFilters && onReset && (
          <button
            type="button"
            onClick={handleReset}
            className="inline-flex items-center gap-1 text-xs font-semibold text-slate-500 hover:text-red-600 transition cursor-pointer"
            title="Clear all filters"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Reset Filters
          </button>
        )}
      </div>

      {/* Horizontal Combobox Grid */}
      <div className={`grid gap-3 ${gridColsClass}`}>
        {/* Combobox 1: City (Unrestricted) */}
        <div className="flex flex-col gap-1 min-w-0">
          <label className="flex items-center gap-1.5 text-xs font-medium text-slate-600">
            <MapPin className="h-3.5 w-3.5 text-slate-400" />
            <span>{cityLabel}</span>
            {cityOptions.length > 0 && (
              <span className="text-[10px] text-slate-400 font-mono">({cityOptions.length})</span>
            )}
          </label>
          <SearchableCombobox
            value={selectedCity || ''}
            onChange={(val) => onCityChange(val || null)}
            options={cityOptions}
            placeholder={cityPlaceholder}
            disabled={false}
            className="w-full"
          />
        </div>

        {/* Combobox 2: Name (Fed by availableNames, disabled if empty) */}
        <div className="flex flex-col gap-1 min-w-0">
          <label className="flex items-center gap-1.5 text-xs font-medium text-slate-600">
            <User className="h-3.5 w-3.5 text-slate-400" />
            <span>{nameLabel}</span>
            {nameOptions.length > 0 && (
              <span className="text-[10px] text-slate-400 font-mono">({nameOptions.length})</span>
            )}
          </label>
          <SearchableCombobox
            value={selectedName || ''}
            onChange={(val) => onNameChange(val || null)}
            options={nameOptions}
            placeholder={
              isNameDisabled
                ? selectedCity
                  ? 'No entities in this city'
                  : 'No names available'
                : namePlaceholder
            }
            disabled={isNameDisabled}
            className="w-full"
          />
        </div>

        {/* Combobox 3: Invoice # (Conditionally rendered, disabled if no name selected) */}
        {showInvoice && (
          <div className="flex flex-col gap-1 min-w-0">
            <label className="flex items-center gap-1.5 text-xs font-medium text-slate-600">
              <FileText className="h-3.5 w-3.5 text-slate-400" />
              <span>{invoiceLabel}</span>
              {selectedName && invoiceOptions.length > 0 && (
                <span className="text-[10px] text-slate-400 font-mono">({invoiceOptions.length})</span>
              )}
            </label>
            <SearchableCombobox
              value={selectedInvoice || ''}
              onChange={(val) => onInvoiceChange && onInvoiceChange(val || null)}
              options={invoiceOptions}
              placeholder={
                !selectedName
                  ? 'Select entity first…'
                  : invoiceOptions.length === 0
                  ? 'No invoices for entity'
                  : invoicePlaceholder
              }
              disabled={isInvoiceDisabled}
              className="w-full"
            />
          </div>
        )}

        {/* Combobox 4 / Status Filter (Conditionally rendered) */}
        {showStatus && (
          <div className="flex flex-col gap-1 min-w-0">
            <label className="flex items-center gap-1.5 text-xs font-medium text-slate-600">
              <CheckCircle2 className="h-3.5 w-3.5 text-slate-400" />
              <span>{statusLabel}</span>
              {hasStatusFilter && (
                <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-blue-100 text-blue-700">
                  {selectedStatus}
                </span>
              )}
            </label>
            <div className="relative">
              <select
                id="status-filter-select"
                value={selectedStatus || 'All'}
                onChange={(e) => onStatusChange && onStatusChange(e.target.value)}
                className="w-full h-10 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-800 shadow-2xs hover:border-slate-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition outline-none cursor-pointer"
              >
                {statusOptions.map((opt) => (
                  <option key={opt} value={opt} className="text-slate-800">
                    {opt === 'All' ? 'Filter by Status: All' : opt}
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default CascadingFilterBar;
