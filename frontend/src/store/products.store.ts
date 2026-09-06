import { create } from 'zustand';
import { Product } from '../types/product.types';
import { productsService } from '../services/products.service';

interface ProductsState {
  products: Product[];
  isLoading: boolean;
  error: string | null;
  fetchProducts: () => Promise<void>;
  getProductConversionRate: (productId: string) => number;
  getProductById: (productId: string) => Product | undefined;
}

export const useProductsStore = create<ProductsState>((set, get) => ({
  products: [],
  isLoading: false,
  error: null,

  fetchProducts: async () => {
    set({ isLoading: true, error: null });
    try {
      const data = await productsService.getProducts();
      set({ products: data, isLoading: false });
    } catch (err: any) {
      set({ error: err.message || 'Failed to fetch products', isLoading: false });
    }
  },

  getProductConversionRate: (productId: string): number => {
    const product = get().products.find((p) => p.id === productId);
    if (!product) return 25.0; // fallback standard rate (KG per Bora)
    const rate = Number(product.default_kg_per_purchase_unit);
    return isNaN(rate) || rate <= 0 ? 25.0 : rate;
  },

  getUnitConversions: (productId: string): Record<string, number> => {
    const defaultConversions = { Bora: 25.0, Peti: 15.0, Dasti: 0.5, Pura: 5.0, KG: 1.0 };
    const product = get().products.find((p) => p.id === productId);
    if (!product || !product.unit_conversions) return defaultConversions;
    return product.unit_conversions;
  },

  getProductById: (productId: string): Product | undefined => {
    return get().products.find((p) => p.id === productId);
  },
}));
