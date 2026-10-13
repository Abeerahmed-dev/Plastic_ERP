import { create } from 'zustand';
import api from '../services/api';

export interface BatchItem {
  batch_id: string;
  batch_number?: string;
  date: string;
  buy_price_per_kg: number;
  original_qty: number;
  remaining_qty: number;
  total_kg_sold?: number;
  batch_revenue?: number;
  batch_cogs?: number;
  batch_gross_profit?: number;
  selected_unit?: string;
  actual_weight_per_unit?: number;
}

export interface InventoryLedgerItem {
  product_id: string;
  product_name: string;
  product_code: string;
  category: string;
  total_kg: number;
  avg_cost: number;
  total_asset_value: number;
  total_exact_boras?: number;
  secondary_units_summary?: string;
  all_time_kg_purchased?: number;
  all_time_kg_sold?: number;
  all_time_profit?: number;
  batches: BatchItem[];
}

export interface LiquidityLedgerData {
  cash_drawer: number;
  bank_balances: number;
  post_dated_cheques: number;
  issued_post_dated_cheques?: number;
  market_receivables: number;
  total_inventory_value: number;
  total_accounts_payable: number;
  customer_advances_liability?: number;
  supplier_advances_asset?: number;
  total_liquid: number;
  net_business_capital: number;
  total_market_capital: number;
}

export interface ProfitMatrixData {
  product_id?: string | null;
  total_sale_value: number;
  total_cogs: number;
  gross_margin: number;
  gross_margin_percent: number;
  cash_received: number;
  pending_debt: number;
  realized_cash_profit: number;
  unrealized_trapped_profit: number;
}

export interface SalesMarginData {
  time_filter: string;
  product_id?: string | null;
  total_sales_value: number;
  total_cogs: number;
  net_margin: number;
  gross_margin_percent: number;
  period_cash_received: number;
  period_udhaar_generated: number;
}

interface ReportState {
  inventoryLedger: InventoryLedgerItem[];
  liquidityLedger: LiquidityLedgerData | null;
  profitMatrix: ProfitMatrixData | null;
  salesMargin: SalesMarginData | null;
  overallProfit: ProfitMatrixData | null;
  productProfit: ProfitMatrixData | null;
  selectedProductId: string;
  timeFilter: string;
  isLoadingInventory: boolean;
  isLoadingLiquidity: boolean;
  isLoadingProfit: boolean;
  error: string | null;
  fetchInventoryLedger: () => Promise<void>;
  fetchLiquidityLedger: () => Promise<void>;
  fetchProfitMatrix: (productId?: string, timeFilter?: string) => Promise<void>;
  fetchSalesMarginReport: (productId?: string, timeFilter?: string) => Promise<void>;
  fetchProductProfitMatrix: (productId?: string) => Promise<void>;
  setSelectedProductId: (productId: string) => void;
  setTimeFilter: (timeFilter: string) => void;
  fetchAllReports: () => Promise<void>;
}

export const useReportStore = create<ReportState>((set, get) => ({
  inventoryLedger: [],
  liquidityLedger: null,
  profitMatrix: null,
  salesMargin: null,
  overallProfit: null,
  productProfit: null,
  selectedProductId: '',
  timeFilter: 'all_time',
  isLoadingInventory: false,
  isLoadingLiquidity: false,
  isLoadingProfit: false,
  error: null,

  fetchInventoryLedger: async () => {
    set({ isLoadingInventory: true, error: null });
    try {
      const response = await api.get('/reports/inventory');
      set({ inventoryLedger: response.data.data, isLoadingInventory: false });
    } catch (err: any) {
      set({ error: err.response?.data?.error || err.message || 'Failed to fetch inventory ledger', isLoadingInventory: false });
    }
  },

  fetchLiquidityLedger: async () => {
    set({ isLoadingLiquidity: true, error: null });
    try {
      const response = await api.get('/reports/liquidity');
      set({ liquidityLedger: response.data.data, isLoadingLiquidity: false });
    } catch (err: any) {
      set({ error: err.response?.data?.error || err.message || 'Failed to fetch liquidity ledger', isLoadingLiquidity: false });
    }
  },

  fetchProfitMatrix: async (productId?: string, timeFilter?: string) => {
    return get().fetchSalesMarginReport(productId, timeFilter);
  },

  fetchSalesMarginReport: async (productId?: string, timeFilter?: string) => {
    set({ isLoadingProfit: true, error: null });
    try {
      const pId = productId !== undefined ? productId : get().selectedProductId;
      const tFilter = timeFilter !== undefined ? timeFilter : get().timeFilter;

      const params = new URLSearchParams();
      if (pId) params.append('productId', pId);
      if (tFilter) params.append('timeFilter', tFilter);

      const response = await api.get(`/reports/sales-margin?${params.toString()}`);
      const data = response.data.data;
      set({ salesMargin: data, profitMatrix: data, isLoadingProfit: false });
    } catch (err: any) {
      set({ error: err.response?.data?.error || err.message || 'Failed to fetch sales margin report', isLoadingProfit: false });
    }
  },

  fetchProductProfitMatrix: async (productId?: string) => {
    return get().fetchSalesMarginReport(productId, get().timeFilter);
  },

  setSelectedProductId: (productId: string) => {
    set({ selectedProductId: productId });
    get().fetchSalesMarginReport(productId || undefined, get().timeFilter);
  },

  setTimeFilter: (timeFilter: string) => {
    set({ timeFilter });
    get().fetchSalesMarginReport(get().selectedProductId || undefined, timeFilter);
  },

  fetchAllReports: async () => {
    const store = useReportStore.getState();
    await Promise.all([
      store.fetchInventoryLedger(),
      store.fetchLiquidityLedger(),
      store.fetchSalesMarginReport(store.selectedProductId || undefined, store.timeFilter),
    ]);
  },
}));
