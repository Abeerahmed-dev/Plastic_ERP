import { useState, useMemo, useCallback } from 'react';

export interface CascadingFilterRow {
  id?: string;
  customer_id?: string;
  supplier_id?: string;
  city?: string | null;
  customer_city?: string | null;
  supplier_city?: string | null;
  name?: string | null;
  customer_name?: string | null;
  supplier_name?: string | null;
  invoice_number?: string | null;
  purchase_invoice_number?: string | null;
  [key: string]: any;
}

export interface UseCascadingFiltersOptions {
  /** Optional secondary invoices dataset if invoices are stored separately from entity dataset */
  invoices?: CascadingFilterRow[];
  /** Custom extractor for city */
  getCity?: (row: CascadingFilterRow) => string | null | undefined;
  /** Custom extractor for entity name */
  getName?: (row: CascadingFilterRow) => string | null | undefined;
  /** Custom extractor for entity ID */
  getEntityId?: (row: CascadingFilterRow) => string | null | undefined;
  /** Custom extractor for invoice number */
  getInvoiceNumber?: (row: CascadingFilterRow) => string | null | undefined;
}

export interface ComboboxOption {
  value: string;
  label: string;
  subLabel?: string;
  badge?: string;
}

export interface UseCascadingFiltersReturn<T = any> {
  // State
  selectedCity: string | null;
  selectedName: string | null;
  selectedInvoice: string | null;

  // Setters with strict auto-clear logic
  setSelectedCity: (city: string | null) => void;
  setSelectedName: (name: string | null) => void;
  setSelectedInvoice: (invoice: string | null) => void;
  resetFilters: () => void;

  // Memoized Derived Arrays
  availableCities: string[];
  availableNames: string[];
  availableInvoices: string[];

  // Combobox-ready Options
  cityOptions: ComboboxOption[];
  nameOptions: ComboboxOption[];
  invoiceOptions: ComboboxOption[];

  // Multi-condition Filtered Table Rows
  filteredTableRows: T[];
  filteredData: T[];

  // Metadata
  hasActiveFilters: boolean;
  activeFilterCount: number;
}

/**
 * Normalization helpers to handle inconsistent field names across entity tables,
 * sales invoices, customer payments, and supplier payments.
 */
function defaultGetCity(row: CascadingFilterRow): string {
  const c = row?.city ?? row?.customer_city ?? row?.supplier_city;
  return typeof c === 'string' ? c.trim() : '';
}

function defaultGetName(row: CascadingFilterRow): string {
  const n = row?.name ?? row?.customer_name ?? row?.supplier_name;
  return typeof n === 'string' ? n.trim() : '';
}

function defaultGetEntityId(row: CascadingFilterRow): string {
  const id = row?.customer_id ?? row?.supplier_id ?? row?.id;
  return typeof id === 'string' ? id.trim() : id ? String(id) : '';
}

function defaultGetInvoiceNumber(row: CascadingFilterRow): string {
  const inv = row?.invoice_number ?? row?.purchase_invoice_number;
  return typeof inv === 'string' ? inv.trim() : '';
}

/**
 * Phase 1: Custom hook useCascadingFilters(dataset)
 * Heavily memoized cascading filter engine with strict auto-clear cascading logic.
 */
