import { ContextMenu } from '@/components/canvas/ContextMenu';
import type { EntityId } from '@/domain/types';
import { resetStoreForTest, useDocumentStore } from '@/store';
import { act, cleanup, fireEvent, render } from '@testing-library/react';
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

  // Session 88 (S15) — keyboard navigation. ArrowDown / ArrowUp walks
  // focusable menuitems; Home / End jump to the bookends.
  describe('keyboard navigation (Session 88 S15)', () => {
    const setup = () => {
      const a = useDocumentStore.getState().addEntity({ type: 'effect', title: 'A' });
      openOnEntity(a.id);
      const result = render(<ContextMenu />);
      const items = result.container.querySelectorAll<HTMLButtonElement>('button[role="menuitem"]');
      if (items.length < 3) throw new Error('expected at least 3 menuitems');
      return { ...result, items };
    };

    it('ArrowDown moves focus down the menu items', () => {
      const { container, items } = setup();
      const menu = container.querySelector('[role="menu"]') as HTMLDivElement;
      // First item should be focused on open (auto-focus via queueMicrotask).
      // Simulate the sequence the user would experience: send ArrowDown
      // events to the focused element / menu and check focus progresses.
      items[0]?.focus();
      act(() => {
        fireEvent.keyDown(menu, { key: 'ArrowDown' });
      });
      expect(document.activeElement).toBe(items[1]);
      act(() => {
        fireEvent.keyDown(menu, { key: 'ArrowDown' });
      });
      expect(document.activeElement).toBe(items[2]);
    });

    it('ArrowUp wraps from the first item to the last', () => {
      const { container, items } = setup();
      const menu = container.querySelector('[role="menu"]') as HTMLDivElement;
      items[0]?.focus();
      act(() => {
        fireEvent.keyDown(menu, { key: 'ArrowUp' });
      });
      // Index wraps: 0 - 1 → length - 1
      expect(document.activeElement).toBe(items[items.length - 1]);
    });

    it('End jumps to the last item', () => {
      const { container, items } = setup();
      const menu = container.querySelector('[role="menu"]') as HTMLDivElement;
      items[0]?.focus();
      act(() => {
        fireEvent.keyDown(menu, { key: 'End' });
      });
      expect(document.activeElement).toBe(items[items.length - 1]);
    });

    it('Home jumps to the first item', () => {
      const { container, items } = setup();
      const menu = container.querySelector('[role="menu"]') as HTMLDivElement;
      items[items.length - 1]?.focus();
      act(() => {
        fireEvent.keyDown(menu, { key: 'Home' });
      });
      expect(document.activeElement).toBe(items[0]);
    });
  });
});
