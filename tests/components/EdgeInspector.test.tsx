import { act, cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { EdgeInspector } from '@/components/inspector/EdgeInspector';
import { resetStoreForTest, useDocumentStore } from '@/store';
import { seedAndGroupable, seedConnectedPair, seedEntity } from '../helpers/seedDoc';

beforeEach(resetStoreForTest);
afterEach(cleanup);

/**
 * EdgeInspector edits a single edge: cause/effect read-out, optional mid-edge
 * label, AND-group display + ungroup, edge assumptions, and the destructive
 * delete. We drive each of those through the store and assert the panel
 * reflects what's there.
 */

describe('EdgeInspector', () => {
  it('shows the source and target entity titles', () => {
    const { edge } = seedConnectedPair();
    const { container } = render(<EdgeInspector edgeId={edge.id} warnings={[]} />);
    expect(container.textContent).toContain('Cause A');
    expect(container.textContent).toContain('Effect B');
  });

  it('typing in the label input writes through updateEdge', () => {
    const { edge } = seedConnectedPair();
    const { container } = render(<EdgeInspector edgeId={edge.id} warnings={[]} />);
    const input = container.querySelector('input[type="text"]') as HTMLInputElement;
    expect(input).toBeTruthy();
    act(() => fireEvent.change(input, { target: { value: 'because' } }));
    expect(useDocumentStore.getState().doc.edges[edge.id]?.label).toBe('because');
  });

  it('clearing the label sets it back to undefined (not empty string)', () => {
    const { edge } = seedConnectedPair();
    act(() => useDocumentStore.getState().updateEdge(edge.id, { label: 'because' }));
    const { container } = render(<EdgeInspector edgeId={edge.id} warnings={[]} />);
    const input = container.querySelector('input[type="text"]') as HTMLInputElement;
    expect(input.value).toBe('because');
    act(() => fireEvent.change(input, { target: { value: '' } }));
    expect(useDocumentStore.getState().doc.edges[edge.id]?.label).toBeUndefined();
  });

  it('AND-group field only appears when the edge has an andGroupId', () => {
    const { e1, e2 } = seedAndGroupable();
    // Solo edge: no AND-group field.
    const single = render(<EdgeInspector edgeId={e1.id} warnings={[]} />);
    expect(single.container.textContent).not.toContain('AND group');
    single.unmount();
    // Group them and re-render.
    const result = useDocumentStore.getState().groupAsAnd([e1.id, e2.id]);
    if (!result.ok) throw new Error('groupAsAnd failed');
    const grouped = render(<EdgeInspector edgeId={e1.id} warnings={[]} />);
    expect(grouped.container.textContent).toContain('AND group');
    // Design audit #8 — the inspector now shows a short `#abcd` hash of
    // the group id, not the raw nanoid.
    expect(grouped.container.textContent).toContain(`#${result.groupId.slice(0, 4)}`);
  });

  it('Ungroup button clears andGroupId on the edge', () => {
    const { e1, e2 } = seedAndGroupable();
    useDocumentStore.getState().groupAsAnd([e1.id, e2.id]);
    const { container } = render(<EdgeInspector edgeId={e1.id} warnings={[]} />);
    const ungroupBtn = Array.from(container.querySelectorAll('button')).find(
      (b) => b.textContent?.trim() === 'Ungroup'
    ) as HTMLButtonElement | undefined;
    expect(ungroupBtn).toBeTruthy();
    act(() => fireEvent.click(ungroupBtn!));
    expect(useDocumentStore.getState().doc.edges[e1.id]?.andGroupId).toBeUndefined();
  });

  it('Delete edge button removes the edge from the document', () => {
    const { edge } = seedConnectedPair();
    const { container } = render(<EdgeInspector edgeId={edge.id} warnings={[]} />);
    const del = Array.from(container.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Delete edge')
    ) as HTMLButtonElement;
    expect(del).toBeTruthy();
    act(() => fireEvent.click(del));
    expect(useDocumentStore.getState().doc.edges[edge.id]).toBeUndefined();
  });

  it('Browse Lock disables the label input and destructive buttons', () => {
    const { edge } = seedConnectedPair();
    act(() => useDocumentStore.getState().setBrowseLocked(true));
    const { container } = render(<EdgeInspector edgeId={edge.id} warnings={[]} />);
    const input = container.querySelector('input[type="text"]') as HTMLInputElement;
    expect(input.disabled).toBe(true);
    const del = Array.from(container.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Delete edge')
    ) as HTMLButtonElement;
    expect(del.disabled).toBe(true);
  });

  it('"Scrutinize against the CLR" opens the scrutiny dialog for this edge', () => {
    const { edge } = seedConnectedPair();
    const { container } = render(<EdgeInspector edgeId={edge.id} warnings={[]} />);
    const btn = Array.from(container.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Scrutinize against the CLR')
    ) as HTMLButtonElement | undefined;
    expect(btn).toBeTruthy();
    act(() => fireEvent.click(btn!));
    expect(useDocumentStore.getState().edgeScrutinyId).toBe(edge.id);
  });

  it('keeps the Scrutinize button enabled under Browse Lock (read-only review)', () => {
    const { edge } = seedConnectedPair();
    act(() => useDocumentStore.getState().setBrowseLocked(true));
    const { container } = render(<EdgeInspector edgeId={edge.id} warnings={[]} />);
    const btn = Array.from(container.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Scrutinize against the CLR')
    ) as HTMLButtonElement | undefined;
    expect(btn?.disabled).toBe(false);
  });

  it('renders nothing when the edge id no longer exists', () => {
    const { container } = render(<EdgeInspector edgeId="missing-edge-id" warnings={[]} />);
    expect(container.firstChild).toBeNull();
  });

  it('typing into the description textarea writes through updateEdge', () => {
    const { edge } = seedConnectedPair();
    const { container } = render(<EdgeInspector edgeId={edge.id} warnings={[]} />);
    // The Description field is a MarkdownField — its editor is a textarea.
    // Find it by its placeholder text.
    const textarea = Array.from(container.querySelectorAll('textarea')).find((t) =>
      t.placeholder.includes('longer explanation')
    ) as HTMLTextAreaElement | undefined;
    expect(textarea).toBeTruthy();
    act(() => fireEvent.change(textarea!, { target: { value: '**Long form** edge note.' } }));
    expect(useDocumentStore.getState().doc.edges[edge.id]?.description).toBe(
      '**Long form** edge note.'
    );
  });

  it('clearing the description writes undefined, not an empty string', () => {
    const { edge } = seedConnectedPair();
    act(() => useDocumentStore.getState().updateEdge(edge.id, { description: 'something' }));
    const { container } = render(<EdgeInspector edgeId={edge.id} warnings={[]} />);
    const textarea = Array.from(container.querySelectorAll('textarea')).find((t) =>
      t.placeholder.includes('longer explanation')
    ) as HTMLTextAreaElement;
    act(() => fireEvent.change(textarea, { target: { value: '' } }));
    expect(useDocumentStore.getState().doc.edges[edge.id]?.description).toBeUndefined();
  });

  it('Back-edge checkbox toggles the isBackEdge flag on the edge', () => {
    const { edge } = seedConnectedPair();
    const { container } = render(<EdgeInspector edgeId={edge.id} warnings={[]} />);
    const checkbox = container.querySelector(
      'input[aria-label="Tag as back-edge"]'
    ) as HTMLInputElement | null;
    expect(checkbox).toBeTruthy();
    expect(checkbox!.checked).toBe(false);
    act(() => fireEvent.click(checkbox!));
    expect(useDocumentStore.getState().doc.edges[edge.id]?.isBackEdge).toBe(true);
    // Toggling off clears the field rather than persisting `false` — keeps
    // the JSON export clean.
    act(() => fireEvent.click(checkbox!));
    expect(useDocumentStore.getState().doc.edges[edge.id]?.isBackEdge).toBeUndefined();
  });
});

describe('EdgeInspector — cause/effect re-wire dropdowns (#1)', () => {
  it('renders the cause and effect as entity dropdowns', () => {
    const { edge } = seedConnectedPair();
    const { container } = render(<EdgeInspector edgeId={edge.id} warnings={[]} />);
    expect(container.querySelector('select[aria-label="Cause (edge source)"]')).toBeTruthy();
    expect(container.querySelector('select[aria-label="Effect (edge target)"]')).toBeTruthy();
  });

  it('re-wires the edge target by picking a different effect', () => {
    const { edge, a } = seedConnectedPair();
    const c = seedEntity('Effect C');
    const { container } = render(<EdgeInspector edgeId={edge.id} warnings={[]} />);
    const sel = container.querySelector(
      'select[aria-label="Effect (edge target)"]'
    ) as HTMLSelectElement;
    act(() => fireEvent.change(sel, { target: { value: c.id } }));
    const moved = useDocumentStore.getState().doc.edges[edge.id];
    expect(moved?.targetId).toBe(c.id);
    expect(moved?.sourceId).toBe(a.id); // source untouched
  });

  it('re-wires the edge source by picking a different cause', () => {
    const { edge, b } = seedConnectedPair();
    const c = seedEntity('Cause C');
    const { container } = render(<EdgeInspector edgeId={edge.id} warnings={[]} />);
    const sel = container.querySelector(
      'select[aria-label="Cause (edge source)"]'
    ) as HTMLSelectElement;
    act(() => fireEvent.change(sel, { target: { value: c.id } }));
    const moved = useDocumentStore.getState().doc.edges[edge.id];
    expect(moved?.sourceId).toBe(c.id);
    expect(moved?.targetId).toBe(b.id); // target untouched
  });

  it('disables the current effect in the cause dropdown (blocks a self-loop)', () => {
    const { edge, b } = seedConnectedPair();
    const { container } = render(<EdgeInspector edgeId={edge.id} warnings={[]} />);
    const sel = container.querySelector(
      'select[aria-label="Cause (edge source)"]'
    ) as HTMLSelectElement;
    const opt = Array.from(sel.options).find((o) => o.value === b.id);
    expect(opt?.disabled).toBe(true);
  });

  it('Browse Lock disables the re-wire dropdowns', () => {
    const { edge } = seedConnectedPair();
    act(() => useDocumentStore.getState().setBrowseLocked(true));
    const { container } = render(<EdgeInspector edgeId={edge.id} warnings={[]} />);
    const sel = container.querySelector(
      'select[aria-label="Cause (edge source)"]'
    ) as HTMLSelectElement;
    expect(sel.disabled).toBe(true);
  });

  it('keeps the read-only cause/effect display for a note-edge (no dropdowns)', () => {
    // A note endpoint isn't a causal cause/effect — the re-wire dropdowns are
    // suppressed and the plain title read-out stays.
    const anchor = seedEntity('Anchor');
    const note = seedEntity('A note', 'note');
    const edge = useDocumentStore.getState().connect(anchor.id, note.id);
    if (!edge) throw new Error('connect failed for note-edge');
    const { container } = render(<EdgeInspector edgeId={edge.id} warnings={[]} />);
    expect(container.querySelector('select[aria-label="Cause (edge source)"]')).toBeNull();
    expect(container.querySelector('select[aria-label="Effect (edge target)"]')).toBeNull();
    expect(container.textContent).toContain('A note');
  });
});

describe('EdgeInspector — delay checkbox', () => {
  it('delay checkbox is unchecked by default', () => {
    const { edge } = seedConnectedPair();
    const { container } = render(<EdgeInspector edgeId={edge.id} warnings={[]} />);
    const checkbox = container.querySelector(
      'input[aria-label="Mark edge as delayed"]'
    ) as HTMLInputElement | null;
    expect(checkbox).toBeTruthy();
    expect(checkbox!.checked).toBe(false);
  });

  it('checking the delay checkbox sets delay:true on the edge', () => {
    const { edge } = seedConnectedPair();
    const { container } = render(<EdgeInspector edgeId={edge.id} warnings={[]} />);
    const checkbox = container.querySelector(
      'input[aria-label="Mark edge as delayed"]'
    ) as HTMLInputElement;
    act(() => fireEvent.click(checkbox));
    expect(useDocumentStore.getState().doc.edges[edge.id]?.delay).toBe(true);
  });

  it('unchecking the delay checkbox clears delay to undefined (not false)', () => {
    const { edge } = seedConnectedPair();
    act(() => useDocumentStore.getState().updateEdge(edge.id, { delay: true }));
    const { container } = render(<EdgeInspector edgeId={edge.id} warnings={[]} />);
    const checkbox = container.querySelector(
      'input[aria-label="Mark edge as delayed"]'
    ) as HTMLInputElement;
    expect(checkbox.checked).toBe(true);
    act(() => fireEvent.click(checkbox));
    expect(useDocumentStore.getState().doc.edges[edge.id]?.delay).toBeUndefined();
  });

  it('delay checkbox is disabled under Browse Lock', () => {
    const { edge } = seedConnectedPair();
    act(() => useDocumentStore.getState().setBrowseLocked(true));
    const { container } = render(<EdgeInspector edgeId={edge.id} warnings={[]} />);
    const checkbox = container.querySelector(
      'input[aria-label="Mark edge as delayed"]'
    ) as HTMLInputElement;
    expect(checkbox.disabled).toBe(true);
  });
});

describe('EdgeInspector — polarity buttons', () => {
  it('renders four polarity options (Default, Positive, Negative, Zero)', () => {
    const { edge } = seedConnectedPair();
    const { container } = render(<EdgeInspector edgeId={edge.id} warnings={[]} />);
    const labels = ['Default', 'Positive', 'Negative', 'Zero'];
    for (const label of labels) {
      const btn = Array.from(container.querySelectorAll('button')).find(
        (b) => b.textContent?.trim() === label
      );
      expect(btn, `Expected polarity button "${label}"`).toBeTruthy();
    }
  });

  it('clicking Negative sets weight to "negative"', () => {
    const { edge } = seedConnectedPair();
    const { container } = render(<EdgeInspector edgeId={edge.id} warnings={[]} />);
    const negBtn = Array.from(container.querySelectorAll('button')).find(
      (b) => b.textContent?.trim() === 'Negative'
    ) as HTMLButtonElement;
    act(() => fireEvent.click(negBtn));
    expect(useDocumentStore.getState().doc.edges[edge.id]?.weight).toBe('negative');
  });

  it('clicking Positive sets weight to "positive"', () => {
    const { edge } = seedConnectedPair();
    const { container } = render(<EdgeInspector edgeId={edge.id} warnings={[]} />);
    const posBtn = Array.from(container.querySelectorAll('button')).find(
      (b) => b.textContent?.trim() === 'Positive'
    ) as HTMLButtonElement;
    act(() => fireEvent.click(posBtn));
    expect(useDocumentStore.getState().doc.edges[edge.id]?.weight).toBe('positive');
  });

  it('clicking Zero sets weight to "zero"', () => {
    const { edge } = seedConnectedPair();
    const { container } = render(<EdgeInspector edgeId={edge.id} warnings={[]} />);
    const zeroBtn = Array.from(container.querySelectorAll('button')).find(
      (b) => b.textContent?.trim() === 'Zero'
    ) as HTMLButtonElement;
    act(() => fireEvent.click(zeroBtn));
    expect(useDocumentStore.getState().doc.edges[edge.id]?.weight).toBe('zero');
  });

  it('clicking Default clears weight to undefined', () => {
    const { edge } = seedConnectedPair();
    act(() => useDocumentStore.getState().setEdgeWeight(edge.id, 'negative'));
    const { container } = render(<EdgeInspector edgeId={edge.id} warnings={[]} />);
    const defBtn = Array.from(container.querySelectorAll('button')).find(
      (b) => b.textContent?.trim() === 'Default'
    ) as HTMLButtonElement;
    act(() => fireEvent.click(defBtn));
    expect(useDocumentStore.getState().doc.edges[edge.id]?.weight).toBeUndefined();
  });

  it('polarity buttons are disabled under Browse Lock', () => {
    const { edge } = seedConnectedPair();
    act(() => useDocumentStore.getState().setBrowseLocked(true));
    const { container } = render(<EdgeInspector edgeId={edge.id} warnings={[]} />);
    const negBtn = Array.from(container.querySelectorAll('button')).find(
      (b) => b.textContent?.trim() === 'Negative'
    ) as HTMLButtonElement;
    expect(negBtn.disabled).toBe(true);
  });
});

describe('EdgeInspector — loop name and narrative (back-edge only)', () => {
  it('loop name and loop narrative fields do NOT render for a non-back-edge', () => {
    const { edge } = seedConnectedPair();
    const { container } = render(<EdgeInspector edgeId={edge.id} warnings={[]} />);
    expect(container.textContent).not.toContain('Loop name');
    expect(container.textContent).not.toContain('Loop behaviour over time');
  });

  it('loop name and loop narrative fields render once isBackEdge is set', () => {
    const { edge } = seedConnectedPair();
    act(() => useDocumentStore.getState().updateEdge(edge.id, { isBackEdge: true }));
    const { container } = render(<EdgeInspector edgeId={edge.id} warnings={[]} />);
    expect(container.textContent).toContain('Loop name');
    expect(container.textContent).toContain('Loop behaviour over time');
  });

  it('typing in the loop name input writes through updateEdge', () => {
    const { edge } = seedConnectedPair();
    act(() => useDocumentStore.getState().updateEdge(edge.id, { isBackEdge: true }));
    const { container } = render(<EdgeInspector edgeId={edge.id} warnings={[]} />);
    // Find the loop name input by its placeholder text.
    const input = Array.from(container.querySelectorAll('input[type="text"]')).find((i) =>
      (i as HTMLInputElement).placeholder?.includes('Burnout spiral')
    ) as HTMLInputElement | undefined;
    expect(input, 'Expected loop name input with burnout spiral placeholder').toBeTruthy();
    act(() => fireEvent.change(input!, { target: { value: 'Burnout loop' } }));
    expect(useDocumentStore.getState().doc.edges[edge.id]?.loopName).toBe('Burnout loop');
  });

  it('clearing the loop name sets it to undefined (not empty string)', () => {
    const { edge } = seedConnectedPair();
    act(() =>
      useDocumentStore.getState().updateEdge(edge.id, { isBackEdge: true, loopName: 'Growth' })
    );
    const { container } = render(<EdgeInspector edgeId={edge.id} warnings={[]} />);
    const input = Array.from(container.querySelectorAll('input[type="text"]')).find((i) =>
      (i as HTMLInputElement).placeholder?.includes('Burnout spiral')
    ) as HTMLInputElement;
    act(() => fireEvent.change(input, { target: { value: '' } }));
    expect(useDocumentStore.getState().doc.edges[edge.id]?.loopName).toBeUndefined();
  });

  it('typing into the loop narrative textarea writes through updateEdge', () => {
    const { edge } = seedConnectedPair();
    act(() => useDocumentStore.getState().updateEdge(edge.id, { isBackEdge: true }));
    const { container } = render(<EdgeInspector edgeId={edge.id} warnings={[]} />);
    const textarea = Array.from(container.querySelectorAll('textarea')).find((t) =>
      t.placeholder.includes('how this loop plays out')
    ) as HTMLTextAreaElement | undefined;
    expect(textarea, 'Expected loop narrative textarea').toBeTruthy();
    act(() => fireEvent.change(textarea!, { target: { value: 'escalates over months' } }));
    expect(useDocumentStore.getState().doc.edges[edge.id]?.loopNarrative).toBe(
      'escalates over months'
    );
  });

  it('clearing the loop narrative sets it to undefined', () => {
    const { edge } = seedConnectedPair();
    act(() =>
      useDocumentStore.getState().updateEdge(edge.id, {
        isBackEdge: true,
        loopNarrative: 'some story',
      })
    );
    const { container } = render(<EdgeInspector edgeId={edge.id} warnings={[]} />);
    const textarea = Array.from(container.querySelectorAll('textarea')).find((t) =>
      t.placeholder.includes('how this loop plays out')
    ) as HTMLTextAreaElement;
    act(() => fireEvent.change(textarea, { target: { value: '' } }));
    expect(useDocumentStore.getState().doc.edges[edge.id]?.loopNarrative).toBeUndefined();
  });
});

describe('EdgeInspector — mutual exclusion checkbox', () => {
  it('mutex field does NOT render when source is not a want', () => {
    // Default seedConnectedPair creates 'effect' entities.
    const { edge } = seedConnectedPair();
    const { container } = render(<EdgeInspector edgeId={edge.id} warnings={[]} />);
    expect(container.textContent).not.toContain('Mutual exclusion');
  });

  it('mutex field does NOT render when only one endpoint is a want', () => {
    const want = seedEntity('My Want', 'want');
    const effect = seedEntity('Not a Want', 'effect');
    const edge = useDocumentStore.getState().connect(want.id, effect.id);
    if (!edge) throw new Error('connect failed');
    const { container } = render(<EdgeInspector edgeId={edge.id} warnings={[]} />);
    expect(container.textContent).not.toContain('Mutual exclusion');
  });

  it('mutex field renders when both source and target are wants', () => {
    const wantA = seedEntity('Want A', 'want');
    const wantB = seedEntity('Want B', 'want');
    const edge = useDocumentStore.getState().connect(wantA.id, wantB.id);
    if (!edge) throw new Error('connect failed');
    const { container } = render(<EdgeInspector edgeId={edge.id} warnings={[]} />);
    expect(container.textContent).toContain('Mutual exclusion');
  });

  it('checking the mutex checkbox sets isMutualExclusion:true on the edge', () => {
    const wantA = seedEntity('Want A', 'want');
    const wantB = seedEntity('Want B', 'want');
    const edge = useDocumentStore.getState().connect(wantA.id, wantB.id);
    if (!edge) throw new Error('connect failed');
    const { container } = render(<EdgeInspector edgeId={edge.id} warnings={[]} />);
    // The mutex checkbox has no aria-label; find it by the nearby label text.
    const mutexLabel = Array.from(container.querySelectorAll('label')).find((l) =>
      l.textContent?.includes('mutually exclusive')
    );
    expect(mutexLabel, 'Expected mutex label element').toBeTruthy();
    const mutexCheckbox = mutexLabel!.querySelector('input[type="checkbox"]') as HTMLInputElement;
    expect(mutexCheckbox).toBeTruthy();
    act(() => fireEvent.click(mutexCheckbox));
    expect(useDocumentStore.getState().doc.edges[edge.id]?.isMutualExclusion).toBe(true);
  });

  it('unchecking the mutex checkbox clears isMutualExclusion to undefined', () => {
    const wantA = seedEntity('Want A', 'want');
    const wantB = seedEntity('Want B', 'want');
    const edge = useDocumentStore.getState().connect(wantA.id, wantB.id);
    if (!edge) throw new Error('connect failed');
    act(() => useDocumentStore.getState().updateEdge(edge.id, { isMutualExclusion: true }));
    const { container } = render(<EdgeInspector edgeId={edge.id} warnings={[]} />);
    const mutexLabel = Array.from(container.querySelectorAll('label')).find((l) =>
      l.textContent?.includes('mutually exclusive')
    );
    const mutexCheckbox = mutexLabel!.querySelector('input[type="checkbox"]') as HTMLInputElement;
    expect(mutexCheckbox.checked).toBe(true);
    act(() => fireEvent.click(mutexCheckbox));
    expect(useDocumentStore.getState().doc.edges[edge.id]?.isMutualExclusion).toBeUndefined();
  });
});

describe('EdgeInspector — OR and XOR junctor groups', () => {
  it('OR-group field only appears when the edge has an orGroupId', () => {
    const { edge } = seedConnectedPair();
    const single = render(<EdgeInspector edgeId={edge.id} warnings={[]} />);
    expect(single.container.textContent).not.toContain('OR group');
    single.unmount();
    act(() => useDocumentStore.getState().updateEdge(edge.id, { orGroupId: 'or-grp-1234abcd' }));
    const grouped = render(<EdgeInspector edgeId={edge.id} warnings={[]} />);
    expect(grouped.container.textContent).toContain('OR group');
    expect(grouped.container.textContent).toContain('#or-g');
  });

  it('XOR-group field only appears when the edge has an xorGroupId', () => {
    const { edge } = seedConnectedPair();
    const single = render(<EdgeInspector edgeId={edge.id} warnings={[]} />);
    expect(single.container.textContent).not.toContain('XOR group');
    single.unmount();
    act(() => useDocumentStore.getState().updateEdge(edge.id, { xorGroupId: 'xor-grp-1234abcd' }));
    const grouped = render(<EdgeInspector edgeId={edge.id} warnings={[]} />);
    expect(grouped.container.textContent).toContain('XOR group');
    expect(grouped.container.textContent).toContain('#xor-');
  });

  it('Ungroup button in OR-group field clears orGroupId', () => {
    const { e1, e2 } = seedAndGroupable();
    // Use updateEdge to directly assign an orGroupId to both edges (mimic store behavior).
    act(() => {
      useDocumentStore.getState().updateEdge(e1.id, { orGroupId: 'test-or-abcd' });
      useDocumentStore.getState().updateEdge(e2.id, { orGroupId: 'test-or-abcd' });
    });
    const { container } = render(<EdgeInspector edgeId={e1.id} warnings={[]} />);
    const ungroupBtn = Array.from(container.querySelectorAll('button')).find(
      (b) => b.textContent?.trim() === 'Ungroup'
    ) as HTMLButtonElement | undefined;
    expect(ungroupBtn).toBeTruthy();
    act(() => fireEvent.click(ungroupBtn!));
    expect(useDocumentStore.getState().doc.edges[e1.id]?.orGroupId).toBeUndefined();
  });

  it('Ungroup button in XOR-group field clears xorGroupId', () => {
    const { e1, e2 } = seedAndGroupable();
    act(() => {
      useDocumentStore.getState().updateEdge(e1.id, { xorGroupId: 'test-xor-abcd' });
      useDocumentStore.getState().updateEdge(e2.id, { xorGroupId: 'test-xor-abcd' });
    });
    const { container } = render(<EdgeInspector edgeId={e1.id} warnings={[]} />);
    const ungroupBtn = Array.from(container.querySelectorAll('button')).find(
      (b) => b.textContent?.trim() === 'Ungroup'
    ) as HTMLButtonElement | undefined;
    expect(ungroupBtn).toBeTruthy();
    act(() => fireEvent.click(ungroupBtn!));
    expect(useDocumentStore.getState().doc.edges[e1.id]?.xorGroupId).toBeUndefined();
  });
});

describe('EdgeInspector — duplicate-edge toast on rewire', () => {
  it('re-wiring to an already-connected pair triggers a toast (not a crash)', () => {
    // Seed A → B and A → C; then try to rewire A→C to target B (which already has an edge from A).
    const a = seedEntity('A');
    const b = seedEntity('B');
    const c = seedEntity('C');
    const state = useDocumentStore.getState();
    const edgeAB = state.connect(a.id, b.id);
    const edgeAC = state.connect(a.id, c.id);
    if (!edgeAB || !edgeAC) throw new Error('connect failed');
    const { container } = render(<EdgeInspector edgeId={edgeAC.id} warnings={[]} />);
    const sel = container.querySelector(
      'select[aria-label="Effect (edge target)"]'
    ) as HTMLSelectElement;
    // Try to change the target of A→C to B (already connected).
    act(() => fireEvent.change(sel, { target: { value: b.id } }));
    // The edge should remain A→C (no reconnect happened).
    const unchanged = useDocumentStore.getState().doc.edges[edgeAC.id];
    expect(unchanged?.targetId).toBe(c.id);
    // A toast should have been queued.
    expect(useDocumentStore.getState().toasts.length).toBeGreaterThan(0);
  });
});

describe('AssumptionWell — EC "…because" prefix', () => {
  it('seeds new EC assumptions with "…because " and leaves CRT assumptions empty', () => {
    // Set up an EC doc with an edge.
    useDocumentStore.getState().newDocument('ec');
    const { a, b } = seedConnectedPair('Cause', 'Effect');
    // Now the document is EC-typed but the seedConnectedPair created two
    // entities in the EC doc.
    const newDoc = useDocumentStore.getState().doc;
    const ecEdge = Object.values(newDoc.edges).find(
      (e) => e.sourceId === a.id && e.targetId === b.id
    );
    expect(ecEdge).toBeTruthy();
    if (!ecEdge) return;

    const { container, unmount } = render(<EdgeInspector edgeId={ecEdge.id} warnings={[]} />);
    const newBtn = Array.from(container.querySelectorAll('button')).find((btn) =>
      btn.textContent?.includes('New assumption')
    ) as HTMLButtonElement | undefined;
    expect(newBtn).toBeTruthy();
    act(() => fireEvent.click(newBtn!));
    // The just-created assumption should carry the EC prefix.
    const assns = Object.values(useDocumentStore.getState().doc.assumptions ?? {});
    expect(assns).toHaveLength(1);
    expect(assns[0]?.text).toBe('…because ');
    unmount();
  });

  it('does not prefix on non-EC diagrams', () => {
    // Default is CRT.
    const { edge } = seedConnectedPair();
    const { container } = render(<EdgeInspector edgeId={edge.id} warnings={[]} />);
    const newBtn = Array.from(container.querySelectorAll('button')).find((btn) =>
      btn.textContent?.includes('New assumption')
    ) as HTMLButtonElement | undefined;
    act(() => fireEvent.click(newBtn!));
    const assns = Object.values(useDocumentStore.getState().doc.assumptions ?? {});
    expect(assns).toHaveLength(1);
    // CRT assumptions still start empty.
    expect(assns[0]?.text).toBe('');
  });
});
