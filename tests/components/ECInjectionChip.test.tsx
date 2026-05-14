import { ECInjectionChip } from '@/components/canvas/ECInjectionChip';
import { resetStoreForTest, useDocumentStore } from '@/store';
import { act, cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

beforeEach(resetStoreForTest);
afterEach(cleanup);

/**
 * Session 87 / EC PPT comparison item #7 — Injection-summary chip.
 *
 * Tests: gated on EC, renders the count (including zero state for
 * discoverability), clicking flips the EC inspector tab to
 * 'injections'.
 */

describe('ECInjectionChip', () => {
  it('renders nothing on non-EC docs', () => {
    // Default doc is CRT.
    expect(useDocumentStore.getState().doc.diagramType).toBe('crt');
    const { container } = render(<ECInjectionChip />);
    expect(container.querySelector('[data-component="ec-injection-chip"]')).toBeNull();
  });

  it('renders "Injections (0)" on a fresh EC doc', () => {
    act(() => useDocumentStore.getState().newDocument('ec'));
    const { container } = render(<ECInjectionChip />);
    const chip = container.querySelector('[data-component="ec-injection-chip"]');
    expect(chip).not.toBeNull();
    expect(chip?.textContent).toContain('Injections (0)');
  });

  it('reflects the live count when injection entities are added', () => {
    act(() => {
      useDocumentStore.getState().newDocument('ec');
      useDocumentStore.getState().addEntity({ type: 'injection', title: 'Inject A' });
      useDocumentStore.getState().addEntity({ type: 'injection', title: 'Inject B' });
    });
    const { container } = render(<ECInjectionChip />);
    expect(container.querySelector('[data-component="ec-injection-chip"]')?.textContent).toContain(
      'Injections (2)'
    );
  });

  it("clicking the chip sets ecInspectorTab to 'injections'", () => {
    act(() => useDocumentStore.getState().newDocument('ec'));
    const { container } = render(<ECInjectionChip />);
    const chip = container.querySelector(
      '[data-component="ec-injection-chip"]'
    ) as HTMLButtonElement;
    expect(useDocumentStore.getState().ecInspectorTab).toBe('inspector');
    act(() => fireEvent.click(chip));
    expect(useDocumentStore.getState().ecInspectorTab).toBe('injections');
  });
});
