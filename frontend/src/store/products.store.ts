import { create } from 'zustand';
import { Product } from '../types/product.types';
import { productsService } from '../services/products.service';

interface ProductsState {
  products: Product[];
  isLoading: boolean;
  error: string | null;
  fetchProducts: () => Promise<void>;
  getProductConversionRate: (productId: string) => number;
  getUnitConversions: (productId: string) => Record<string, number>;
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
    if (!product) return 25.0; // fallback standard rate (KG per Bag)
    const rate = Number(product.bag_weight_kg);
    return isNaN(rate) || rate <= 0 ? 25.0 : rate;
  },

  getUnitConversions: (productId: string): Record<string, number> => {
    const product = get().products.find((p) => p.id === productId);
    const bagWt = product && product.bag_weight_kg ? Number(product.bag_weight_kg) : 25.0;
    return { Bag: bagWt, KG: 1.0 };
  },

  getProductById: (productId: string): Product | undefined => {
    return get().products.find((p) => p.id === productId);
  },
}));