export function useCascadingFilters<T extends CascadingFilterRow = CascadingFilterRow>(
  dataset: T[],
  options?: UseCascadingFiltersOptions
): UseCascadingFiltersReturn<T> {
  const [selectedCity, setSelectedCityState] = useState<string | null>(null);
  const [selectedName, setSelectedNameState] = useState<string | null>(null);
  const [selectedInvoice, setSelectedInvoiceState] = useState<string | null>(null);

  const getCity = options?.getCity ?? defaultGetCity;
  const getName = options?.getName ?? defaultGetName;
  const getEntityId = options?.getEntityId ?? defaultGetEntityId;
  const getInvoiceNumber = options?.getInvoiceNumber ?? defaultGetInvoiceNumber;

  // Auto-Clear Logic:
  // If the user changes selectedCity, forcefully reset selectedName and selectedInvoice to null.
  const setSelectedCity = useCallback((city: string | null) => {
    const nextCity = city && city.trim().length > 0 ? city.trim() : null;
    setSelectedCityState(nextCity);
    setSelectedNameState(null);
    setSelectedInvoiceState(null);
  }, []);

  // If the user changes selectedName, forcefully reset selectedInvoice to null.
  const setSelectedName = useCallback((name: string | null) => {
    const nextName = name && name.trim().length > 0 ? name.trim() : null;
    setSelectedNameState(nextName);
    setSelectedInvoiceState(null);
  }, []);

  const setSelectedInvoice = useCallback((invoice: string | null) => {
    const nextInvoice = invoice && invoice.trim().length > 0 ? invoice.trim() : null;
    setSelectedInvoiceState(nextInvoice);
  }, []);

  const resetFilters = useCallback(() => {
    setSelectedCityState(null);
    setSelectedNameState(null);
    setSelectedInvoiceState(null);
  }, []);

  // 1. availableCities: Extract a unique array of all cities from the raw dataset.
  const availableCities = useMemo(() => {
    if (!Array.isArray(dataset) || dataset.length === 0) return [];
    const citySet = new Set<string>();

    dataset.forEach((row) => {
      const city = getCity(row);
      if (city) {
        citySet.add(city);
      }
    });

    return Array.from(citySet).sort((a, b) => a.localeCompare(b));
  }, [dataset, getCity]);

  // 2. availableNames:
  // If selectedCity is active, filter the dataset to only include entities from that city.
  // Extract their names. Otherwise, list all names.
  const availableNames = useMemo(() => {
    if (!Array.isArray(dataset) || dataset.length === 0) return [];
    const nameSet = new Set<string>();

    dataset.forEach((row) => {
      const rowCity = getCity(row);
      // If city is active, match case-insensitively
      const matchesCity = selectedCity
        ? rowCity.toLowerCase() === selectedCity.toLowerCase()
        : true;

      if (matchesCity) {
        const name = getName(row);
        if (name) {
          nameSet.add(name);
        }
      }
    });

    return Array.from(nameSet).sort((a, b) => a.localeCompare(b));
  }, [dataset, selectedCity, getCity, getName]);

  // 3. availableInvoices:
  // If selectedName is active, filter the invoices array to only include invoice_numbers
  // linked to that specific entity ID (or entity name).
  const availableInvoices = useMemo(() => {
    if (!selectedName) return [];

    const effectiveInvoiceSource = (options?.invoices && options.invoices.length > 0)
      ? options.invoices
      : dataset;

    if (!Array.isArray(effectiveInvoiceSource) || effectiveInvoiceSource.length === 0) return [];

    // Find all entity IDs matching selectedName
    const matchingEntityIds = new Set<string>();
    dataset.forEach((row) => {
      const name = getName(row);
      if (name && name.toLowerCase() === selectedName.toLowerCase()) {
        const entId = getEntityId(row);
        if (entId) {
          matchingEntityIds.add(entId);
        }
      }
    });

    const invoiceSet = new Set<string>();

    effectiveInvoiceSource.forEach((row) => {
      const rowName = getName(row);
      const rowEntityId = getEntityId(row);

      const matchesEntity =
        (matchingEntityIds.size > 0 && rowEntityId && matchingEntityIds.has(rowEntityId)) ||
        (rowName && rowName.toLowerCase() === selectedName.toLowerCase());

      if (matchesEntity) {
        const invNum = getInvoiceNumber(row);
        // Exclude dummy account placeholders
        if (invNum && invNum !== 'Account Payment' && invNum !== 'Cash Refund' && invNum !== 'Direct Payment') {
          invoiceSet.add(invNum);
        }
      }
    });

    return Array.from(invoiceSet).sort((a, b) => a.localeCompare(b));
  }, [dataset, selectedName, options?.invoices, getEntityId, getInvoiceNumber, getName]);

  // Format into ComboboxOption objects for SearchableCombobox
  const cityOptions = useMemo<ComboboxOption[]>(() => {
    return availableCities.map((city) => ({
      value: city,
      label: city,
    }));
  }, [availableCities]);

  const nameOptions = useMemo<ComboboxOption[]>(() => {
    return availableNames.map((name) => ({
      value: name,
      label: name,
    }));
  }, [availableNames]);

  const invoiceOptions = useMemo<ComboboxOption[]>(() => {
    return availableInvoices.map((inv) => ({
      value: inv,
      label: inv,
    }));
  }, [availableInvoices]);

  // Phase 3: Strict Multi-Condition Multi-Property Table Filter
  const filteredTableRows = useMemo(() => {
    if (!Array.isArray(dataset)) return [];

    return dataset.filter((row) => {
      const rowCity = getCity(row);
      const rowName = getName(row);
      const rowInvoice = getInvoiceNumber(row);

      const matchesCity = selectedCity
        ? rowCity.toLowerCase() === selectedCity.toLowerCase() || (row.city && String(row.city).toLowerCase() === selectedCity.toLowerCase())
        : true;

      const matchesName = selectedName
        ? rowName.toLowerCase() === selectedName.toLowerCase() || (row.name && String(row.name).toLowerCase() === selectedName.toLowerCase())
        : true;

      const matchesInvoice = selectedInvoice
        ? rowInvoice.toLowerCase() === selectedInvoice.toLowerCase() || (row.invoice_number && String(row.invoice_number).toLowerCase() === selectedInvoice.toLowerCase())
        : true;

      return matchesCity && matchesName && matchesInvoice;
    });
  }, [dataset, selectedCity, selectedName, selectedInvoice, getCity, getName, getInvoiceNumber]);

  const hasActiveFilters = Boolean(selectedCity || selectedName || selectedInvoice);
  const activeFilterCount = [selectedCity, selectedName, selectedInvoice].filter(Boolean).length;

  return {
    selectedCity,
    selectedName,
    selectedInvoice,
    setSelectedCity,
    setSelectedName,
    setSelectedInvoice,
    resetFilters,
    availableCities,
    availableNames,
    availableInvoices,
    cityOptions,
    nameOptions,
    invoiceOptions,
    filteredTableRows,
    filteredData: filteredTableRows,
    hasActiveFilters,
    activeFilterCount,
  };
}
