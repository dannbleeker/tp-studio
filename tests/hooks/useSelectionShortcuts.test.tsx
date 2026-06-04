import { cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { useSelectionShortcuts } from '@/hooks/useSelectionShortcuts';
import { resetStoreForTest, useDocumentStore } from '@/store';
import { seedChain, seedConnectedPair, seedEntity } from '../helpers/seedDoc';

/**
 * Session 134 coverage push (round 2) — `useSelectionShortcuts` was at
 * 37% statements / 42% lines.
 *
 * The hook attaches a window-level keydown listener that branches on
 * the live selection + key + modifier. Tests render a tiny host
 * component (so the useEffect actually runs), seed a doc, set the
 * selection, fire the relevant key, and assert the resulting store
 * mutation. Each test maps to one `// reg:` branch in the hook so the
 * test surface mirrors the hook's branching shape.
 */

const Host = () => {
  useSelectionShortcuts();
  return null;
};

beforeEach(resetStoreForTest);
afterEach(() => {
  resetStoreForTest();
  cleanup();
});

const s = () => useDocumentStore.getState();

describe('useSelectionShortcuts — Tab / Shift+Tab (add-child / add-parent)', () => {
  it('Tab on a single entity adds a child connected from the selected entity', () => {
    const parent = seedEntity('Parent');
    useDocumentStore.getState().selectEntities([parent.id]);
    render(<Host />);
    const before = Object.keys(s().doc.entities).length;
    fireEvent.keyDown(window, { key: 'Tab' });
    expect(Object.keys(s().doc.entities).length).toBe(before + 1);
    // The new entity is wired as a child: parent → new.
    expect(Object.values(s().doc.edges).some((e) => e.sourceId === parent.id)).toBe(true);
  });

  it('Shift+Tab on a single entity adds a parent wired into the selected entity', () => {
    const child = seedEntity('Child');
    useDocumentStore.getState().selectEntities([child.id]);
    render(<Host />);
    fireEvent.keyDown(window, { key: 'Tab', shiftKey: true });
    // The new entity is wired as a parent: new → child.
    expect(Object.values(s().doc.edges).some((e) => e.targetId === child.id)).toBe(true);
  });
});

describe('useSelectionShortcuts — Enter / F2 (rename / hoist)', () => {
  it('Enter on a single entity begins editing it', () => {
    const e = seedEntity('To rename');
    useDocumentStore.getState().selectEntities([e.id]);
    render(<Host />);
    fireEvent.keyDown(window, { key: 'Enter' });
    expect(s().editingEntityId).toBe(e.id);
  });

  it('Enter on a single group hoists into it', () => {
    const a = seedEntity('A');
    const b = seedEntity('B');
    const g = useDocumentStore.getState().createGroupFromSelection([a.id, b.id]);
    if (!g) throw new Error('createGroupFromSelection failed');
    useDocumentStore.getState().selectEntities([g.id]);
    render(<Host />);
    fireEvent.keyDown(window, { key: 'Enter' });
    expect(s().hoistedGroupId).toBe(g.id);
  });

  it('F2 on a single entity begins editing it', () => {
    const e = seedEntity('Rename via F2');
    useDocumentStore.getState().selectEntities([e.id]);
    render(<Host />);
    fireEvent.keyDown(window, { key: 'F2' });
    expect(s().editingEntityId).toBe(e.id);
  });

  it('F2 on a single group is a no-op (only Enter hoists)', () => {
    const a = seedEntity('A');
    const b = seedEntity('B');
    const g = useDocumentStore.getState().createGroupFromSelection([a.id, b.id]);
    if (!g) throw new Error('createGroupFromSelection failed');
    useDocumentStore.getState().selectEntities([g.id]);
    render(<Host />);
    fireEvent.keyDown(window, { key: 'F2' });
    expect(s().hoistedGroupId).not.toBe(g.id);
  });
});

describe('useSelectionShortcuts — A (add-assumption-to-edge)', () => {
  it('A on a single edge adds an assumption', () => {
    const { edge } = seedConnectedPair();
    useDocumentStore.getState().selectEdges([edge.id]);
    render(<Host />);
    fireEvent.keyDown(window, { key: 'a' });
    const after = s().doc.edges[edge.id];
    expect(after?.assumptionIds?.length ?? 0).toBeGreaterThan(0);
  });

  it('A on a non-edge selection is a no-op', () => {
    const e = seedEntity('Entity');
    useDocumentStore.getState().selectEntities([e.id]);
    render(<Host />);
    const before = Object.keys(s().doc.entities).length;
    fireEvent.keyDown(window, { key: 'a' });
    expect(Object.keys(s().doc.entities).length).toBe(before);
  });
});

describe('useSelectionShortcuts — Arrow key navigation', () => {
  it("ArrowUp moves selection to the target of the entity's outgoing edge", () => {
    const { entities } = seedChain(['Bottom', 'Mid', 'Top']);
    const bottom = entities[0]!;
    const mid = entities[1]!;
    useDocumentStore.getState().selectEntities([bottom.id]);
    render(<Host />);
    fireEvent.keyDown(window, { key: 'ArrowUp' });
    const sel = s().selection;
    expect(sel.kind).toBe('entities');
    if (sel.kind !== 'entities') return;
    expect(sel.ids).toEqual([mid.id]);
  });

  it("ArrowDown moves selection to the source of the entity's incoming edge", () => {
    const { entities } = seedChain(['A', 'B', 'C']);
    const a = entities[0]!;
    const b = entities[1]!;
    useDocumentStore.getState().selectEntities([b.id]);
    render(<Host />);
    fireEvent.keyDown(window, { key: 'ArrowDown' });
    const sel = s().selection;
    if (sel.kind !== 'entities') return;
    expect(sel.ids).toEqual([a.id]);
  });
});

describe('useSelectionShortcuts — Cmd+Shift+ArrowRight (select-successors)', () => {
  it('selects every forward-reachable entity', () => {
    const { entities } = seedChain(['Root', 'Mid', 'Leaf']);
    useDocumentStore.getState().selectEntities([entities[0]!.id]);
    render(<Host />);
    fireEvent.keyDown(window, { key: 'ArrowRight', metaKey: true, shiftKey: true });
    const sel = s().selection;
    if (sel.kind !== 'entities') return;
    expect(sel.ids.length).toBe(3);
  });
});

describe('useSelectionShortcuts — Cmd+Shift+ArrowLeft (select-predecessors)', () => {
  it('selects every backward-reachable entity', () => {
    const { entities } = seedChain(['Root', 'Mid', 'Leaf']);
    useDocumentStore.getState().selectEntities([entities[2]!.id]);
    render(<Host />);
    fireEvent.keyDown(window, { key: 'ArrowLeft', metaKey: true, shiftKey: true });
    const sel = s().selection;
    if (sel.kind !== 'entities') return;
    expect(sel.ids.length).toBe(3);
  });
});

describe('useSelectionShortcuts — keyboard ignored when typing in an input', () => {
  it('Tab inside an editable element does NOT mint an entity', () => {
    const parent = seedEntity('Parent');
    useDocumentStore.getState().selectEntities([parent.id]);
    render(
      <div>
        <input data-testid="input" />
        <Host />
      </div>
    );
    const input = document.querySelector('input') as HTMLInputElement;
    input.focus();
    const before = Object.keys(s().doc.entities).length;
    fireEvent.keyDown(input, { key: 'Tab' });
    expect(Object.keys(s().doc.entities).length).toBe(before);
  });
});

describe('useSelectionShortcuts — group expand / collapse', () => {
  it('ArrowRight expands a collapsed group', () => {
    const a = seedEntity('A');
    const b = seedEntity('B');
    const g = useDocumentStore.getState().createGroupFromSelection([a.id, b.id]);
    if (!g) throw new Error('createGroupFromSelection failed');
    // Start collapsed.
    useDocumentStore.getState().toggleGroupCollapsed(g.id);
    expect(s().doc.groups[g.id]?.collapsed).toBe(true);
    useDocumentStore.getState().selectEntities([g.id]);
    render(<Host />);
    fireEvent.keyDown(window, { key: 'ArrowRight' });
    expect(s().doc.groups[g.id]?.collapsed).toBe(false);
  });

  it('ArrowLeft collapses an expanded group', () => {
    const a = seedEntity('A');
    const b = seedEntity('B');
    const g = useDocumentStore.getState().createGroupFromSelection([a.id, b.id]);
    if (!g) throw new Error('createGroupFromSelection failed');
    useDocumentStore.getState().selectEntities([g.id]);
    render(<Host />);
    fireEvent.keyDown(window, { key: 'ArrowLeft' });
    expect(s().doc.groups[g.id]?.collapsed).toBe(true);
  });
});
