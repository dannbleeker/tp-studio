import { cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CollapsibleSection } from '@/components/inspector/CollapsibleSection';

/**
 * Session 193 — the inspector's collapsible section wrapper. Header toggles the
 * body; open/closed state persists per-section in localStorage so it survives
 * entity switches and reloads. The body stays in the DOM (toggled via `hidden`)
 * so the button's aria-controls target always exists.
 */

beforeEach(() => {
  window.localStorage.clear();
});
afterEach(() => {
  cleanup();
  window.localStorage.clear();
});

const body = () => <p>section body</p>;
const bodyOf = (container: HTMLElement, id: string) =>
  container.querySelector(`#inspector-section-${id}`) as HTMLElement | null;

describe('CollapsibleSection', () => {
  it('shows the body when defaultOpen and no stored state', () => {
    const { container, getByRole } = render(
      <CollapsibleSection id="s1" title="Appearance" defaultOpen>
        {body()}
      </CollapsibleSection>
    );
    expect(bodyOf(container, 's1')?.hidden).toBe(false);
    expect(getByRole('button').getAttribute('aria-expanded')).toBe('true');
  });

  it('hides the body (but keeps it in the DOM) when defaultOpen is false', () => {
    const { container, getByRole } = render(
      <CollapsibleSection id="s2" title="Advanced" defaultOpen={false}>
        {body()}
      </CollapsibleSection>
    );
    const wrapper = bodyOf(container, 's2');
    // In the DOM so aria-controls resolves, but hidden.
    expect(wrapper).not.toBeNull();
    expect(wrapper?.hidden).toBe(true);
    const button = getByRole('button');
    expect(button.getAttribute('aria-expanded')).toBe('false');
    expect(button.getAttribute('aria-controls')).toBe('inspector-section-s2');
  });

  it('toggles the body on header click and persists the new state', () => {
    const { container, getByRole } = render(
      <CollapsibleSection id="s3" title="Advanced" defaultOpen={false}>
        {body()}
      </CollapsibleSection>
    );
    expect(bodyOf(container, 's3')?.hidden).toBe(true);
    fireEvent.click(getByRole('button'));
    expect(bodyOf(container, 's3')?.hidden).toBe(false);
    expect(window.localStorage.getItem('tp-inspector-section:s3')).toBe('1');
    fireEvent.click(getByRole('button'));
    expect(bodyOf(container, 's3')?.hidden).toBe(true);
    expect(window.localStorage.getItem('tp-inspector-section:s3')).toBe('0');
  });

  it('stored state overrides defaultOpen (persists across mounts)', () => {
    window.localStorage.setItem('tp-inspector-section:s4', '1');
    const { container } = render(
      // defaultOpen=false, but the stored '1' wins.
      <CollapsibleSection id="s4" title="Advanced" defaultOpen={false}>
        {body()}
      </CollapsibleSection>
    );
    expect(bodyOf(container, 's4')?.hidden).toBe(false);
  });

  it('falls back to defaultOpen when localStorage.getItem throws', () => {
    const spy = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    const { container } = render(
      <CollapsibleSection id="s5" title="Appearance" defaultOpen>
        {body()}
      </CollapsibleSection>
    );
    expect(bodyOf(container, 's5')?.hidden).toBe(false);
    spy.mockRestore();
  });
});
