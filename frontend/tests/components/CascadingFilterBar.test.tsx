import { useState } from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CascadingFilterBar } from '../../src/components/CascadingFilterBar';
import { SearchableCombobox } from '../../src/components/SearchableCombobox';

describe('CascadingFilterBar & SearchableCombobox', () => {
  beforeEach(() => {
    Element.prototype.scrollIntoView = vi.fn();
  });

  it('retains selected Page 2 party name instead of wiping it to null and fires onNameInputChange', () => {
    const onNameInputChange = vi.fn();
    const onNameChangeSpy = vi.fn();

    function Wrapper() {
      const [selectedCity, setSelectedCity] = useState<string | null>(null);
      const [selectedName, setSelectedName] = useState<string | null>(null);

      return (
        <div>
          <CascadingFilterBar
            selectedCity={selectedCity}
            selectedName={selectedName}
            onCityChange={setSelectedCity}
            onNameChange={(val) => {
              onNameChangeSpy(val);
              setSelectedName(val);
            }}
            onNameInputChange={onNameInputChange}
            availableCities={['Karachi', 'Lahore']}
            availableNames={['Alpha Traders', 'Zebra Plastics (Page 2)']}
            namePlaceholder="Filter by party name…"
          />
          <div data-testid="selected-name">{selectedName ?? 'NONE'}</div>
        </div>
      );
    }

    render(<Wrapper />);

    const nameInput = screen.getByPlaceholderText('Filter by party name…');
    fireEvent.focus(nameInput);
    fireEvent.change(nameInput, { target: { value: 'Zebra' } });

    expect(onNameInputChange).toHaveBeenCalledWith('Zebra');

    const optionBtn = screen.getByRole('button', { name: /Zebra Plastics \(Page 2\)/i });
    fireEvent.click(optionBtn);

    expect(onNameChangeSpy).toHaveBeenLastCalledWith('Zebra Plastics (Page 2)');
    expect(screen.getByTestId('selected-name').textContent).toBe('Zebra Plastics (Page 2)');
    expect(screen.queryByText('Saved')).toBeNull();
    expect(screen.queryByText('Walk-In')).toBeNull();
  });

  it('preserves Walk-In onCustomSelect contract when used by InvoiceFormModal', () => {
    const onChange = vi.fn();
    const onCustomSelect = vi.fn();

    render(
      <SearchableCombobox
        value=""
        customValue=""
        onChange={onChange}
        onCustomSelect={onCustomSelect}
        allowCustom={true}
        options={[{ value: 'cust-1', label: 'Saved Customer' }]}
        placeholder="Select customer..."
      />
    );

    const input = screen.getByPlaceholderText('Select customer...');
    fireEvent.focus(input);
    fireEvent.click(screen.getByRole('button', { name: /Saved Customer/i }));

    expect(onChange).toHaveBeenCalledWith('cust-1');
    expect(onCustomSelect).toHaveBeenCalledWith('');

    onChange.mockClear();
    onCustomSelect.mockClear();

    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: 'Walk In Ali' } });
    fireEvent.click(screen.getByRole('button', { name: /Walk In Ali/i }));

    expect(onChange).toHaveBeenCalledWith('');
    expect(onCustomSelect).toHaveBeenCalledWith('Walk In Ali');
  });
});
