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
}: SearchableComboboxProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [highlightedIndex, setHighlightedIndex] = useState<number>(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const optionsListRef = useRef<HTMLDivElement>(null);

  // Find currently selected option
  const selectedOption = useMemo(() => {
    return options.find((opt) => opt.value === value);
  }, [options, value]);

  // Sync display text when value or options change
  useEffect(() => {
    if (!value) {
      setSearchQuery('');
    } else if (!isOpen) {
      setSearchQuery(selectedOption ? selectedOption.label : '');
    }
  }, [value, selectedOption, isOpen]);

  // Keep highlightedIndex in sync with value or 0 when open
  useEffect(() => {
    if (isOpen) {
      const idx = filteredOptions.findIndex((opt) => opt.value === value);
      setHighlightedIndex(idx >= 0 ? idx : 0);
    }
  }, [isOpen]);

  // Close dropdown if disabled
  useEffect(() => {
    if (disabled) {
      setIsOpen(false);
      if (!value) setSearchQuery('');
    }
  }, [disabled, value]);

  // Click outside listener
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        setSearchQuery(selectedOption ? selectedOption.label : '');
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [selectedOption]);

  // Filtered options based on search query
  const filteredOptions = useMemo(() => {
    if (!searchQuery.trim()) return options;
    const q = searchQuery.toLowerCase().trim();
    return options.filter(
      (opt) =>
        opt.label.toLowerCase().includes(q) ||
        (opt.subLabel && opt.subLabel.toLowerCase().includes(q)) ||
        (opt.badge && opt.badge.toLowerCase().includes(q))
    );
  }, [options, searchQuery]);

  const scrollToOption = (index: number) => {
    if (optionsListRef.current) {
      const el = optionsListRef.current.children[index] as HTMLElement;
      if (el) {
        el.scrollIntoView({ block: 'nearest' });
      }
    }
  };

  const handleSelect = (optValue: string) => {
    onChange(optValue);
    const chosen = options.find((o) => o.value === optValue);
    setSearchQuery(chosen ? chosen.label : '');
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
      } else if (filteredOptions.length > 0) {
        setHighlightedIndex((prev) => {
          const next = prev < filteredOptions.length - 1 ? prev + 1 : 0;
          scrollToOption(next);
          return next;
        });
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (!isOpen) {
        setIsOpen(true);
      } else if (filteredOptions.length > 0) {
        setHighlightedIndex((prev) => {
          const next = prev > 0 ? prev - 1 : filteredOptions.length - 1;
          scrollToOption(next);
          return next;
        });
      }
    } else if (e.key === 'Enter') {
      if (isOpen && filteredOptions.length > 0) {
        e.preventDefault();
        const targetOpt = filteredOptions[highlightedIndex] || filteredOptions[0];
        if (targetOpt) {
          handleSelect(targetOpt.value);
          if (onSelectNext) {
            setTimeout(() => onSelectNext(), 50);
          }
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
      if (isOpen && filteredOptions.length > 0 && highlightedIndex >= 0) {
        const targetOpt = filteredOptions[highlightedIndex];
        if (targetOpt) {
          handleSelect(targetOpt.value);
        }
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
            setSearchQuery(e.target.value);
            if (!isOpen) setIsOpen(true);
            setHighlightedIndex(0);
          }}
          onFocus={handleInputFocus}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className={`w-full py-2 pl-3 pr-8 text-sm outline-none rounded-lg bg-transparent truncate ${
            disabled ? 'text-slate-400 cursor-not-allowed' : 'text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500'
          }`}
        />

        <div className="absolute right-2 flex items-center gap-1 text-slate-400">
          {!disabled && value && (
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
                if (!isOpen) {
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
          {filteredOptions.length === 0 ? (
            <div className="py-3 px-3 text-center text-xs text-slate-400 flex items-center justify-center gap-1.5">
              <Search className="w-3.5 h-3.5" />
              <span>No matching options found</span>
            </div>
          ) : (
            filteredOptions.map((opt, idx) => {
              const isSelected = opt.value === value;
              const isHighlighted = idx === highlightedIndex;
              return (
                <button
                  key={opt.value}
                  type="button"
                  onMouseEnter={() => setHighlightedIndex(idx)}
                  onClick={() => {
                    handleSelect(opt.value);
                    if (onSelectNext) {
                      setTimeout(() => onSelectNext(), 50);
                    }
                  }}
                  className={`w-full text-left px-3 py-2 rounded-lg text-sm flex items-center justify-between gap-2 transition ${
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
            })
          )}
        </div>
      )}
    </div>
  );
}
