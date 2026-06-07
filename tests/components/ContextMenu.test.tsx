import { act, cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ContextMenu } from '@/components/canvas/overlays/ContextMenu';
import type { EntityId } from '@/domain/types';
import { setCanvasInstance } from '@/services/canvasRef';
import { resetStoreForTest, useDocumentStore } from '@/store';

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

const openOnEdgePicker = (ids: string[]): void => {
  act(() => useDocumentStore.getState().openContextMenu({ kind: 'edge-picker', ids }, 100, 100));
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
    // Type conversions are folded behind a "Convert to" submenu now.
    expect(labels).toContain('Convert to');
  });

  it('folds type conversions into a "Convert to" submenu that opens on hover', () => {
    const a = useDocumentStore.getState().addEntity({ type: 'effect', title: 'A' });
    openOnEntity(a.id);
    const { container } = render(<ContextMenu />);
    // Collapsed: the type options aren't rendered in the menu yet.
    expect(itemLabels(container).some((l) => /Undesirable Effect|Root Cause/.test(l))).toBe(false);
    const trigger = Array.from(
      container.querySelectorAll<HTMLButtonElement>('button[role="menuitem"]')
    ).find((b) => b.textContent?.trim() === 'Convert to');
    if (!trigger?.parentElement) throw new Error('no "Convert to" submenu trigger found');
    act(() => fireEvent.mouseEnter(trigger.parentElement as HTMLElement));
    // Open: the type options now appear in the flyout.
    expect(itemLabels(container).some((l) => /Undesirable Effect|Root Cause/.test(l))).toBe(true);
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

  it('on an edge-picker lists the overlapping edges and selects one on click (#1)', () => {
    const a = useDocumentStore.getState().addEntity({ type: 'effect', title: 'A' });
    const b = useDocumentStore.getState().addEntity({ type: 'effect', title: 'B' });
    const c = useDocumentStore.getState().addEntity({ type: 'effect', title: 'C' });
    const e1 = useDocumentStore.getState().connect(a.id, c.id);
    const e2 = useDocumentStore.getState().connect(b.id, c.id);
    if (!e1 || !e2) throw new Error('edges missing');

    openOnEdgePicker([e1.id, e2.id]);
    const { container } = render(<ContextMenu />);
    const labels = itemLabels(container);
    expect(labels).toContain('A → C');
    expect(labels).toContain('B → C');
    // The "N edges here" header is a non-interactive label, not a menuitem.
    expect(container.textContent).toContain('2 edges here');

    const item = Array.from(
      container.querySelectorAll<HTMLButtonElement>('button[role="menuitem"]')
    ).find((btn) => btn.textContent?.trim() === 'A → C');
    if (!item) throw new Error('picker item not found');
    act(() => fireEvent.click(item));
    const sel = useDocumentStore.getState().selection;
    expect(sel.kind).toBe('edges');
    expect(sel.kind === 'edges' && sel.ids[0]).toBe(e1.id);
  });

  it('on a multi-entity selection shows bulk Convert-all + bulk Delete', () => {
    const a = useDocumentStore.getState().addEntity({ type: 'effect', title: 'A' });
    const b = useDocumentStore.getState().addEntity({ type: 'effect', title: 'B' });
    act(() => useDocumentStore.getState().selectEntities([a.id, b.id]));
    openOnEntity(a.id);
    const { container } = render(<ContextMenu />);
    const labels = itemLabels(container);
    expect(labels.some((l) => /Delete 2 entities/.test(l))).toBe(true);
    // Bulk conversions are folded behind a "Convert all to" submenu.
    expect(labels).toContain('Convert all to');
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

  // ── Additional branch coverage ────────────────────────────────────────

  describe('single entity — Rename action', () => {
    it('clicking Rename calls beginEditing with the entity id', () => {
      const a = useDocumentStore.getState().addEntity({ type: 'effect', title: 'Foo' });
      openOnEntity(a.id);
      const { container } = render(<ContextMenu />);
      const btn = Array.from(
        container.querySelectorAll<HTMLButtonElement>('button[role="menuitem"]')
      ).find((b) => b.textContent?.trim() === 'Rename');
      if (!btn) throw new Error('Rename button not found');
      act(() => fireEvent.click(btn));
      // beginEditing stores the entity id in editingEntityId
      expect(useDocumentStore.getState().editingEntityId).toBe(a.id);
    });
  });

  describe('single entity — Collapse/Expand downstream', () => {
    it('shows "Collapse downstream" when the entity has outgoing edges', () => {
      const a = useDocumentStore.getState().addEntity({ type: 'effect', title: 'A' });
      const b = useDocumentStore.getState().addEntity({ type: 'effect', title: 'B' });
      const edge = useDocumentStore.getState().connect(a.id, b.id);
      if (!edge) throw new Error('connect failed');
      openOnEntity(a.id);
      const { container } = render(<ContextMenu />);
      expect(itemLabels(container)).toContain('Collapse downstream');
    });

    it('shows "Expand downstream" when the entity is already collapsed', () => {
      const a = useDocumentStore.getState().addEntity({ type: 'effect', title: 'A' });
      // Force collapsed = true
      act(() => useDocumentStore.getState().toggleEntityCollapsed(a.id));
      openOnEntity(a.id);
      const { container } = render(<ContextMenu />);
      expect(itemLabels(container)).toContain('Expand downstream');
    });

    it('does NOT show collapse/expand for an isolated entity (no edges, not collapsed)', () => {
      const a = useDocumentStore.getState().addEntity({ type: 'effect', title: 'Isolated' });
      openOnEntity(a.id);
      const { container } = render(<ContextMenu />);
      const labels = itemLabels(container);
      expect(labels).not.toContain('Collapse downstream');
      expect(labels).not.toContain('Expand downstream');
    });

    it('clicking Collapse downstream toggles the entity collapsed state', () => {
      const a = useDocumentStore.getState().addEntity({ type: 'effect', title: 'A' });
      const b = useDocumentStore.getState().addEntity({ type: 'effect', title: 'B' });
      const edge = useDocumentStore.getState().connect(a.id, b.id);
      if (!edge) throw new Error('connect failed');
      openOnEntity(a.id);
      const { container } = render(<ContextMenu />);
      const btn = Array.from(
        container.querySelectorAll<HTMLButtonElement>('button[role="menuitem"]')
      ).find((b) => b.textContent?.trim() === 'Collapse downstream');
      if (!btn) throw new Error('Collapse downstream button not found');
      act(() => fireEvent.click(btn));
      const entity = useDocumentStore.getState().doc.entities[a.id];
      expect(entity?.collapsed).toBe(true);
    });
  });

  describe('single entity — CRT diagram: Spawn EC item', () => {
    it('shows "Spawn Evaporating Cloud" only on CRT diagrams', () => {
      act(() => useDocumentStore.getState().newDocument('crt'));
      const a = useDocumentStore.getState().addEntity({ type: 'rootCause', title: 'Core Driver' });
      openOnEntity(a.id);
      const { container } = render(<ContextMenu />);
      expect(itemLabels(container)).toContain('Spawn Evaporating Cloud from this entity');
    });

    it('does NOT show "Spawn Evaporating Cloud" on non-CRT diagrams', () => {
      act(() => useDocumentStore.getState().newDocument('frt'));
      const a = useDocumentStore.getState().addEntity({ type: 'effect', title: 'A' });
      openOnEntity(a.id);
      const { container } = render(<ContextMenu />);
      expect(itemLabels(container)).not.toContain('Spawn Evaporating Cloud from this entity');
    });

    it('clicking Spawn EC creates a new EC document in store', () => {
      act(() => useDocumentStore.getState().newDocument('crt'));
      const a = useDocumentStore.getState().addEntity({ type: 'rootCause', title: 'Core Driver' });
      openOnEntity(a.id);
      const { container } = render(<ContextMenu />);
      const btn = Array.from(
        container.querySelectorAll<HTMLButtonElement>('button[role="menuitem"]')
      ).find((b) => b.textContent?.trim() === 'Spawn Evaporating Cloud from this entity');
      if (!btn) throw new Error('Spawn EC button not found');
      // After clicking, store should have changed (new EC doc or toast)
      act(() => fireEvent.click(btn));
      // The action calls setDocument with a new EC doc — diagramType becomes 'ec'
      expect(useDocumentStore.getState().doc.diagramType).toBe('ec');
    });
  });

  describe('single entity — FRT diagram: Negative Branch item', () => {
    it('shows "Start Negative Branch" only on FRT diagrams', () => {
      act(() => useDocumentStore.getState().newDocument('frt'));
      const a = useDocumentStore.getState().addEntity({ type: 'effect', title: 'A' });
      openOnEntity(a.id);
      const { container } = render(<ContextMenu />);
      expect(itemLabels(container)).toContain('Start Negative Branch from this entity');
    });

    it('does NOT show "Start Negative Branch" on non-FRT diagrams', () => {
      act(() => useDocumentStore.getState().newDocument('crt'));
      const a = useDocumentStore.getState().addEntity({ type: 'effect', title: 'A' });
      openOnEntity(a.id);
      const { container } = render(<ContextMenu />);
      expect(itemLabels(container)).not.toContain('Start Negative Branch from this entity');
    });
  });

  describe('single edge — back-edge tag toggle', () => {
    it('shows "Tag as back-edge" for a plain edge', () => {
      const a = useDocumentStore.getState().addEntity({ type: 'effect', title: 'A' });
      const b = useDocumentStore.getState().addEntity({ type: 'effect', title: 'B' });
      const e = useDocumentStore.getState().connect(a.id, b.id);
      if (!e) throw new Error('connect failed');
      openOnEdge(e.id);
      const { container } = render(<ContextMenu />);
      expect(itemLabels(container)).toContain('Tag as back-edge');
      expect(itemLabels(container)).not.toContain('Untag back-edge');
    });

    it('shows "Untag back-edge" when the edge is already tagged', () => {
      const a = useDocumentStore.getState().addEntity({ type: 'effect', title: 'A' });
      const b = useDocumentStore.getState().addEntity({ type: 'effect', title: 'B' });
      const e = useDocumentStore.getState().connect(a.id, b.id);
      if (!e) throw new Error('connect failed');
      act(() => useDocumentStore.getState().updateEdge(e.id, { isBackEdge: true }));
      openOnEdge(e.id);
      const { container } = render(<ContextMenu />);
      expect(itemLabels(container)).toContain('Untag back-edge');
      expect(itemLabels(container)).not.toContain('Tag as back-edge');
    });

    it('clicking "Tag as back-edge" sets isBackEdge on the edge', () => {
      const a = useDocumentStore.getState().addEntity({ type: 'effect', title: 'A' });
      const b = useDocumentStore.getState().addEntity({ type: 'effect', title: 'B' });
      const e = useDocumentStore.getState().connect(a.id, b.id);
      if (!e) throw new Error('connect failed');
      openOnEdge(e.id);
      const { container } = render(<ContextMenu />);
      const btn = Array.from(
        container.querySelectorAll<HTMLButtonElement>('button[role="menuitem"]')
      ).find((b) => b.textContent?.trim() === 'Tag as back-edge');
      if (!btn) throw new Error('"Tag as back-edge" button not found');
      act(() => fireEvent.click(btn));
      expect(useDocumentStore.getState().doc.edges[e.id]?.isBackEdge).toBe(true);
    });

    it('clicking "Untag back-edge" removes isBackEdge from the edge', () => {
      const a = useDocumentStore.getState().addEntity({ type: 'effect', title: 'A' });
      const b = useDocumentStore.getState().addEntity({ type: 'effect', title: 'B' });
      const e = useDocumentStore.getState().connect(a.id, b.id);
      if (!e) throw new Error('connect failed');
      act(() => useDocumentStore.getState().updateEdge(e.id, { isBackEdge: true }));
      openOnEdge(e.id);
      const { container } = render(<ContextMenu />);
      const btn = Array.from(
        container.querySelectorAll<HTMLButtonElement>('button[role="menuitem"]')
      ).find((b) => b.textContent?.trim() === 'Untag back-edge');
      if (!btn) throw new Error('"Untag back-edge" button not found');
      act(() => fireEvent.click(btn));
      expect(useDocumentStore.getState().doc.edges[e.id]?.isBackEdge).toBeUndefined();
    });
  });

  describe('single edge — delay marker toggle', () => {
    it('shows "Mark as delayed (//)" for a plain edge', () => {
      const a = useDocumentStore.getState().addEntity({ type: 'effect', title: 'A' });
      const b = useDocumentStore.getState().addEntity({ type: 'effect', title: 'B' });
      const e = useDocumentStore.getState().connect(a.id, b.id);
      if (!e) throw new Error('connect failed');
      openOnEdge(e.id);
      const { container } = render(<ContextMenu />);
      expect(itemLabels(container)).toContain('Mark as delayed (//)');
    });

    it('shows "Clear delay (//)" when the edge has delay set', () => {
      const a = useDocumentStore.getState().addEntity({ type: 'effect', title: 'A' });
      const b = useDocumentStore.getState().addEntity({ type: 'effect', title: 'B' });
      const e = useDocumentStore.getState().connect(a.id, b.id);
      if (!e) throw new Error('connect failed');
      act(() => useDocumentStore.getState().updateEdge(e.id, { delay: true }));
      openOnEdge(e.id);
      const { container } = render(<ContextMenu />);
      expect(itemLabels(container)).toContain('Clear delay (//)');
    });

    it('clicking "Mark as delayed" sets delay on the edge', () => {
      const a = useDocumentStore.getState().addEntity({ type: 'effect', title: 'A' });
      const b = useDocumentStore.getState().addEntity({ type: 'effect', title: 'B' });
      const e = useDocumentStore.getState().connect(a.id, b.id);
      if (!e) throw new Error('connect failed');
      openOnEdge(e.id);
      const { container } = render(<ContextMenu />);
      const btn = Array.from(
        container.querySelectorAll<HTMLButtonElement>('button[role="menuitem"]')
      ).find((b) => b.textContent?.trim() === 'Mark as delayed (//)');
      if (!btn) throw new Error('"Mark as delayed" button not found');
      act(() => fireEvent.click(btn));
      expect(useDocumentStore.getState().doc.edges[e.id]?.delay).toBe(true);
    });
  });

  describe('single edge — loop name item (back-edge only)', () => {
    it('shows "Name this loop…" for a back-edge without a loop name', () => {
      const a = useDocumentStore.getState().addEntity({ type: 'effect', title: 'A' });
      const b = useDocumentStore.getState().addEntity({ type: 'effect', title: 'B' });
      const e = useDocumentStore.getState().connect(a.id, b.id);
      if (!e) throw new Error('connect failed');
      act(() => useDocumentStore.getState().updateEdge(e.id, { isBackEdge: true }));
      openOnEdge(e.id);
      const { container } = render(<ContextMenu />);
      expect(itemLabels(container)).toContain('Name this loop…');
    });

    it('shows "Rename loop…" when the back-edge already has a loop name', () => {
      const a = useDocumentStore.getState().addEntity({ type: 'effect', title: 'A' });
      const b = useDocumentStore.getState().addEntity({ type: 'effect', title: 'B' });
      const e = useDocumentStore.getState().connect(a.id, b.id);
      if (!e) throw new Error('connect failed');
      act(() => useDocumentStore.getState().updateEdge(e.id, { isBackEdge: true, loopName: 'R1' }));
      openOnEdge(e.id);
      const { container } = render(<ContextMenu />);
      expect(itemLabels(container)).toContain('Rename loop…');
    });

    it('does NOT show loop-name item for a non-back-edge', () => {
      const a = useDocumentStore.getState().addEntity({ type: 'effect', title: 'A' });
      const b = useDocumentStore.getState().addEntity({ type: 'effect', title: 'B' });
      const e = useDocumentStore.getState().connect(a.id, b.id);
      if (!e) throw new Error('connect failed');
      openOnEdge(e.id);
      const { container } = render(<ContextMenu />);
      const labels = itemLabels(container);
      expect(labels).not.toContain('Name this loop…');
      expect(labels).not.toContain('Rename loop…');
    });

    it('clicking "Name this loop…" opens the inspector and selects the edge', () => {
      const a = useDocumentStore.getState().addEntity({ type: 'effect', title: 'A' });
      const b = useDocumentStore.getState().addEntity({ type: 'effect', title: 'B' });
      const e = useDocumentStore.getState().connect(a.id, b.id);
      if (!e) throw new Error('connect failed');
      act(() => useDocumentStore.getState().updateEdge(e.id, { isBackEdge: true }));
      // Hide inspector first so we can confirm it opens
      act(() => useDocumentStore.setState({ inspectorHidden: true }));
      openOnEdge(e.id);
      const { container } = render(<ContextMenu />);
      const btn = Array.from(
        container.querySelectorAll<HTMLButtonElement>('button[role="menuitem"]')
      ).find((b) => b.textContent?.trim() === 'Name this loop…');
      if (!btn) throw new Error('"Name this loop…" button not found');
      act(() => fireEvent.click(btn));
      const state = useDocumentStore.getState();
      expect(state.inspectorHidden).toBe(false);
      expect(state.selection.kind).toBe('edges');
    });
  });

  describe('single edge — Ungroup OR and Ungroup XOR', () => {
    it('shows "Ungroup OR" when the edge is part of an OR group', () => {
      const a = useDocumentStore.getState().addEntity({ type: 'effect', title: 'A' });
      const b = useDocumentStore.getState().addEntity({ type: 'effect', title: 'B' });
      const c = useDocumentStore.getState().addEntity({ type: 'effect', title: 'C' });
      const e1 = useDocumentStore.getState().connect(a.id, c.id);
      const e2 = useDocumentStore.getState().connect(b.id, c.id);
      if (!e1 || !e2) throw new Error('edges missing');
      const result = useDocumentStore.getState().groupAsOr([e1.id, e2.id]);
      if (!result.ok) throw new Error('OR grouping failed');
      openOnEdge(e1.id);
      const { container } = render(<ContextMenu />);
      expect(itemLabels(container)).toContain('Ungroup OR');
    });

    it('clicking "Ungroup OR" removes the OR group from the edge', () => {
      const a = useDocumentStore.getState().addEntity({ type: 'effect', title: 'A' });
      const b = useDocumentStore.getState().addEntity({ type: 'effect', title: 'B' });
      const c = useDocumentStore.getState().addEntity({ type: 'effect', title: 'C' });
      const e1 = useDocumentStore.getState().connect(a.id, c.id);
      const e2 = useDocumentStore.getState().connect(b.id, c.id);
      if (!e1 || !e2) throw new Error('edges missing');
      const result = useDocumentStore.getState().groupAsOr([e1.id, e2.id]);
      if (!result.ok) throw new Error('OR grouping failed');
      openOnEdge(e1.id);
      const { container } = render(<ContextMenu />);
      const btn = Array.from(
        container.querySelectorAll<HTMLButtonElement>('button[role="menuitem"]')
      ).find((b) => b.textContent?.trim() === 'Ungroup OR');
      if (!btn) throw new Error('"Ungroup OR" button not found');
      act(() => fireEvent.click(btn));
      expect(useDocumentStore.getState().doc.edges[e1.id]?.orGroupId).toBeUndefined();
    });

    it('shows "Ungroup XOR" when the edge is part of an XOR group', () => {
      const a = useDocumentStore.getState().addEntity({ type: 'effect', title: 'A' });
      const b = useDocumentStore.getState().addEntity({ type: 'effect', title: 'B' });
      const c = useDocumentStore.getState().addEntity({ type: 'effect', title: 'C' });
      const e1 = useDocumentStore.getState().connect(a.id, c.id);
      const e2 = useDocumentStore.getState().connect(b.id, c.id);
      if (!e1 || !e2) throw new Error('edges missing');
      const result = useDocumentStore.getState().groupAsXor([e1.id, e2.id]);
      if (!result.ok) throw new Error('XOR grouping failed');
      openOnEdge(e1.id);
      const { container } = render(<ContextMenu />);
      expect(itemLabels(container)).toContain('Ungroup XOR');
    });

    it('clicking "Ungroup XOR" removes the XOR group from the edge', () => {
      const a = useDocumentStore.getState().addEntity({ type: 'effect', title: 'A' });
      const b = useDocumentStore.getState().addEntity({ type: 'effect', title: 'B' });
      const c = useDocumentStore.getState().addEntity({ type: 'effect', title: 'C' });
      const e1 = useDocumentStore.getState().connect(a.id, c.id);
      const e2 = useDocumentStore.getState().connect(b.id, c.id);
      if (!e1 || !e2) throw new Error('edges missing');
      const result = useDocumentStore.getState().groupAsXor([e1.id, e2.id]);
      if (!result.ok) throw new Error('XOR grouping failed');
      openOnEdge(e1.id);
      const { container } = render(<ContextMenu />);
      const btn = Array.from(
        container.querySelectorAll<HTMLButtonElement>('button[role="menuitem"]')
      ).find((b) => b.textContent?.trim() === 'Ungroup XOR');
      if (!btn) throw new Error('"Ungroup XOR" button not found');
      act(() => fireEvent.click(btn));
      expect(useDocumentStore.getState().doc.edges[e1.id]?.xorGroupId).toBeUndefined();
    });
  });

  describe('pane — Add comment here', () => {
    it('shows "Add comment here" on the pane menu', () => {
      openOnPane();
      const { container } = render(<ContextMenu />);
      expect(itemLabels(container)).toContain('Add comment here');
    });
  });

  describe('multi-entity — Swap entities (exactly 2)', () => {
    it('shows "Swap entities" when exactly 2 entities are selected', () => {
      const a = useDocumentStore.getState().addEntity({ type: 'effect', title: 'A' });
      const b = useDocumentStore.getState().addEntity({ type: 'effect', title: 'B' });
      act(() => useDocumentStore.getState().selectEntities([a.id, b.id]));
      openOnEntity(a.id);
      const { container } = render(<ContextMenu />);
      expect(itemLabels(container)).toContain('Swap entities');
    });

    it('does NOT show "Swap entities" when 3 or more entities are selected', () => {
      const a = useDocumentStore.getState().addEntity({ type: 'effect', title: 'A' });
      const b = useDocumentStore.getState().addEntity({ type: 'effect', title: 'B' });
      const c = useDocumentStore.getState().addEntity({ type: 'effect', title: 'C' });
      act(() => useDocumentStore.getState().selectEntities([a.id, b.id, c.id]));
      openOnEntity(a.id);
      const { container } = render(<ContextMenu />);
      expect(itemLabels(container)).not.toContain('Swap entities');
    });
  });

  describe('browse-lock — write actions are blocked', () => {
    it('clicking "New entity here" while browse-locked does NOT add an entity', () => {
      act(() => useDocumentStore.getState().setBrowseLocked(true));
      openOnPane();
      const { container } = render(<ContextMenu />);
      const entityCountBefore = Object.keys(useDocumentStore.getState().doc.entities).length;
      const btn = Array.from(
        container.querySelectorAll<HTMLButtonElement>('button[role="menuitem"]')
      ).find((b) => b.textContent?.trim() === 'New entity here');
      if (!btn) throw new Error('"New entity here" button not found');
      act(() => fireEvent.click(btn));
      const entityCountAfter = Object.keys(useDocumentStore.getState().doc.entities).length;
      expect(entityCountAfter).toBe(entityCountBefore);
    });

    it('clicking "Rename" while browse-locked does NOT begin editing', () => {
      const a = useDocumentStore.getState().addEntity({ type: 'effect', title: 'A' });
      act(() => useDocumentStore.getState().setBrowseLocked(true));
      openOnEntity(a.id);
      const { container } = render(<ContextMenu />);
      const btn = Array.from(
        container.querySelectorAll<HTMLButtonElement>('button[role="menuitem"]')
      ).find((b) => b.textContent?.trim() === 'Rename');
      if (!btn) throw new Error('Rename button not found');
      act(() => fireEvent.click(btn));
      expect(useDocumentStore.getState().editingEntityId).toBeNull();
    });

    it('clicking "Tag as back-edge" while browse-locked does NOT set isBackEdge', () => {
      const a = useDocumentStore.getState().addEntity({ type: 'effect', title: 'A' });
      const b = useDocumentStore.getState().addEntity({ type: 'effect', title: 'B' });
      const e = useDocumentStore.getState().connect(a.id, b.id);
      if (!e) throw new Error('connect failed');
      act(() => useDocumentStore.getState().setBrowseLocked(true));
      openOnEdge(e.id);
      const { container } = render(<ContextMenu />);
      const btn = Array.from(
        container.querySelectorAll<HTMLButtonElement>('button[role="menuitem"]')
      ).find((b) => b.textContent?.trim() === 'Tag as back-edge');
      if (!btn) throw new Error('"Tag as back-edge" button not found');
      act(() => fireEvent.click(btn));
      expect(useDocumentStore.getState().doc.edges[e.id]?.isBackEdge).toBeUndefined();
    });
  });

  describe('edge-picker — entity titles fall back to "(untitled)" when blank', () => {
    it('shows "(untitled) → (untitled)" for edges between blank-titled entities', () => {
      const a = useDocumentStore.getState().addEntity({ type: 'effect', title: '' });
      const b = useDocumentStore.getState().addEntity({ type: 'effect', title: '' });
      const e1 = useDocumentStore.getState().connect(a.id, b.id);
      const a2 = useDocumentStore.getState().addEntity({ type: 'effect', title: '' });
      const e2 = useDocumentStore.getState().connect(a2.id, b.id);
      if (!e1 || !e2) throw new Error('connect failed');
      openOnEdgePicker([e1.id, e2.id]);
      const { container } = render(<ContextMenu />);
      const labels = itemLabels(container);
      expect(labels.filter((l) => l === '(untitled) → (untitled)').length).toBe(2);
    });
  });

  describe('multi-edge — Delete count label', () => {
    it('shows the correct count in the delete label', () => {
      const a = useDocumentStore.getState().addEntity({ type: 'effect', title: 'A' });
      const b = useDocumentStore.getState().addEntity({ type: 'effect', title: 'B' });
      const c = useDocumentStore.getState().addEntity({ type: 'effect', title: 'C' });
      const d = useDocumentStore.getState().addEntity({ type: 'effect', title: 'D' });
      const e1 = useDocumentStore.getState().connect(a.id, d.id);
      const e2 = useDocumentStore.getState().connect(b.id, d.id);
      const e3 = useDocumentStore.getState().connect(c.id, d.id);
      if (!e1 || !e2 || !e3) throw new Error('edges missing');
      act(() => useDocumentStore.getState().selectEdges([e1.id, e2.id, e3.id]));
      openOnEdge(e1.id);
      const { container } = render(<ContextMenu />);
      expect(itemLabels(container)).toContain('Delete 3 edges');
    });
  });

  describe('multi-entity — header shows entity count', () => {
    it('shows "N entities" header matching the selection size', () => {
      const a = useDocumentStore.getState().addEntity({ type: 'effect', title: 'A' });
      const b = useDocumentStore.getState().addEntity({ type: 'effect', title: 'B' });
      const c = useDocumentStore.getState().addEntity({ type: 'effect', title: 'C' });
      act(() => useDocumentStore.getState().selectEntities([a.id, b.id, c.id]));
      openOnEntity(a.id);
      const { container } = render(<ContextMenu />);
      expect(container.textContent).toContain('3 entities');
    });
  });

  // ── Pane run callbacks ────────────────────────────────────────────────────

  describe('pane — clicking "New entity here" calls addEntity', () => {
    it('clicking "New entity here" adds a new entity to the store', () => {
      openOnPane();
      const { container } = render(<ContextMenu />);
      const countBefore = Object.keys(useDocumentStore.getState().doc.entities).length;
      const btn = Array.from(
        container.querySelectorAll<HTMLButtonElement>('button[role="menuitem"]')
      ).find((b) => b.textContent?.trim() === 'New entity here');
      if (!btn) throw new Error('"New entity here" button not found');
      act(() => fireEvent.click(btn));
      const countAfter = Object.keys(useDocumentStore.getState().doc.entities).length;
      expect(countAfter).toBe(countBefore + 1);
    });
  });

  describe('pane — "Add comment here" with no canvas instance (fallback to document anchor)', () => {
    it('clicking "Add comment here" when canvas is null sets document-level pendingCommentAnchor', () => {
      // Ensure no canvas instance is registered
      setCanvasInstance(null);
      openOnPane();
      const { container } = render(<ContextMenu />);
      const btn = Array.from(
        container.querySelectorAll<HTMLButtonElement>('button[role="menuitem"]')
      ).find((b) => b.textContent?.trim() === 'Add comment here');
      if (!btn) throw new Error('"Add comment here" button not found');
      act(() => fireEvent.click(btn));
      const anchor = useDocumentStore.getState().pendingCommentAnchor;
      expect(anchor).toEqual({ kind: 'document' });
    });
  });

  describe('pane — "Add comment here" with live canvas instance (point anchor)', () => {
    it('clicking "Add comment here" when canvas has screenToFlowPosition sets point anchor', () => {
      // Provide a mock canvas instance whose screenToFlowPosition maps to flow coords.
      const mockInstance = {
        screenToFlowPosition: vi.fn(() => ({ x: 42, y: 99 })),
      };
      // Cast to unknown first to avoid strict type mismatch on the full ReactFlowInstance type.
      setCanvasInstance(mockInstance as unknown as Parameters<typeof setCanvasInstance>[0]);
      openOnPane();
      const { container } = render(<ContextMenu />);
      const btn = Array.from(
        container.querySelectorAll<HTMLButtonElement>('button[role="menuitem"]')
      ).find((b) => b.textContent?.trim() === 'Add comment here');
      if (!btn) throw new Error('"Add comment here" button not found');
      act(() => fireEvent.click(btn));
      const anchor = useDocumentStore.getState().pendingCommentAnchor;
      expect(anchor).toEqual({ kind: 'point', x: 42, y: 99 });
      // Clean up global canvas ref.
      setCanvasInstance(null);
    });
  });

  // ── Single edge — Delete edge run callback ────────────────────────────────

  describe('single edge — clicking "Delete edge" initiates deletion', () => {
    it('clicking "Delete edge" triggers confirmAndDeleteSelection (edge removed after confirm)', async () => {
      const a = useDocumentStore.getState().addEntity({ type: 'effect', title: 'A' });
      const b = useDocumentStore.getState().addEntity({ type: 'effect', title: 'B' });
      const e = useDocumentStore.getState().connect(a.id, b.id);
      if (!e) throw new Error('connect failed');
      // Select the edge so confirmAndDeleteSelection has something to act on.
      act(() => useDocumentStore.getState().selectEdge(e.id));
      openOnEdge(e.id);
      const { container } = render(<ContextMenu />);
      const btn = Array.from(
        container.querySelectorAll<HTMLButtonElement>('button[role="menuitem"]')
      ).find((b) => b.textContent?.trim() === 'Delete edge');
      if (!btn) throw new Error('"Delete edge" button not found');
      // Fire the click (confirmAndDeleteSelection is async; it opens a confirm dialog).
      act(() => fireEvent.click(btn));
      // Settle the confirm dialog that confirmAndDeleteSelection opens.
      await act(async () => {
        await new Promise<void>((resolve, reject) => {
          const start = Date.now();
          const tick = () => {
            const cur = useDocumentStore.getState().confirmDialog;
            if (cur) {
              useDocumentStore.getState().resolveConfirm(true);
              resolve();
              return;
            }
            if (Date.now() - start > 1000) {
              reject(new Error('Timeout waiting for ConfirmDialog'));
              return;
            }
            setTimeout(tick, 5);
          };
          tick();
        });
      });
      expect(useDocumentStore.getState().doc.edges[e.id]).toBeUndefined();
    });
  });

  // ── Multi-entity — Swap entities run callback ─────────────────────────────

  describe('multi-entity — clicking "Swap entities" swaps the two entities', () => {
    it('clicking "Swap entities" calls swapEntities and changes positions', () => {
      const a = useDocumentStore.getState().addEntity({ type: 'effect', title: 'A' });
      const b = useDocumentStore.getState().addEntity({ type: 'effect', title: 'B' });
      act(() => useDocumentStore.getState().selectEntities([a.id, b.id]));
      openOnEntity(a.id);
      const { container } = render(<ContextMenu />);
      const btn = Array.from(
        container.querySelectorAll<HTMLButtonElement>('button[role="menuitem"]')
      ).find((b) => b.textContent?.trim() === 'Swap entities');
      if (!btn) throw new Error('"Swap entities" button not found');
      const posABefore = useDocumentStore.getState().doc.entities[a.id]?.position;
      const posBBefore = useDocumentStore.getState().doc.entities[b.id]?.position;
      act(() => fireEvent.click(btn));
      const posAAfter = useDocumentStore.getState().doc.entities[a.id]?.position;
      const posBAfter = useDocumentStore.getState().doc.entities[b.id]?.position;
      // After swap the two entities should have exchanged positions.
      expect(posAAfter).toEqual(posBBefore);
      expect(posBAfter).toEqual(posABefore);
    });
  });

  // ── Multi-entity — Delete N entities run callback ─────────────────────────

  describe('multi-entity — clicking "Delete N entities" initiates bulk deletion', () => {
    it('clicking "Delete 2 entities" triggers confirmAndDeleteSelection', async () => {
      const a = useDocumentStore.getState().addEntity({ type: 'effect', title: 'A' });
      const b = useDocumentStore.getState().addEntity({ type: 'effect', title: 'B' });
      act(() => useDocumentStore.getState().selectEntities([a.id, b.id]));
      openOnEntity(a.id);
      const { container } = render(<ContextMenu />);
      const btn = Array.from(
        container.querySelectorAll<HTMLButtonElement>('button[role="menuitem"]')
      ).find((b) => b.textContent?.trim() === 'Delete 2 entities');
      if (!btn) throw new Error('"Delete 2 entities" button not found');
      act(() => fireEvent.click(btn));
      // Confirm the resulting dialog.
      await act(async () => {
        await new Promise<void>((resolve, reject) => {
          const start = Date.now();
          const tick = () => {
            const cur = useDocumentStore.getState().confirmDialog;
            if (cur) {
              useDocumentStore.getState().resolveConfirm(true);
              resolve();
              return;
            }
            if (Date.now() - start > 1000) {
              reject(new Error('Timeout waiting for ConfirmDialog'));
              return;
            }
            setTimeout(tick, 5);
          };
          tick();
        });
      });
      expect(useDocumentStore.getState().doc.entities[a.id]).toBeUndefined();
      expect(useDocumentStore.getState().doc.entities[b.id]).toBeUndefined();
    });
  });

  // ── Multi-entity — "Convert all to" submenu run callback ─────────────────

  describe('multi-entity — clicking a "Convert all to" submenu item updates all types', () => {
    it('clicking a type in the "Convert all to" submenu updates all selected entities', () => {
      const a = useDocumentStore.getState().addEntity({ type: 'effect', title: 'A' });
      const b = useDocumentStore.getState().addEntity({ type: 'effect', title: 'B' });
      act(() => useDocumentStore.getState().selectEntities([a.id, b.id]));
      openOnEntity(a.id);
      const { container } = render(<ContextMenu />);
      // Open the "Convert all to" submenu.
      const submenuTrigger = Array.from(
        container.querySelectorAll<HTMLButtonElement>('button[role="menuitem"]')
      ).find((b) => b.textContent?.trim() === 'Convert all to');
      if (!submenuTrigger?.parentElement) throw new Error('no "Convert all to" submenu trigger');
      act(() => fireEvent.mouseEnter(submenuTrigger.parentElement as HTMLElement));
      // Click the "Root Cause" option to convert both entities.
      const rootCauseBtn = Array.from(
        container.querySelectorAll<HTMLButtonElement>('button[role="menuitem"]')
      ).find((b) => b.textContent?.trim() === 'Root Cause');
      if (!rootCauseBtn) throw new Error('"Root Cause" type option not found in submenu');
      act(() => fireEvent.click(rootCauseBtn));
      expect(useDocumentStore.getState().doc.entities[a.id]?.type).toBe('rootCause');
      expect(useDocumentStore.getState().doc.entities[b.id]?.type).toBe('rootCause');
    });
  });

  // ── Single entity — "Convert to" submenu run callback ────────────────────

  describe('single entity — clicking a "Convert to" submenu item updates the entity type', () => {
    it('clicking a type in the "Convert to" submenu updates the entity type', () => {
      const a = useDocumentStore.getState().addEntity({ type: 'effect', title: 'A' });
      openOnEntity(a.id);
      const { container } = render(<ContextMenu />);
      // Open the "Convert to" submenu.
      const submenuTrigger = Array.from(
        container.querySelectorAll<HTMLButtonElement>('button[role="menuitem"]')
      ).find((b) => b.textContent?.trim() === 'Convert to');
      if (!submenuTrigger?.parentElement) throw new Error('no "Convert to" submenu trigger');
      act(() => fireEvent.mouseEnter(submenuTrigger.parentElement as HTMLElement));
      // Pick "Root Cause" to convert the entity.
      const rootCauseBtn = Array.from(
        container.querySelectorAll<HTMLButtonElement>('button[role="menuitem"]')
      ).find((b) => b.textContent?.trim() === 'Root Cause');
      if (!rootCauseBtn) throw new Error('"Root Cause" type option not found in submenu');
      act(() => fireEvent.click(rootCauseBtn));
      expect(useDocumentStore.getState().doc.entities[a.id]?.type).toBe('rootCause');
    });
  });

  // ── FRT — "Start Negative Branch" run callback ───────────────────────────

  describe('FRT — clicking "Start Negative Branch" creates group and shows toast', () => {
    it('clicking "Start Negative Branch" creates a group and shows success toast', () => {
      act(() => useDocumentStore.getState().newDocument('frt'));
      const a = useDocumentStore.getState().addEntity({ type: 'effect', title: 'A' });
      openOnEntity(a.id);
      const { container } = render(<ContextMenu />);
      const btn = Array.from(
        container.querySelectorAll<HTMLButtonElement>('button[role="menuitem"]')
      ).find((b) => b.textContent?.trim() === 'Start Negative Branch from this entity');
      if (!btn) throw new Error('"Start Negative Branch" button not found');
      const groupCountBefore = Object.keys(useDocumentStore.getState().doc.groups).length;
      act(() => fireEvent.click(btn));
      const groupCountAfter = Object.keys(useDocumentStore.getState().doc.groups).length;
      expect(groupCountAfter).toBe(groupCountBefore + 1);
      // A success toast should have been queued.
      expect(useDocumentStore.getState().toasts.length).toBeGreaterThan(0);
    });
  });

  // ── Edge-picker — fallback "Edge" label when edge not in doc ─────────────

  describe('edge-picker — fallback label "Edge" when id is not found in doc', () => {
    it('shows "Edge" label when the edge-picker id does not match any doc edge', () => {
      // Open a picker with a made-up id that isn't in the store.
      openOnEdgePicker(['ghost-id-1', 'ghost-id-2']);
      const { container } = render(<ContextMenu />);
      const labels = itemLabels(container);
      expect(labels.filter((l) => l === 'Edge').length).toBe(2);
    });
  });

  // ── Single entity — "Delete entity" run callback ─────────────────────────

  describe('single entity — clicking "Delete entity" initiates deletion', () => {
    it('clicking "Delete entity" on an isolated entity deletes it immediately (no confirm needed)', async () => {
      const a = useDocumentStore.getState().addEntity({ type: 'effect', title: 'A' });
      openOnEntity(a.id);
      const { container } = render(<ContextMenu />);
      const btn = Array.from(
        container.querySelectorAll<HTMLButtonElement>('button[role="menuitem"]')
      ).find((b) => b.textContent?.trim() === 'Delete entity');
      if (!btn) throw new Error('"Delete entity" button not found');
      // Isolated entity has 0 connections → confirmAndDeleteEntity skips the dialog.
      await act(async () => {
        fireEvent.click(btn);
        // Give the async delete a tick to complete.
        await Promise.resolve();
      });
      expect(useDocumentStore.getState().doc.entities[a.id]).toBeUndefined();
    });

    it('clicking "Delete entity" on a connected entity opens a confirm dialog', async () => {
      const a = useDocumentStore.getState().addEntity({ type: 'effect', title: 'A' });
      const b = useDocumentStore.getState().addEntity({ type: 'effect', title: 'B' });
      const e = useDocumentStore.getState().connect(a.id, b.id);
      if (!e) throw new Error('connect failed');
      openOnEntity(a.id);
      const { container } = render(<ContextMenu />);
      const btn = Array.from(
        container.querySelectorAll<HTMLButtonElement>('button[role="menuitem"]')
      ).find((b) => b.textContent?.trim() === 'Delete entity');
      if (!btn) throw new Error('"Delete entity" button not found');
      act(() => fireEvent.click(btn));
      // Confirm the dialog.
      await act(async () => {
        await new Promise<void>((resolve, reject) => {
          const start = Date.now();
          const tick = () => {
            const cur = useDocumentStore.getState().confirmDialog;
            if (cur) {
              useDocumentStore.getState().resolveConfirm(true);
              resolve();
              return;
            }
            if (Date.now() - start > 1000) {
              reject(new Error('Timeout waiting for ConfirmDialog'));
              return;
            }
            setTimeout(tick, 5);
          };
          tick();
        });
      });
      expect(useDocumentStore.getState().doc.entities[a.id]).toBeUndefined();
    });
  });

  // ── Single edge — Ungroup AND run callback ────────────────────────────────

  describe('single edge — clicking "Ungroup AND" removes the AND group', () => {
    it('clicking "Ungroup AND" removes andGroupId from the edge', () => {
      const a = useDocumentStore.getState().addEntity({ type: 'effect', title: 'A' });
      const b = useDocumentStore.getState().addEntity({ type: 'effect', title: 'B' });
      const c = useDocumentStore.getState().addEntity({ type: 'effect', title: 'C' });
      const e1 = useDocumentStore.getState().connect(a.id, c.id);
      const e2 = useDocumentStore.getState().connect(b.id, c.id);
      if (!e1 || !e2) throw new Error('edges missing');
      const result = useDocumentStore.getState().groupAsAnd([e1.id, e2.id]);
      if (!result.ok) throw new Error('AND grouping failed');
      openOnEdge(e1.id);
      const { container } = render(<ContextMenu />);
      const btn = Array.from(
        container.querySelectorAll<HTMLButtonElement>('button[role="menuitem"]')
      ).find((b) => b.textContent?.trim() === 'Ungroup AND');
      if (!btn) throw new Error('"Ungroup AND" button not found');
      act(() => fireEvent.click(btn));
      expect(useDocumentStore.getState().doc.edges[e1.id]?.andGroupId).toBeUndefined();
    });
  });
});
