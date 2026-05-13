import { EdgeInspector } from '@/components/inspector/EdgeInspector';
import { resetStoreForTest, useDocumentStore } from '@/store';
import { act, cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { seedAndGroupable, seedConnectedPair } from '../helpers/seedDoc';

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
    expect(grouped.container.textContent).toContain(result.groupId);
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
    const checkbox = container.querySelector('input[type="checkbox"]') as HTMLInputElement | null;
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

describe('EdgeAssumptions — EC "…because" prefix', () => {
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
    const assns = Object.values(useDocumentStore.getState().doc.entities).filter(
      (e) => e.type === 'assumption'
    );
    expect(assns).toHaveLength(1);
    expect(assns[0]?.title).toBe('…because ');
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
    const assns = Object.values(useDocumentStore.getState().doc.entities).filter(
      (e) => e.type === 'assumption'
    );
    expect(assns).toHaveLength(1);
    // CRT assumptions still start empty.
    expect(assns[0]?.title).toBe('');
  });
});
