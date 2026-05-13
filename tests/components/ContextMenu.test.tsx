import { ContextMenu } from '@/components/canvas/ContextMenu';
import type { EntityId } from '@/domain/types';
import { resetStoreForTest, useDocumentStore } from '@/store';
import { act, cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

beforeEach(resetStoreForTest);
afterEach(cleanup);

const itemLabels = (container: HTMLElement): string[] =>
  Array.from(container.querySelectorAll('button[role="menuitem"]')).map(
    (b) => b.textContent?.trim() ?? ''
  );

const openOnEntity = (id: EntityId): void => {
  act(() => useDocumentStore.getState().openContextMenu({ kind: 'entity', id }, 100, 100));
};

const openOnEdge = (id: string): void => {
  act(() =>
    useDocumentStore.getState().openContextMenu({ kind: 'edge', id: id as never }, 100, 100)
  );
};

const openOnPane = (): void => {
  act(() => useDocumentStore.getState().openContextMenu({ kind: 'pane' }, 100, 100));
};

describe('ContextMenu', () => {
  it('renders nothing when closed', () => {
    const { container } = render(<ContextMenu />);
    expect(container.querySelector('[role="menu"]')).toBeNull();
  });

  it('on an entity shows add child / parent / rename / convert / delete', () => {
    const a = useDocumentStore.getState().addEntity({ type: 'effect', title: 'A' });
    openOnEntity(a.id);
    const { container } = render(<ContextMenu />);
    const labels = itemLabels(container);
    expect(labels).toContain('Add child');
    expect(labels).toContain('Add parent');
    expect(labels).toContain('Rename');
    expect(labels).toContain('Delete entity');
    // Convert headers are not buttons, but the conversion options are.
    expect(labels.some((l) => /Undesirable Effect|Root Cause/.test(l))).toBe(true);
  });

  it('on an edge shows Delete edge (and Ungroup AND when applicable)', () => {
    const a = useDocumentStore.getState().addEntity({ type: 'effect', title: 'A' });
    const b = useDocumentStore.getState().addEntity({ type: 'effect', title: 'B' });
    const c = useDocumentStore.getState().addEntity({ type: 'effect', title: 'C' });
    const e1 = useDocumentStore.getState().connect(a.id, b.id);
    const e2 = useDocumentStore.getState().connect(c.id, b.id);
    if (!e1 || !e2) throw new Error('edges missing');
    const result = useDocumentStore.getState().groupAsAnd([e1.id, e2.id]);
    if (!result.ok) throw new Error('AND grouping failed');

    openOnEdge(e1.id);
    const { container } = render(<ContextMenu />);
    const labels = itemLabels(container);
    expect(labels).toContain('Delete edge');
    expect(labels).toContain('Ungroup AND');
  });

  it('on a multi-entity selection shows bulk Convert-all + bulk Delete', () => {
    const a = useDocumentStore.getState().addEntity({ type: 'effect', title: 'A' });
    const b = useDocumentStore.getState().addEntity({ type: 'effect', title: 'B' });
    act(() => useDocumentStore.getState().selectEntities([a.id, b.id]));
    openOnEntity(a.id);
    const { container } = render(<ContextMenu />);
    const labels = itemLabels(container);
    expect(labels.some((l) => /Delete 2 entities/.test(l))).toBe(true);
    // Every entity-type option appears as a "Convert all" candidate.
    expect(labels.some((l) => /Undesirable Effect/.test(l))).toBe(true);
  });

  it('on a multi-edge selection puts "Group as AND" as the top item', () => {
    const a = useDocumentStore.getState().addEntity({ type: 'effect', title: 'A' });
    const b = useDocumentStore.getState().addEntity({ type: 'effect', title: 'B' });
    const c = useDocumentStore.getState().addEntity({ type: 'effect', title: 'C' });
    const e1 = useDocumentStore.getState().connect(a.id, c.id);
    const e2 = useDocumentStore.getState().connect(b.id, c.id);
    if (!e1 || !e2) throw new Error('edges missing');
    act(() => useDocumentStore.getState().selectEdges([e1.id, e2.id]));
    openOnEdge(e1.id);
    const { container } = render(<ContextMenu />);
    const labels = itemLabels(container);
    expect(labels[0]).toBe('Group as AND');
  });

  it('on the empty pane shows "New entity here"', () => {
    openOnPane();
    const { container } = render(<ContextMenu />);
    expect(itemLabels(container)).toContain('New entity here');
  });
});
