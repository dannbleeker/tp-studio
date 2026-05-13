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

beforeEach(() => {
  resetStoreForTest();
});

afterEach(() => {
  // RTL auto-cleanup only runs when vitest globals are enabled — we have them
  // disabled, so unmount manually to keep keyboard listeners from stacking
  // across tests.
  cleanup();
});

// Resolve any open in-app confirm with `answer`. The Delete key path
// goes through `confirmAndDeleteSelection` which now uses the store's
// async `confirm()` action; tests poll for the open dialog and settle
// it. Mirrors the helper in `tests/services/confirmations.test.ts`.
const settleNextConfirm = (answer: boolean): Promise<void> =>
  new Promise<void>((resolve, reject) => {
    const start = Date.now();
    const tick = () => {
      if (useDocumentStore.getState().confirmDialog) {
        useDocumentStore.getState().resolveConfirm(answer);
        resolve();
        return;
      }
      if (Date.now() - start > 1000) {
        reject(new Error('Timeout waiting for ConfirmDialog to open'));
        return;
      }
      setTimeout(tick, 5);
    };
    tick();
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
    useDocumentStore.getState().selectEntity(e.id);
    expect(useDocumentStore.getState().selection.kind).toBe('entities');
    dispatchKey({ key: 'Escape' });
    expect(useDocumentStore.getState().selection.kind).toBe('none');
  });

  it('Escape closes the help dialog before deselecting', () => {
    render(<Harness />);
    const e = addNode('A');
    useDocumentStore.getState().selectEntity(e.id);
    useDocumentStore.getState().openHelp();
    dispatchKey({ key: 'Escape' });
    expect(useDocumentStore.getState().helpOpen).toBe(false);
    expect(useDocumentStore.getState().selection.kind).toBe('entities');
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
    useDocumentStore.getState().selectEntity(parent.id);
    dispatchKey({ key: 'Tab' });
    const doc = useDocumentStore.getState().doc;
    const edges = Object.values(doc.edges);
    expect(edges).toHaveLength(1);
    expect(edges[0]!.sourceId).toBe(parent.id);
  });

  it('Shift+Tab creates a parent (new -> selected) edge', () => {
    render(<Harness />);
    const child = addNode('Child');
    useDocumentStore.getState().selectEntity(child.id);
    dispatchKey({ key: 'Tab', shiftKey: true });
    const edges = Object.values(useDocumentStore.getState().doc.edges);
    expect(edges).toHaveLength(1);
    expect(edges[0]!.targetId).toBe(child.id);
  });

  it('Delete on a selected entity deletes after confirm', async () => {
    render(<Harness />);
    const a = addNode('A');
    const b = addNode('B');
    useDocumentStore.getState().connect(a.id, b.id);
    useDocumentStore.getState().selectEntity(a.id);
    dispatchKey({ key: 'Delete' });
    // The keystroke opens an async confirm; resolve it positively and
    // then wait one tick so the deletion side-effect lands.
    await settleNextConfirm(true);
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
