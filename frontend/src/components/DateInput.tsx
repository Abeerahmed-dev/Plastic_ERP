import React, { useState, useEffect, useRef } from 'react';
import { Calendar } from 'lucide-react';

interface DateInputProps {
  id?: string;
  name?: string;
  value?: string; // YYYY-MM-DD
  onChange?: (val: string) => void; // returns YYYY-MM-DD
  placeholder?: string;
  className?: string;
  hasError?: boolean;
  onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  disabled?: boolean;
}

// Helper: Convert YYYY-MM-DD -> DD/MM/YYYY
export function isoToDisplayDate(iso: string | undefined | null): string {
  if (!iso || typeof iso !== 'string') return '';
  const parts = iso.split('T')[0].split('-');
  if (parts.length === 3 && parts[0].length === 4) {
    const [y, m, d] = parts;
    return `${d.padStart(2, '0')}/${m.padStart(2, '0')}/${y}`;
  }
  return iso;
}

// Helper: Parse DD/MM/YYYY or DD-MM-YYYY or DDMMYYYY -> YYYY-MM-DD
export function displayDateToIso(display: string): string | null {
  if (!display || !display.trim()) return '';
  const cleaned = display.trim();

  // Match DD/MM/YYYY or DD-MM-YYYY or DD.MM.YYYY
  const parts = cleaned.split(/[/.-]/);
  if (parts.length === 3) {
    const [d, m, rawY] = parts;
    let y = rawY;
    if (d && m && y) {
      if (y.length === 2) {
        y = `20${y}`;
      }
      if (y.length === 4) {
        const dayNum = parseInt(d, 10);
        const monthNum = parseInt(m, 10);
        const yearNum = parseInt(y, 10);
        if (dayNum >= 1 && dayNum <= 31 && monthNum >= 1 && monthNum <= 12 && yearNum > 1900) {
          return `${yearNum}-${String(monthNum).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
        }
      }
    }
  }

  // Match DDMMYYYY (8 digits)
  if (/^\d{8}$/.test(cleaned)) {
    const d = cleaned.slice(0, 2);
    const m = cleaned.slice(2, 4);
    const y = cleaned.slice(4, 8);
    return `${y}-${m}-${d}`;
  }

  return null;
}

export const DateInput: React.FC<DateInputProps> = ({
  id,
  name,
  value = '',
  onChange,
  placeholder = 'dd/mm/yyyy',
  className = '',
  hasError = false,
  onKeyDown,
  disabled = false,
}) => {
  const [textVal, setTextVal] = useState<string>(() => isoToDisplayDate(value));
  const hiddenDateRef = useRef<HTMLInputElement | null>(null);

  // Sync internal state with external value changes
  useEffect(() => {
    setTextVal(isoToDisplayDate(value));
  }, [value]);

  const handleTextChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    setTextVal(raw);

    if (!raw.trim()) {
      onChange?.('');
      return;
    }

    const iso = displayDateToIso(raw);
    if (iso) {
      onChange?.(iso);
    }
  };

  const handleBlur = () => {
    if (!textVal.trim()) {
      onChange?.('');
      return;
    }
    const iso = displayDateToIso(textVal);
    if (iso) {
      setTextVal(isoToDisplayDate(iso));
      onChange?.(iso);
    } else {
      // Revert if invalid
      setTextVal(isoToDisplayDate(value));
    }
  };

  const handleCalendarPick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const pickedIso = e.target.value;
    if (pickedIso) {
      setTextVal(isoToDisplayDate(pickedIso));
      onChange?.(pickedIso);
    }
  };

  const openCalendar = () => {
    if (disabled) return;
    if (hiddenDateRef.current) {
      try {
        if ('showPicker' in HTMLInputElement.prototype) {
          hiddenDateRef.current.showPicker();
        } else {
          hiddenDateRef.current.focus();
        }
      } catch {
        hiddenDateRef.current.focus();
      }
    }
  };

  return (
    <div className="relative flex items-center w-full">
      <input
        id={id}
        name={name}
        type="text"
        autoComplete="off"
        value={textVal}
        onChange={handleTextChange}
        onBlur={handleBlur}
        onKeyDown={onKeyDown}
        placeholder={placeholder}
        disabled={disabled}
        className={`pr-9 font-medium tracking-wide ${className} ${hasError ? 'border-red-400 focus:ring-red-200' : ''}`}
      />

      {/* Calendar Icon Button */}
      <button
        type="button"
        tabIndex={-1}
        onClick={openCalendar}
        disabled={disabled}
        className="absolute right-2.5 p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition cursor-pointer"
        title="Choose date from calendar"
      >
        <Calendar className="w-4 h-4" />
      </button>

      {/* Hidden native date input for calendar popup */}
      <input
        ref={hiddenDateRef}
        type="date"
        tabIndex={-1}
        aria-hidden="true"
        value={value || ''}
        onChange={handleCalendarPick}
        className="sr-only pointer-events-none"
      />
    </div>
  );
};

export default DateInput;
