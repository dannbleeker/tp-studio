import { act, cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { CreationWizardPanel } from '@/components/canvas/wizards/CreationWizardPanel';
import { resetStoreForTest, useDocumentStore } from '@/store';

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

/**
 * Session 197 (backlog D1) — optional cloud-type wizard modes. The load-bearing
 * requirement is that the DEFAULT stays exactly the current generic wizard;
 * per-type modes are opt-in via the cloud-type selector.
 */
describe('CreationWizardPanel — EC cloud-type modes (D1)', () => {
  const openEC = () => {
    act(() => useDocumentStore.getState().newDocument('ec'));
    return render(<CreationWizardPanel />);
  };
  const cloudSelect = (c: HTMLElement) =>
    c.querySelector('[data-component="ec-wizard-cloud-type"] select') as HTMLSelectElement;

  it('default preservation: generic mode, order toggle present, generic prompt, no cloud-type tag', () => {
    const { container } = openEC();
    expect(cloudSelect(container).value).toBe('generic');
    // The shipped A-first/D-first toggle and the generic A prompt are unchanged.
    expect(container.querySelector('[data-component="ec-wizard-order"]')).toBeTruthy();
    expect(container.textContent).toContain('shared objective (A)');
    // No break hint, and the document is NOT tagged with a cloud type.
    expect(container.querySelector('[data-component="ec-wizard-break-hint"]')).toBeNull();
    expect(useDocumentStore.getState().doc.cloudType).toBeUndefined();
  });

  it('picking a cloud type switches the walk + prompts, hides the toggle, and tags the doc', () => {
    const { container } = openEC();
    act(() => fireEvent.change(cloudSelect(container), { target: { value: 'firefighting' } }));
    // Order toggle hidden (the type prescribes its order); break hint shown; doc tagged.
    expect(container.querySelector('[data-component="ec-wizard-order"]')).toBeNull();
    expect(
      container.querySelector('[data-component="ec-wizard-break-hint"]')?.textContent
    ).toContain('Cohen suggests');
    expect(useDocumentStore.getState().doc.cloudType).toBe('firefighting');
    // Fire-fighting leads with the endangered need B; step 0 commits to slot B.
    expect(container.textContent).toContain('put at risk');
    const ta = container.querySelector('textarea') as HTMLTextAreaElement;
    act(() => fireEvent.change(ta, { target: { value: 'Get the order shipped on time' } }));
    act(() => fireEvent.keyDown(ta, { key: 'Enter' }));
    const bSlot = Object.values(useDocumentStore.getState().doc.entities).find(
      (e) => e.ecSlot === 'b'
    );
    expect(bSlot?.title).toBe('Get the order shipped on time');
    // Slot A remains untouched (it is the last step of the fire-fighting walk).
    const aSlot = Object.values(useDocumentStore.getState().doc.entities).find(
      (e) => e.ecSlot === 'a'
    );
    expect(aSlot?.title).toBe('');
  });

  it('switching back to Generic restores the default walk and clears the tag', () => {
    const { container } = openEC();
    act(() => fireEvent.change(cloudSelect(container), { target: { value: 'ude' } }));
    expect(useDocumentStore.getState().doc.cloudType).toBe('ude');
    act(() => fireEvent.change(cloudSelect(container), { target: { value: 'generic' } }));
    expect(useDocumentStore.getState().doc.cloudType).toBeUndefined();
    expect(container.querySelector('[data-component="ec-wizard-order"]')).toBeTruthy();
  });

  it('does not leak a chosen cloud type into the next EC wizard session (review follow-up)', () => {
    // The panel never unmounts (it returns null while closed), so per-session
    // state (`mode`) must re-seed each session or a type picked for doc #1 leaks
    // into doc #2's wizard — breaking the "fresh EC wizard = generic" invariant.
    // Drive TWO sessions on the SAME mounted component (openEC renders once).
    const { container } = openEC();
    act(() => fireEvent.change(cloudSelect(container), { target: { value: 'firefighting' } }));
    expect(container.querySelector('[data-component="ec-wizard-order"]')).toBeNull(); // typed mode
    expect(useDocumentStore.getState().doc.cloudType).toBe('firefighting');

    // Start a brand-new EC on the same component — a fresh session.
    act(() => useDocumentStore.getState().newDocument('ec'));

    // Back to the generic default: select reset, order toggle back, no break
    // hint, and the new doc is untouched by the previous session's type.
    expect(cloudSelect(container).value).toBe('generic');
    expect(container.querySelector('[data-component="ec-wizard-order"]')).toBeTruthy();
    expect(container.querySelector('[data-component="ec-wizard-break-hint"]')).toBeNull();
    expect(useDocumentStore.getState().doc.cloudType).toBeUndefined();
  });
});

/**
 * Session 198 (backlog D2) — optional storyline pre-step. Default-collapsed;
 * writes to the document description; EC-only.
 */
describe('CreationWizardPanel — storyline pre-step (D2)', () => {
  it('the EC wizard has a collapsed storyline field that writes to the doc description', () => {
    act(() => useDocumentStore.getState().newDocument('ec'));
    const { container } = render(<CreationWizardPanel />);
    const details = container.querySelector(
      '[data-component="ec-wizard-storyline"]'
    ) as HTMLDetailsElement;
    expect(details).toBeTruthy();
    expect(details.open).toBe(false); // default collapsed — wizard unchanged unless opened
    const ta = details.querySelector('textarea[aria-label="Storyline"]') as HTMLTextAreaElement;
    expect(ta).toBeTruthy();
    act(() =>
      fireEvent.change(ta, {
        target: { value: 'The order was late and I was told to reset the line.' },
      })
    );
    expect(useDocumentStore.getState().doc.description).toContain('was late');
  });

  it('does not render the storyline field on a Goal Tree wizard', () => {
    act(() => useDocumentStore.getState().newDocument('goalTree'));
    const { container } = render(<CreationWizardPanel />);
    expect(container.querySelector('[data-component="ec-wizard-storyline"]')).toBeNull();
  });
});
