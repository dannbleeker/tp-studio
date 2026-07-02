import { cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ChipSelect } from '@/components/inspector/ChipSelect';

/**
 * Session 193 — the compact colour-coded direct-pick control that replaced the
 * inspector's forward-only cycle chips.
 */

afterEach(cleanup);

const OPTIONS = [
  { value: 'a', label: 'Alpha' },
  { value: 'b', label: 'Beta' },
  { value: 'c', label: 'Gamma' },
] as const;

describe('ChipSelect', () => {
  it('renders a select showing the current value with all options', () => {
    const { getByLabelText, getByRole } = render(
      <ChipSelect
        value="b"
        options={OPTIONS}
        onChange={vi.fn()}
        colorClass="bg-amber-50"
        ariaLabel="Pick one"
      />
    );
    const select = getByLabelText('Pick one') as HTMLSelectElement;
    expect(select.value).toBe('b');
    expect(getByRole('option', { name: 'Gamma' })).toBeTruthy();
  });

  it('reports the picked value directly (no cycling)', () => {
    const onChange = vi.fn();
    const { getByLabelText } = render(
      <ChipSelect
        value="a"
        options={OPTIONS}
        onChange={onChange}
        colorClass="bg-amber-50"
        ariaLabel="Pick one"
      />
    );
    // Jump straight from 'a' to 'c' — the whole point vs a forward-only cycle.
    fireEvent.change(getByLabelText('Pick one'), { target: { value: 'c' } });
    expect(onChange).toHaveBeenCalledWith('c');
  });

  it('applies the colour class and disables when locked', () => {
    const { getByLabelText } = render(
      <ChipSelect
        value="a"
        options={OPTIONS}
        onChange={vi.fn()}
        colorClass="border-emerald-300"
        ariaLabel="Pick one"
        disabled
      />
    );
    const select = getByLabelText('Pick one') as HTMLSelectElement;
    expect(select.className).toMatch(/border-emerald-300/);
    expect(select.disabled).toBe(true);
  });
});
