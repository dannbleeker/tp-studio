import { render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { InspectorSheet } from '@/components/inspector/InspectorSheet';

const aside = (c: HTMLElement) => c.querySelector('aside') as HTMLElement;

describe('InspectorSheet', () => {
  it('renders its title + children and is interactive when open', () => {
    const { container } = render(
      <InspectorSheet open title="Entity" onClose={() => {}}>
        <p>sheet body</p>
      </InspectorSheet>
    );
    expect(container.textContent).toContain('Entity');
    expect(container.textContent).toContain('sheet body');
    const el = aside(container);
    expect(el.getAttribute('aria-hidden')).toBe('false');
    expect(el.hasAttribute('inert')).toBe(false);
    // At rest an open sheet sits at translateY(0px); only a closed sheet slides off.
    expect(el.style.transform).toBe('translateY(0px)');
  });

  it('is inert + slid off-screen when closed', () => {
    const { container } = render(
      <InspectorSheet open={false} title="Entity" onClose={() => {}}>
        <p>sheet body</p>
      </InspectorSheet>
    );
    const el = aside(container);
    expect(el.getAttribute('aria-hidden')).toBe('true');
    expect(el.hasAttribute('inert')).toBe(true);
    expect(el.style.transform).toBe('translateY(100%)');
  });

  it('closes when the backdrop is tapped', () => {
    const onClose = vi.fn();
    const { container } = render(
      <InspectorSheet open title="Entity" onClose={onClose}>
        <p>sheet body</p>
      </InspectorSheet>
    );
    const backdrop = container.querySelector(
      '[data-component="inspector-backdrop"]'
    ) as HTMLElement;
    expect(backdrop).not.toBeNull();
    backdrop.click();
    expect(onClose).toHaveBeenCalledOnce();
  });
});
