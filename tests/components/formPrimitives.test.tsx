import { RadioGroup, Section, Slider, Toggle } from '@/components/settings/formPrimitives';
import { act, cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

afterEach(cleanup);

/**
 * `formPrimitives.tsx` was extracted in session 68 #1 from
 * SettingsDialog. The four primitives (Section / RadioGroup / Slider /
 * Toggle) are now reusable; tests pin down the API so a regression
 * doesn't break consumers.
 */

describe('Section', () => {
  it('renders the title and children', () => {
    const { container } = render(
      <Section title="My section">
        <span>inner</span>
      </Section>
    );
    expect(container.textContent).toContain('My section');
    expect(container.textContent).toContain('inner');
  });
});

describe('RadioGroup', () => {
  const options = [
    { id: 'a', label: 'A' },
    { id: 'b', label: 'B' },
    { id: 'c', label: 'C' },
  ] as const;

  it('marks the selected option with aria-pressed=true', () => {
    const { container } = render(
      <RadioGroup name="test" value="b" onChange={() => {}} options={options} />
    );
    const buttons = container.querySelectorAll('button');
    const pressed = Array.from(buttons).filter((b) => b.getAttribute('aria-pressed') === 'true');
    expect(pressed).toHaveLength(1);
    expect(pressed[0]?.textContent).toContain('B');
  });

  it('calls onChange with the option id when clicked', () => {
    const spy = vi.fn();
    const { container } = render(
      <RadioGroup name="test" value="a" onChange={spy} options={options} />
    );
    const cButton = Array.from(container.querySelectorAll('button')).find(
      (b) => b.textContent === 'C'
    );
    expect(cButton).toBeTruthy();
    act(() => fireEvent.click(cButton!));
    expect(spy).toHaveBeenCalledWith('c');
  });

  it('renders the optional hint text', () => {
    const { container } = render(
      <RadioGroup
        name="test"
        value="a"
        onChange={() => {}}
        options={[{ id: 'a', label: 'A', hint: 'Helpful hint' }]}
      />
    );
    expect(container.textContent).toContain('Helpful hint');
  });

  it('stamps data-radio-name for test selectors', () => {
    const { container } = render(
      <RadioGroup name="theme" value="a" onChange={() => {}} options={options} />
    );
    const tagged = container.querySelectorAll('[data-radio-name="theme"]');
    expect(tagged.length).toBe(options.length);
  });
});

describe('Slider', () => {
  it('renders the label, hint, and current value', () => {
    const { container } = render(
      <Slider label="Compactness" hint="Tight or loose" value={42} onChange={() => {}} />
    );
    expect(container.textContent).toContain('Compactness');
    expect(container.textContent).toContain('Tight or loose');
    expect(container.textContent).toContain('42');
  });

  it('calls onChange with a number when the range moves', () => {
    const spy = vi.fn();
    const { container } = render(<Slider label="X" value={50} onChange={spy} />);
    const input = container.querySelector('input[type="range"]') as HTMLInputElement;
    expect(input).toBeTruthy();
    act(() => fireEvent.change(input, { target: { value: '75' } }));
    expect(spy).toHaveBeenCalledWith(75);
  });
});

describe('Toggle', () => {
  it('renders the label and hint', () => {
    const { container } = render(
      <Toggle label="Browse Lock" hint="Read-only" checked={false} onChange={() => {}} />
    );
    expect(container.textContent).toContain('Browse Lock');
    expect(container.textContent).toContain('Read-only');
  });

  it('reflects the checked prop', () => {
    const { container, rerender } = render(
      <Toggle label="X" checked={false} onChange={() => {}} />
    );
    const cb = container.querySelector('input[type="checkbox"]') as HTMLInputElement;
    expect(cb.checked).toBe(false);
    rerender(<Toggle label="X" checked={true} onChange={() => {}} />);
    expect(cb.checked).toBe(true);
  });

  it('calls onChange with the new boolean on toggle', () => {
    const spy = vi.fn();
    const { container } = render(<Toggle label="X" checked={false} onChange={spy} />);
    const cb = container.querySelector('input[type="checkbox"]') as HTMLInputElement;
    act(() => fireEvent.click(cb));
    expect(spy).toHaveBeenCalledWith(true);
  });
});
