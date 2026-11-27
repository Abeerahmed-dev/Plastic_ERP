import { useState, useRef, useEffect, useMemo } from 'react';
import { ChevronDown, Check, X, Search } from 'lucide-react';

export interface ComboboxOption {
  value: string;
  label: string;
  subLabel?: string;
  badge?: string;
}

interface SearchableComboboxProps {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  options: ComboboxOption[];
  placeholder?: string;
  disabled?: boolean;
  hasError?: boolean;
  className?: string;
  autoFocus?: boolean;
  onSelectNext?: () => void;
  onTabNext?: () => void;
  onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  allowCustom?: boolean;
  customValue?: string;
  onCustomSelect?: (val: string) => void;
  customOptionLabel?: (typedText: string) => string;
  hideCustomBadge?: boolean;
  onInputChange?: (text: string) => void;
}

export function SearchableCombobox({
  id,
  value,
  onChange,
  options,
  placeholder = 'Select option...',
  disabled = false,
  hasError = false,
  className = '',
  autoFocus = false,
  onSelectNext,
  onTabNext,
  onKeyDown,
  allowCustom = false,
  customValue = '',
  onCustomSelect,
  customOptionLabel,
  hideCustomBadge = false,
  onInputChange,
}: SearchableComboboxProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [highlightedIndex, setHighlightedIndex] = useState<number>(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const optionsListRef = useRef<HTMLDivElement>(null);

  // Find currently selected option (exact, or trimmed & case-insensitive fallback)
  const selectedOption = useMemo(() => {
    if (!value) return undefined;
    const directMatch = options.find((opt) => opt.value === value);
    if (directMatch) return directMatch;

    const normalizedVal = value.trim().toLowerCase();
    return (
      options.find((opt) => opt.value.trim().toLowerCase() === normalizedVal) ||
      options.find((opt) => opt.label.trim().toLowerCase() === normalizedVal)
    );
  }, [options, value]);

  // Sync display text when value, customValue, or options change
  useEffect(() => {
    if (!isOpen) {
      if (value && selectedOption) {
        setSearchQuery(selectedOption.label);
      } else if (allowCustom && customValue) {
        setSearchQuery(customValue);
      } else if (allowCustom && !onCustomSelect && value) {
        setSearchQuery(value);
      } else if (!value && !customValue) {
        setSearchQuery('');
      }
    }
  }, [value, customValue, selectedOption, isOpen, allowCustom, onCustomSelect]);

  // Filtered options based on search query (trimmed and case-insensitive)
  const filteredOptions = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return options;
    const qNorm = q.replace(/\s*[*xX×]\s*/g, 'x');
    return options.filter((opt) => {
      if (
        opt.label.toLowerCase().includes(q) ||
        opt.value.toLowerCase().includes(q) ||
        (opt.subLabel && opt.subLabel.toLowerCase().includes(q)) ||
        (opt.badge && opt.badge.toLowerCase().includes(q))
      ) {
        return true;
      }
      if (qNorm !== q) {
        const labelNorm = opt.label.toLowerCase().replace(/\s*[*xX×]\s*/g, 'x');
        if (labelNorm.includes(qNorm)) return true;
      }
      return false;
    });
  }, [options, searchQuery]);

  const trimmedQuery = searchQuery.trim();
  const exactMatch = useMemo(() => {
    if (!trimmedQuery) return false;
    const q = trimmedQuery.toLowerCase();
    return options.some(
      (opt) => opt.label.trim().toLowerCase() === q || opt.value.trim().toLowerCase() === q
    );
  }, [options, trimmedQuery]);

  const showCustomOption = Boolean(allowCustom && trimmedQuery && !exactMatch);
  const totalNavigable = filteredOptions.length + (showCustomOption ? 1 : 0);

  // Keep highlightedIndex in sync with value or 0 when open
  useEffect(() => {
    if (isOpen) {
      const normalizedVal = (value || '').trim().toLowerCase();
      const idx = filteredOptions.findIndex(
        (opt) => opt.value === value || (normalizedVal && opt.value.trim().toLowerCase() === normalizedVal)
      );
      setHighlightedIndex(idx >= 0 ? idx : 0);
    }
  }, [isOpen]);

  // Close dropdown if disabled
  useEffect(() => {
    if (disabled) {
      setIsOpen(false);
      if (!value && !customValue) setSearchQuery('');
    }
  }, [disabled, value, customValue]);

  // Click outside listener — only active while the dropdown is open so clicks
  // elsewhere on the page (e.g. paginated table rows) never clear or reset filters.
  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        if (allowCustom) {
          const q = searchQuery.trim();
          if (q) {
            if (value && selectedOption && q.toLowerCase() === selectedOption.label.trim().toLowerCase()) {
              setSearchQuery(selectedOption.label);
            } else if (onCustomSelect) {
              if (value) onChange('');
              if (customValue !== q) onCustomSelect(q);
              setSearchQuery(q);
            } else {
              if (value !== q) onChange(q);
              setSearchQuery(q);
            }
          } else {
            if (value) onChange('');
            if (customValue) onCustomSelect?.('');
            setSearchQuery('');
          }
        } else {
          setSearchQuery(selectedOption ? selectedOption.label : '');
        }
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen, selectedOption, searchQuery, allowCustom, value, customValue, onChange, onCustomSelect]);

  const scrollToOption = (index: number) => {
    if (optionsListRef.current) {
      const el = optionsListRef.current.children[index] as HTMLElement;
      if (el) {
        el.scrollIntoView({ block: 'nearest' });
      }
    }
  };

  const handleSelectSaved = (optValue: string) => {
    onChange(optValue);
    if (onCustomSelect) {
      onCustomSelect('');
    }
    const chosen = options.find((o) => o.value === optValue);
    setSearchQuery(chosen ? chosen.label : '');
    setIsOpen(false);
  };

  const handleSelectCustom = (customText: string) => {
    const cleanText = customText.trim();
    if (cleanText) {
      if (onCustomSelect) {
        onChange('');
        onCustomSelect(cleanText);
      } else {
        onChange(cleanText);
      }
      setSearchQuery(cleanText);
    }
    setIsOpen(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (disabled) return;

    if (onKeyDown) {
      onKeyDown(e);
      if (e.defaultPrevented) return;
    }

    if (e.ctrlKey || e.metaKey || (e.altKey && e.key !== 'ArrowDown' && e.key !== 'ArrowUp')) {
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (!isOpen) {
        setIsOpen(true);
      } else if (totalNavigable > 0) {
        setHighlightedIndex((prev) => {
          const next = prev < totalNavigable - 1 ? prev + 1 : 0;
          scrollToOption(next);
          return next;
        });
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (!isOpen) {
        setIsOpen(true);
      } else if (totalNavigable > 0) {
        setHighlightedIndex((prev) => {
          const next = prev > 0 ? prev - 1 : totalNavigable - 1;
          scrollToOption(next);
          return next;
        });
      }
    } else if (e.key === 'Enter') {
      if (isOpen && totalNavigable > 0) {
        e.preventDefault();
        if (highlightedIndex < filteredOptions.length) {
          const targetOpt = filteredOptions[highlightedIndex];
          if (targetOpt) {
            handleSelectSaved(targetOpt.value);
            if (onSelectNext) {
              setTimeout(() => onSelectNext(), 50);
            }
          }
        } else if (showCustomOption) {
          handleSelectCustom(trimmedQuery);
          if (onSelectNext) {
            setTimeout(() => onSelectNext(), 50);
          }
        }
      } else if (isOpen && allowCustom && trimmedQuery) {
        e.preventDefault();
        handleSelectCustom(trimmedQuery);
        if (onSelectNext) {
          setTimeout(() => onSelectNext(), 50);
        }
      } else if (!isOpen && onSelectNext) {
        e.preventDefault();
        onSelectNext();
      }
    } else if (e.key === 'Escape') {
      if (isOpen) {
        e.preventDefault();
        e.stopPropagation();
        setIsOpen(false);
      }
    } else if (e.key === 'Tab') {
      if (isOpen && totalNavigable > 0 && highlightedIndex >= 0) {
        if (highlightedIndex < filteredOptions.length) {
          const targetOpt = filteredOptions[highlightedIndex];
          if (targetOpt) {
            handleSelectSaved(targetOpt.value);
          }
        } else if (showCustomOption) {
          handleSelectCustom(trimmedQuery);
        }
      } else if (allowCustom && trimmedQuery) {
        handleSelectCustom(trimmedQuery);
      }
      setIsOpen(false);
      if (onTabNext) {
        onTabNext();
      }
    }
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange('');
    onCustomSelect?.('');
    onInputChange?.('');
    setSearchQuery('');
    setIsOpen(false);
    inputRef.current?.focus();
  };

  const handleInputFocus = () => {
    if (!disabled) {
      setIsOpen(true);
      inputRef.current?.select();
    }
  };

  return (
    <div ref={containerRef} className={`relative w-full ${className}`}>
      <div
        className={`relative flex items-center rounded-lg border transition-all ${
          disabled
            ? 'bg-slate-100/70 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 cursor-not-allowed'
            : hasError
            ? 'border-red-500 bg-white dark:bg-[#121520] ring-1 ring-red-500'
            : isOpen
            ? 'border-blue-500 dark:border-blue-500 bg-white dark:bg-[#121520] ring-2 ring-blue-100 dark:ring-blue-900/40'
            : 'border-slate-300 dark:border-slate-700 bg-white dark:bg-[#121520] hover:border-slate-400 hover:dark:border-slate-600'
        }`}
      >
        <input
          id={id}
          ref={inputRef}
          type="text"
          disabled={disabled}
          autoFocus={autoFocus}
          value={searchQuery}
          onChange={(e) => {
            const nextVal = e.target.value;
            setSearchQuery(nextVal);
            onInputChange?.(nextVal);
            if (!isOpen) setIsOpen(true);
            setHighlightedIndex(0);
          }}
          onFocus={handleInputFocus}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className={`w-full py-2 pl-3 text-sm outline-none rounded-lg bg-transparent truncate ${
            allowCustom && !hideCustomBadge && (value || customValue) ? 'pr-24' : 'pr-10'
          } ${
            disabled ? 'text-slate-400 cursor-not-allowed' : 'text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500'
          }`}
        />

        <div className="absolute right-2 flex items-center gap-1.5 text-slate-400">
          {allowCustom && !hideCustomBadge && (
            value ? (
              <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-300">
                Saved
              </span>
            ) : customValue ? (
              <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-300">
                Walk-In
              </span>
            ) : null
          )}
          {!disabled && (value || (allowCustom && customValue) || searchQuery) && (
            <button
              type="button"
              onClick={handleClear}
              className="p-0.5 hover:text-slate-600 rounded cursor-pointer transition"
              title="Clear selection"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
          <button
            type="button"
            disabled={disabled}
            onClick={() => {
              if (!disabled) {
                if (isOpen && allowCustom) {
                  const q = searchQuery.trim();
                  if (q) {
                    if (!(value && selectedOption && q.toLowerCase() === selectedOption.label.trim().toLowerCase())) {
                      if (onCustomSelect) {
                        if (value) onChange('');
                        if (customValue !== q) onCustomSelect(q);
                      } else if (value !== q) {
                        onChange(q);
                      }
                    }
                  } else {
                    if (value) onChange('');
                    if (customValue) onCustomSelect?.('');
                  }
                } else if (!isOpen) {
                  inputRef.current?.focus();
                }
                setIsOpen(!isOpen);
              }
            }}
            className="p-0.5 hover:text-slate-600 cursor-pointer"
          >
            <ChevronDown className={`w-4 h-4 transition-transform duration-150 ${isOpen ? 'rotate-180' : ''}`} />
          </button>
        </div>
      </div>

      {/* Dropdown Floating Menu */}
      {isOpen && !disabled && (
        <div
          ref={optionsListRef}
          className="absolute left-0 right-0 top-full mt-1 z-50 max-h-60 overflow-y-auto rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#161925] p-1 shadow-xl animate-in fade-in zoom-in-95 duration-100"
        >
          {filteredOptions.length === 0 && !showCustomOption ? (
            <div className="py-3 px-3 text-center text-xs text-slate-400 flex items-center justify-center gap-1.5">
              <Search className="w-3.5 h-3.5" />
              <span>No matching options found</span>
            </div>
          ) : (
            <>
              {filteredOptions.map((opt, idx) => {
                const isSelected = opt.value === value;
                const isHighlighted = idx === highlightedIndex;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onMouseEnter={() => setHighlightedIndex(idx)}
                    onClick={() => {
                      handleSelectSaved(opt.value);
                      if (onSelectNext) {
                        setTimeout(() => onSelectNext(), 50);
                      }
                    }}
                    className={`w-full text-left px-3 py-2 rounded-lg text-sm flex items-center justify-between gap-2 transition cursor-pointer ${
                      isHighlighted
                        ? 'bg-blue-100 dark:bg-blue-900/60 text-blue-950 dark:text-blue-100 font-bold ring-1 ring-blue-400'
                        : isSelected
                        ? 'bg-blue-50 dark:bg-blue-950/40 text-blue-900 dark:text-blue-300 font-semibold'
                        : 'hover:bg-slate-50 hover:dark:bg-[#1f2438] text-slate-700 dark:text-slate-200'
                    }`}
                  >
                    <div className="flex flex-col min-w-0">
                      <span className="truncate">{opt.label}</span>
                      {opt.subLabel && (
                        <span className="text-[11px] text-slate-400 font-normal truncate mt-0.5">
                          {opt.subLabel}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      {opt.badge && (
                        <span className="rounded bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 text-[10px] font-mono text-slate-600 dark:text-slate-300">
                          {opt.badge}
                        </span>
                      )}
                      {isSelected && <Check className="w-4 h-4 text-blue-600" />}
                    </div>
                  </button>
                );
              })}

              {showCustomOption && (
                <button
                  key="__custom_walk_in__"
                  type="button"
                  onMouseEnter={() => setHighlightedIndex(filteredOptions.length)}
                  onClick={() => {
                    handleSelectCustom(trimmedQuery);
                    if (onSelectNext) {
                      setTimeout(() => onSelectNext(), 50);
                    }
                  }}
                  className={`w-full text-left px-3 py-2.5 rounded-lg text-sm flex items-center justify-between gap-2 transition cursor-pointer ${
                    filteredOptions.length > 0 ? 'mt-1 border-t border-slate-100 dark:border-slate-800' : ''
                  } ${
                    hideCustomBadge
                      ? highlightedIndex === filteredOptions.length
                        ? 'bg-blue-50 dark:bg-blue-900/40 text-blue-900 dark:text-blue-100 font-semibold ring-1 ring-blue-300'
                        : 'bg-slate-50 hover:bg-blue-50/70 dark:bg-slate-800/40 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200 font-medium'
                      : highlightedIndex === filteredOptions.length
                        ? 'bg-amber-100 dark:bg-amber-900/60 text-amber-950 dark:text-amber-100 font-bold ring-1 ring-amber-400'
                        : 'bg-amber-50 hover:bg-amber-100/70 dark:bg-amber-950/40 dark:hover:bg-amber-950/70 text-amber-900 dark:text-amber-200 font-semibold'
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className={`flex items-center justify-center w-5 h-5 rounded-full text-xs font-bold shrink-0 ${
                      hideCustomBadge
                        ? 'bg-blue-100 dark:bg-blue-800 text-blue-700 dark:text-blue-100'
                        : 'bg-amber-200 dark:bg-amber-800 text-amber-900 dark:text-amber-100'
                    }`}>
                      +
                    </span>
                    <span className="truncate">
                      {customOptionLabel
                        ? customOptionLabel(trimmedQuery)
                        : (
                          <>
                            Use &ldquo;<span className="underline font-bold">{trimmedQuery}</span>&rdquo; as Walk-In Customer
                          </>
                        )}
                    </span>
                  </div>
                  {!hideCustomBadge && (
                    <span className="shrink-0 px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-amber-200 text-amber-900 dark:bg-amber-800 dark:text-amber-100 border border-amber-300 dark:border-amber-700">
                      Walk-In
                    </span>
                  )}
                </button>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
