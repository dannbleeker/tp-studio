import { act, cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { Inspector } from '@/components/inspector/Inspector';
import { resetStoreForTest, useDocumentStore } from '@/store';
import { seedEntity } from '../helpers/seedDoc';

beforeEach(resetStoreForTest);
afterEach(cleanup);

describe('Inspector', () => {
  it('stays hidden (translate-x-full) when nothing is selected', () => {
    const { container } = render(<Inspector />);
    const aside = container.querySelector('aside')!;
    expect(aside.className).toContain('translate-x-full');
    expect(aside.getAttribute('aria-hidden')).toBe('true');
    // A closed aria-hidden panel MUST also be `inert` so its focusable children
    // leave the tab order (axe `aria-hidden-focus`). `inert` must be a real
    // boolean prop — React 19.2 drops an empty-string `inert=""` as a false
    // boolean attribute, which is the regression this guards.
    expect(aside.hasAttribute('inert')).toBe(true);
  });

  it('shows the EntityInspector when a single entity is selected', () => {
    const a = seedEntity('Order entry is manual');
    act(() => useDocumentStore.getState().selectEntity(a.id));
    const { container, getByText } = render(<Inspector />);
    const aside = container.querySelector('aside')!;
    expect(aside.className).not.toContain('translate-x-full');
    // Header label
    expect(getByText('Entity')).toBeTruthy();
    // Title field is pre-filled with the entity's title
    const title = container.querySelector('textarea') as HTMLTextAreaElement;
    expect(title.value).toBe('Order entry is manual');
  });

  it('shows the multi-selection summary when two entities are selected', () => {
    const a = seedEntity('A');
    const b = seedEntity('B');
    act(() => useDocumentStore.getState().selectEntities([a.id, b.id]));
    const { container, getByText } = render(<Inspector />);
    expect(getByText('2 entities')).toBeTruthy();
    // Multi panel reports the entities-selected line.
    expect(container.textContent).toContain('2 entities selected');
    // Convert-all and bulk delete buttons land in the multi view.
    expect(container.textContent).toContain('Convert all to');
    expect(container.textContent).toContain('Delete 2 entities');
  });

  it('shows the GroupInspector when a single group id is selected', () => {
    const a = seedEntity('A');
    const g = useDocumentStore
      .getState()
      .createGroupFromSelection([a.id], { title: 'My Group', color: 'amber' });
    if (!g) throw new Error('group not created');
    // Session 85 (#1) — `selectGroup` brands the id correctly into
    // the new `Selection` `groups` variant; previously this used
    // `selectEntity(g.id)` and relied on cross-detection.
    act(() => useDocumentStore.getState().selectGroup(g.id));
    const { container, getByText } = render(<Inspector />);
    expect(getByText('Group')).toBeTruthy();
    // Group rename input is pre-filled.
    const titleInput = container.querySelector('input[type="text"]') as HTMLInputElement;
    expect(titleInput.value).toBe('My Group');
  });

  it('Close button (X) clears the selection', () => {
    const a = seedEntity('A');
    act(() => useDocumentStore.getState().selectEntity(a.id));
    const { container } = render(<Inspector />);
    const closeBtn = container.querySelector('button[aria-label="Close inspector"]')!;
    act(() => fireEvent.click(closeBtn));
    expect(useDocumentStore.getState().selection.kind).toBe('none');
  });

  it('renders a narrow-viewport dismiss backdrop that clears the selection', () => {
    // The backdrop is the tap-to-dismiss surface that overlays the canvas
    // when the inspector is open at < md. Session 135 (design audit #22/
    // #25) — it's now always mounted (faded out + pointer-events-none
    // when closed) and `aria-hidden` (pointer-only convenience), so we
    // pin it via `data-component` + the `data-open` flag.
    const a = seedEntity('A');
    act(() => useDocumentStore.getState().selectEntity(a.id));
    const { container } = render(<Inspector />);
    const backdrop = container.querySelector('[data-component="inspector-backdrop"]');
    expect(backdrop).toBeTruthy();
    expect(backdrop?.getAttribute('data-open')).toBe('true');
    act(() => fireEvent.click(backdrop!));
    expect(useDocumentStore.getState().selection.kind).toBe('none');
  });

  it('the dismiss backdrop is inert (closed) when nothing is selected', () => {
    const { container } = render(<Inspector />);
    // Always in the DOM now, but with no `data-open` flag and
    // pointer-events-none so it can't intercept canvas clicks.
    const backdrop = container.querySelector('[data-component="inspector-backdrop"]');
    expect(backdrop).toBeTruthy();
    expect(backdrop?.getAttribute('data-open')).toBeNull();
    expect(backdrop?.className).toContain('pointer-events-none');
  });

  it('renders the Edit/Preview toggle for the description field', () => {
    const a = seedEntity('A');
    act(() => useDocumentStore.getState().selectEntity(a.id));
    const { container } = render(<Inspector />);
    const toggles = Array.from(container.querySelectorAll('button[aria-pressed]')).filter((b) =>
      /Edit|Preview/i.test(b.textContent ?? '')
    );
    expect(toggles.length).toBe(2);
  });

  // Session 135 / spec gap #4 Phase 1B — entity-state picker + propagation
  // surface tests. The picker writes through to the store; the
  // propagation caption only appears when the graph has signal.
  describe('entity-state picker (spec gap #4 Phase 1B)', () => {
    it('writes the selected state through to the store', () => {
      const a = seedEntity('Order entry is manual');
      act(() => useDocumentStore.getState().selectEntity(a.id));
      const { container } = render(<Inspector />);
      const picker = container.querySelector('[data-component="entity-state-picker"]');
      expect(picker).toBeTruthy();
      const trueBtn = Array.from(picker?.querySelectorAll('button') ?? []).find(
        (b) => b.textContent === 'True'
      );
      expect(trueBtn).toBeTruthy();
      act(() => fireEvent.click(trueBtn!));
      const persisted = useDocumentStore.getState().doc.entities[a.id]?.state;
      expect(persisted).toBe('true');
    });

    it('the "Unknown" button clears a previously-set state to undefined', () => {
      const a = seedEntity('Manual order entry');
      act(() => {
        useDocumentStore.getState().updateEntity(a.id, { state: 'disputed' });
        useDocumentStore.getState().selectEntity(a.id);
      });
      const { container } = render(<Inspector />);
      const picker = container.querySelector('[data-component="entity-state-picker"]');
      const unknownBtn = Array.from(picker?.querySelectorAll('button') ?? []).find(
        (b) => b.textContent === 'Unknown'
      );
      expect(unknownBtn).toBeTruthy();
      act(() => fireEvent.click(unknownBtn!));
      expect(useDocumentStore.getState().doc.entities[a.id]?.state).toBeUndefined();
    });

    it('hides the propagation caption when the graph has no signal', () => {
      // Lone entity, no edges → derived === 'unknown' AND manual is
      // undefined. The caption SHOULD NOT render.
      const a = seedEntity('Lonely');
      act(() => useDocumentStore.getState().selectEntity(a.id));
      const { container } = render(<Inspector />);
      expect(container.querySelector('[data-component="entity-state-derived"]')).toBeNull();
    });

    it('renders the propagation caption when an upstream entity drives a derived state', () => {
      // a (state=true) → b. b should derive 'true' via propagation.
      const { a, b } = seedConnectedPairForTest();
      act(() => {
        useDocumentStore.getState().updateEntity(a.id, { state: 'true' });
        useDocumentStore.getState().selectEntity(b.id);
      });
      const { container } = render(<Inspector />);
      const caption = container.querySelector('[data-component="entity-state-derived"]');
      expect(caption).toBeTruthy();
      expect(caption?.textContent ?? '').toMatch(/Graph implies.+true/);
      // Not a conflict — b has no manual state.
      expect(caption?.getAttribute('data-conflicts')).toBeNull();
    });

    it('flags a conflict when the manual claim disagrees with propagation', () => {
      // a (state=true) → b (state=false). Manual says false but graph
      // implies true. Conflict flag fires.
      const { a, b } = seedConnectedPairForTest();
      act(() => {
        useDocumentStore.getState().updateEntity(a.id, { state: 'true' });
        useDocumentStore.getState().updateEntity(b.id, { state: 'false' });
        useDocumentStore.getState().selectEntity(b.id);
      });
      const { container } = render(<Inspector />);
      const caption = container.querySelector('[data-component="entity-state-derived"]');
      expect(caption).toBeTruthy();
      expect(caption?.getAttribute('data-conflicts')).toBe('true');
      expect(caption?.textContent ?? '').toMatch(/Graph implies.+true.+claim is.+false/i);
    });
  });
});

// Inline helper — avoids pulling the full seedConnectedPair from
// helpers/seedDoc just to keep this test block self-contained.
function seedConnectedPairForTest() {
  const a = seedEntity('Cause');
  const b = seedEntity('Effect');
  const edge = useDocumentStore.getState().connect(a.id, b.id);
  if (!edge) throw new Error('connect failed');
  return { a, b, edge };
}
