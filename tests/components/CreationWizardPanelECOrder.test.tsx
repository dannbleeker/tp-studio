import { CreationWizardPanel } from '@/components/canvas/CreationWizardPanel';
import { resetStoreForTest, useDocumentStore } from '@/store';
import { act, cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

beforeEach(resetStoreForTest);
afterEach(cleanup);

/**
 * Session 87 / EC PPT comparison item #3 — Reverse-direction (D-first)
 * elicitation framing.
 *
 * The default walk is A → B → C → D → D′. The D-first toggle flips
 * the slot the wizard prompts for at step 0 from A to D, mirroring
 * the BESTSELLER PPT's "start from the felt conflict" pattern.
 *
 * These tests drive the component directly, click the toggle, and
 * verify:
 *   - The default walk commits to slot A first.
 *   - With the D-first toggle on, the first commit lands in slot D.
 *   - The toggle UI is only visible on the EC wizard, not Goal Tree.
 */

describe('CreationWizardPanel — EC walk order', () => {
  it('default walk: step 0 commits the answer to slot A', () => {
    act(() => useDocumentStore.getState().newDocument('ec'));
    const { container } = render(<CreationWizardPanel />);
    const ta = container.querySelector('textarea') as HTMLTextAreaElement;
    expect(ta).toBeTruthy();
    act(() =>
      fireEvent.keyDown(ta, {
        key: 'Enter',
      })
    );
    // Pressing Enter on empty text is a no-op on step 0 (`commit`'s
    // empty-submit branch returns early for step 0). Type first.
    act(() => fireEvent.change(ta, { target: { value: 'Run a sustainable business' } }));
    act(() => fireEvent.keyDown(ta, { key: 'Enter' }));
    const aSlot = Object.values(useDocumentStore.getState().doc.entities).find(
      (e) => e.ecSlot === 'a'
    );
    expect(aSlot?.title).toBe('Run a sustainable business');
  });

  it('D-first walk: step 0 commits the answer to slot D after toggling', () => {
    act(() => useDocumentStore.getState().newDocument('ec'));
    const { container } = render(<CreationWizardPanel />);
    // The order toggle has two buttons; the unpressed one is the D-first option.
    const dFirstBtn = container.querySelector(
      '[data-component="ec-wizard-order"] button[aria-pressed="false"]'
    ) as HTMLButtonElement;
    expect(dFirstBtn).toBeTruthy();
    expect(dFirstBtn.textContent).toContain('from the conflict');
    act(() => fireEvent.click(dFirstBtn));
    // Now step 0 should prompt for D. Commit a value.
    const ta = container.querySelector('textarea') as HTMLTextAreaElement;
    act(() => fireEvent.change(ta, { target: { value: 'Ship every feature' } }));
    act(() => fireEvent.keyDown(ta, { key: 'Enter' }));
    const dSlot = Object.values(useDocumentStore.getState().doc.entities).find(
      (e) => e.ecSlot === 'd'
    );
    expect(dSlot?.title).toBe('Ship every feature');
    // The A slot should still be untouched (empty title).
    const aSlot = Object.values(useDocumentStore.getState().doc.entities).find(
      (e) => e.ecSlot === 'a'
    );
    expect(aSlot?.title).toBe('');
  });

  it('does not render the order toggle on the Goal Tree wizard', () => {
    act(() => useDocumentStore.getState().newDocument('goalTree'));
    const { container } = render(<CreationWizardPanel />);
    expect(container.querySelector('[data-component="ec-wizard-order"]')).toBeNull();
  });

  it('renders the order toggle on the EC wizard with the A-first default checked', () => {
    act(() => useDocumentStore.getState().newDocument('ec'));
    const { container } = render(<CreationWizardPanel />);
    const group = container.querySelector('[data-component="ec-wizard-order"]');
    expect(group).toBeTruthy();
    const checked = group?.querySelector('button[aria-pressed="true"]') as HTMLButtonElement;
    expect(checked.textContent).toContain('A');
  });
});
