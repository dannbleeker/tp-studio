import { useGlobalKeyboard } from '@/hooks/useGlobalKeyboard';
import { resetStoreForTest, useDocumentStore } from '@/store';
import { act, cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

const Harness = () => {
  useGlobalKeyboard();
  return null;
};

const dispatchKey = (init: KeyboardEventInit & { key: string }) =>
  act(() => {
    window.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, ...init }));
  });

const addNode = (title = 'Node') =>
  useDocumentStore.getState().addEntity({ type: 'effect', title });

const originalConfirm = globalThis.confirm;

beforeEach(() => {
  resetStoreForTest();
  globalThis.confirm = () => true;
});

afterEach(() => {
  // RTL auto-cleanup only runs when vitest globals are enabled — we have them
  // disabled, so unmount manually to keep keyboard listeners from stacking
  // across tests.
  cleanup();
  globalThis.confirm = originalConfirm;
});

describe('useGlobalKeyboard', () => {
  it('Cmd+K toggles the command palette', () => {
    render(<Harness />);
    expect(useDocumentStore.getState().paletteOpen).toBe(false);
    dispatchKey({ key: 'k', ctrlKey: true });
    expect(useDocumentStore.getState().paletteOpen).toBe(true);
    dispatchKey({ key: 'k', ctrlKey: true });
    expect(useDocumentStore.getState().paletteOpen).toBe(false);
  });

  it('Cmd+E opens the palette pre-filtered to "Export"', () => {
    render(<Harness />);
    dispatchKey({ key: 'e', ctrlKey: true });
    const state = useDocumentStore.getState();
    expect(state.paletteOpen).toBe(true);
    expect(state.paletteInitialQuery).toBe('Export');
  });

  it('Cmd+S surfaces a "Saved" toast', () => {
    render(<Harness />);
    dispatchKey({ key: 's', ctrlKey: true });
    const toasts = useDocumentStore.getState().toasts;
    expect(toasts).toHaveLength(1);
    expect(toasts[0]!.message).toMatch(/Saved/i);
  });

  it('Escape deselects when nothing else is open', () => {
    render(<Harness />);
    const e = addNode('A');
    useDocumentStore.getState().select({ kind: 'entity', id: e.id });
    expect(useDocumentStore.getState().selection.kind).toBe('entity');
    dispatchKey({ key: 'Escape' });
    expect(useDocumentStore.getState().selection.kind).toBe('none');
  });

  it('Escape closes the help dialog before deselecting', () => {
    render(<Harness />);
    const e = addNode('A');
    useDocumentStore.getState().select({ kind: 'entity', id: e.id });
    useDocumentStore.getState().openHelp();
    dispatchKey({ key: 'Escape' });
    expect(useDocumentStore.getState().helpOpen).toBe(false);
    expect(useDocumentStore.getState().selection.kind).toBe('entity');
  });

  it('Cmd+Z undoes the last mutation', () => {
    render(<Harness />);
    const e = addNode('A');
    dispatchKey({ key: 'z', ctrlKey: true });
    expect(useDocumentStore.getState().doc.entities[e.id]).toBeUndefined();
  });

  it('Cmd+Shift+Z redoes', () => {
    render(<Harness />);
    const e = addNode('A');
    useDocumentStore.getState().undo();
    dispatchKey({ key: 'z', ctrlKey: true, shiftKey: true });
    expect(useDocumentStore.getState().doc.entities[e.id]).toBeDefined();
  });

  it('Tab on a selected entity creates a child and connects it', () => {
    render(<Harness />);
    const parent = addNode('Parent');
    useDocumentStore.getState().select({ kind: 'entity', id: parent.id });
    dispatchKey({ key: 'Tab' });
    const doc = useDocumentStore.getState().doc;
    const edges = Object.values(doc.edges);
    expect(edges).toHaveLength(1);
    expect(edges[0]!.sourceId).toBe(parent.id);
  });

  it('Shift+Tab creates a parent (new -> selected) edge', () => {
    render(<Harness />);
    const child = addNode('Child');
    useDocumentStore.getState().select({ kind: 'entity', id: child.id });
    dispatchKey({ key: 'Tab', shiftKey: true });
    const edges = Object.values(useDocumentStore.getState().doc.edges);
    expect(edges).toHaveLength(1);
    expect(edges[0]!.targetId).toBe(child.id);
  });

  it('Delete on a selected entity deletes after confirm', () => {
    render(<Harness />);
    const a = addNode('A');
    const b = addNode('B');
    useDocumentStore.getState().connect(a.id, b.id);
    useDocumentStore.getState().select({ kind: 'entity', id: a.id });
    dispatchKey({ key: 'Delete' });
    expect(useDocumentStore.getState().doc.entities[a.id]).toBeUndefined();
  });

  it('keyboard handlers do not fire while typing into an input', () => {
    const { container } = render(
      <>
        <input data-testid="probe" />
        <Harness />
      </>
    );
    const input = container.querySelector('input');
    input?.focus();
    act(() => {
      input?.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'z', ctrlKey: true, bubbles: true })
      );
    });
    // The undo handler bails out when the focus is in an editable target,
    // so the past stack stays at zero entries even after Ctrl+Z.
    expect(useDocumentStore.getState().past.length).toBe(0);
  });
});
