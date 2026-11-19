import React, { useState, useRef, useEffect, useMemo } from 'react';
import { ChevronDown, X, RotateCcw, Search, Check } from 'lucide-react';

export interface ProductItem {
  name: string;
  size?: string | null;
  [key: string]: any;
}

export interface ProductSizeFilterProps {
  products: ProductItem[];
  productQuery: string;
  sizeQuery: string;
  onProductChange: (value: string) => void;
  onSizeChange: (value: string) => void;
  onClear: () => void;
  onEnterSingleMatch?: () => void;
  className?: string;
  productInputId?: string;
  sizeInputId?: string;
  productInputRef?: React.Ref<HTMLInputElement>;
  sizeInputRef?: React.Ref<HTMLInputElement>;
  showLabels?: boolean;
  productLabel?: string;
  sizeLabel?: string;
}

export function ProductSizeFilter({
  products,
  productQuery,
  sizeQuery,
  onProductChange,
  onSizeChange,
  onClear,
  onEnterSingleMatch,
  className = '',
  productInputId = 'filter-product-combobox',
  sizeInputId = 'filter-size-combobox',
  productInputRef,
  sizeInputRef,
  showLabels = false,
  productLabel = 'Select Product',
  sizeLabel = 'Select Size',
}: ProductSizeFilterProps) {
  const [isProductOpen, setIsProductOpen] = useState(false);
  const [isSizeOpen, setIsSizeOpen] = useState(false);

  const productBoxRef = useRef<HTMLDivElement>(null);
  const sizeBoxRef = useRef<HTMLDivElement>(null);

  // Close dropdowns on click outside or Escape
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (productBoxRef.current && !productBoxRef.current.contains(target)) {
        setIsProductOpen(false);
      }
      if (sizeBoxRef.current && !sizeBoxRef.current.contains(target)) {
        setIsSizeOpen(false);
      }
    };

    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsProductOpen(false);
        setIsSizeOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleGlobalKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleGlobalKeyDown);
    };
  }, []);

  // Box 1 Options: Unique, trimmed, case-insensitively deduplicated, alphabetically sorted product names
  const allProductNames = useMemo(() => {
    const map = new Map<string, string>();
    for (const p of products) {
      const name = (p.name || '').trim();
      if (!name) continue;
      const key = name.toLowerCase();
      if (!map.has(key)) {
        map.set(key, name);
      }
    }
    return Array.from(map.values()).sort((a, b) =>
      a.localeCompare(b, undefined, { sensitivity: 'base' })
    );
  }, [products]);

  // Dropdown list for Box 1 filtered by user typing
  const filteredProductOptions = useMemo(() => {
    const q = productQuery.trim().toLowerCase();
    if (!q) return allProductNames;
    return allProductNames.filter((name) => name.toLowerCase().includes(q));
  }, [allProductNames, productQuery]);

  // Cascading condition: Box 2 unlocks when productQuery.trim() is non-empty
  const isSizeDisabled = !productQuery.trim();

  // Box 2 Options: Unique, trimmed, case-insensitively deduplicated sizes belonging to products matching productQuery
  const allMatchingSizes = useMemo(() => {
    const q = productQuery.trim().toLowerCase();
    if (!q) return [];
    const map = new Map<string, string>();
    for (const p of products) {
      const pName = (p.name || '').trim().toLowerCase();
      if (pName.includes(q)) {
        const size = (p.size || '').trim();
        if (!size) continue;
        const key = size.toLowerCase();
        if (!map.has(key)) {
          map.set(key, size);
        }
      }
    }
    return Array.from(map.values()).sort((a, b) =>
      a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' })
    );
  }, [products, productQuery]);

  // Dropdown list for Box 2 filtered by user typing
  const filteredSizeOptions = useMemo(() => {
    const sq = sizeQuery.trim().toLowerCase();
    if (!sq) return allMatchingSizes;
    return allMatchingSizes.filter((s) => s.toLowerCase().includes(sq));
  }, [allMatchingSizes, sizeQuery]);

  // Handlers for Box 1
  const handleSelectProduct = (name: string) => {
    onProductChange(name);
    onSizeChange(''); // Reset Box 2 whenever an option is selected in Box 1
    setIsProductOpen(false);
  };

  const handleClearProduct = () => {
    onProductChange('');
    onSizeChange('');
    setIsProductOpen(false);
  };

  // Handlers for Box 2
  const handleSelectSize = (size: string) => {
    onSizeChange(size);
    setIsSizeOpen(false);
  };

  const handleClearSize = () => {
    onSizeChange('');
    setIsSizeOpen(false);
  };

  // Key navigation & POS fast-add
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, isSizeBox = false) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      if (isSizeBox) setIsSizeOpen(false);
      else setIsProductOpen(false);
    } else if (e.key === 'Enter') {
      if (onEnterSingleMatch) {
        e.preventDefault();
        onEnterSingleMatch();
        setIsProductOpen(false);
        setIsSizeOpen(false);
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (isSizeBox) {
        if (!isSizeDisabled) setIsSizeOpen(true);
      } else {
        setIsProductOpen(true);
      }
    }
  };

  const hasActiveFilter = Boolean(productQuery.trim() || sizeQuery.trim());

  return (
    <div className={`flex flex-wrap items-end gap-2.5 sm:gap-3 ${className}`}>
      {/* Box 1 — Product */}
      <div ref={productBoxRef} className="relative flex-1 min-w-[130px]">
        {showLabels && (
          <label
            htmlFor={productInputId}
            className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-1"
          >
            {productLabel}
          </label>
        )}
        <div className="relative">
          <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-2.5 text-slate-400">
            <Search className="h-3.5 w-3.5" />
          </div>
          <input
            id={productInputId}
            ref={productInputRef}
            type="text"
            autoComplete="off"
            placeholder="Search or select product..."
            value={productQuery}
            onFocus={() => setIsProductOpen(true)}
            onClick={() => setIsProductOpen(true)}
            onChange={(e) => {
              onProductChange(e.target.value);
              setIsProductOpen(true);
            }}
            onKeyDown={(e) => handleKeyDown(e, false)}
            className="w-full pl-8 pr-14 py-2 rounded-xl border border-slate-300 bg-white text-xs font-medium text-slate-900 placeholder-slate-400 shadow-2xs focus:border-transparent focus:outline-none focus:ring-2 focus:ring-amber-500 transition-colors dark:bg-[#161925] dark:border-[#23283B] dark:text-white dark:placeholder-slate-500"
          />
          <div className="absolute inset-y-0 right-0 flex items-center pr-2 gap-0.5">
            {productQuery && (
              <button
                type="button"
                onClick={handleClearProduct}
                className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded transition cursor-pointer"
                title="Clear product"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
            <button
              type="button"
              tabIndex={-1}
              onClick={() => setIsProductOpen((prev) => !prev)}
              className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded transition cursor-pointer"
              title="Toggle product list"
            >
              <ChevronDown
                className={`h-3.5 w-3.5 transition-transform duration-150 ${
                  isProductOpen ? 'rotate-180' : ''
                }`}
              />
            </button>
          </div>
        </div>

        {/* Floating Product Options List */}
        {isProductOpen && (
          <div className="absolute left-0 right-0 top-full mt-1.5 z-50 bg-white dark:bg-[#161925] border border-slate-200 dark:border-[#2a3045] rounded-xl shadow-xl max-h-56 overflow-y-auto divide-y divide-slate-100 dark:divide-[#202538]">
            {filteredProductOptions.length === 0 ? (
              <div className="px-3 py-2 text-xs text-slate-400 dark:text-slate-500 text-center">
                No matching products
              </div>
            ) : (
              filteredProductOptions.map((name) => {
                const isSelected =
                  name.toLowerCase() === productQuery.trim().toLowerCase();
                return (
                  <button
                    key={name}
                    type="button"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      handleSelectProduct(name);
                    }}
                    className={`w-full px-3 py-2 text-left text-xs font-medium transition cursor-pointer flex items-center justify-between ${
                      isSelected
                        ? 'bg-amber-50 dark:bg-amber-950/40 text-amber-950 dark:text-amber-200 font-bold'
                        : 'hover:bg-slate-50 dark:hover:bg-[#1f2438] text-slate-800 dark:text-slate-200'
                    }`}
                  >
                    <span className="truncate">{name}</span>
                    {isSelected && (
                      <Check className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400 shrink-0 ml-1" />
                    )}
                  </button>
                );
              })
            )}
          </div>
        )}
      </div>

      {/* Box 2 — Size */}
      <div ref={sizeBoxRef} className="relative flex-1 min-w-[130px]">
        {showLabels && (
          <label
            htmlFor={sizeInputId}
            className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-1"
          >
            {sizeLabel}
          </label>
        )}
        <div className="relative">
          <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-2.5 text-slate-400">
            <Search className="h-3.5 w-3.5" />
          </div>
          <input
            id={sizeInputId}
            ref={sizeInputRef}
            type="text"
            autoComplete="off"
            disabled={isSizeDisabled}
            placeholder={
              isSizeDisabled
                ? 'Select or type a product first'
                : 'Search or select size...'
            }
            value={sizeQuery}
            onFocus={() => {
              if (!isSizeDisabled) setIsSizeOpen(true);
            }}
            onClick={() => {
              if (!isSizeDisabled) setIsSizeOpen(true);
            }}
            onChange={(e) => {
              onSizeChange(e.target.value);
              setIsSizeOpen(true);
            }}
            onKeyDown={(e) => handleKeyDown(e, true)}
            className={`w-full pl-8 pr-14 py-2 rounded-xl border text-xs font-medium shadow-2xs transition-colors focus:border-transparent focus:outline-none focus:ring-2 focus:ring-amber-500 ${
              isSizeDisabled
                ? 'border-slate-200 bg-slate-100 text-slate-400 placeholder-slate-400 cursor-not-allowed dark:bg-[#121520] dark:border-[#1a1f2f] dark:text-slate-600 dark:placeholder-slate-600'
                : 'border-slate-300 bg-white text-slate-900 placeholder-slate-400 dark:bg-[#161925] dark:border-[#23283B] dark:text-white dark:placeholder-slate-500'
            }`}
          />
          <div className="absolute inset-y-0 right-0 flex items-center pr-2 gap-0.5">
            {!isSizeDisabled && sizeQuery && (
              <button
                type="button"
                onClick={handleClearSize}
                className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded transition cursor-pointer"
                title="Clear size"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
            <button
              type="button"
              disabled={isSizeDisabled}
              tabIndex={-1}
              onClick={() => {
                if (!isSizeDisabled) setIsSizeOpen((prev) => !prev);
              }}
              className={`p-1 rounded transition ${
                isSizeDisabled
                  ? 'text-slate-300 dark:text-slate-700 cursor-not-allowed'
                  : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer'
              }`}
              title="Toggle size list"
            >
              <ChevronDown
                className={`h-3.5 w-3.5 transition-transform duration-150 ${
                  isSizeOpen ? 'rotate-180' : ''
                }`}
              />
            </button>
          </div>
        </div>

        {/* Floating Size Options List */}
        {isSizeOpen && !isSizeDisabled && (
          <div className="absolute left-0 right-0 top-full mt-1.5 z-50 bg-white dark:bg-[#161925] border border-slate-200 dark:border-[#2a3045] rounded-xl shadow-xl max-h-56 overflow-y-auto divide-y divide-slate-100 dark:divide-[#202538]">
            {filteredSizeOptions.length === 0 ? (
              <div className="px-3 py-2 text-xs text-slate-400 dark:text-slate-500 text-center">
                No matching sizes
              </div>
            ) : (
              filteredSizeOptions.map((size) => {
                const isSelected =
                  size.toLowerCase() === sizeQuery.trim().toLowerCase();
                return (
                  <button
                    key={size}
                    type="button"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      handleSelectSize(size);
                    }}
                    className={`w-full px-3 py-2 text-left text-xs font-medium transition cursor-pointer flex items-center justify-between ${
                      isSelected
                        ? 'bg-amber-50 dark:bg-amber-950/40 text-amber-950 dark:text-amber-200 font-bold'
                        : 'hover:bg-slate-50 dark:hover:bg-[#1f2438] text-slate-800 dark:text-slate-200'
                    }`}
                  >
                    <span className="truncate">{size}</span>
                    {isSelected && (
                      <Check className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400 shrink-0 ml-1" />
                    )}
                  </button>
                );
              })
            )}
          </div>
        )}
      </div>

      {/* Clear Button */}
      {hasActiveFilter && (
        <div className="flex items-center pb-0.5">
          <button
            type="button"
            onClick={onClear}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white dark:bg-[#161925] dark:border-[#23283B] px-3 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white transition-colors shadow-2xs cursor-pointer shrink-0"
            title="Reset filters"
          >
            <RotateCcw className="h-3.5 w-3.5 text-slate-400" />
            <span>Clear</span>
          </button>
        </div>
      )}
    </div>
  );
}

export default ProductSizeFilter;

