import { cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createDocument } from '@/domain/factory';
import { useGlobalShortcuts } from '@/hooks/useGlobalShortcuts';
import { resetStoreForTest, useDocumentStore } from '@/store';
import { seedConnectedPair, seedEntity } from '../helpers/seedDoc';

/**
 * Session 134 coverage push (round 3) — `useGlobalShortcuts` was at
 * 47% statements / 48% lines. Mirror of the useSelectionShortcuts
 * test pattern from round 2 — one test per `// reg:` branch in the
 * hook source.
 *
 * Each test renders a tiny host that calls the hook (so the
 * useEffect actually attaches its window-level listener), seeds the
 * store, fires the relevant key, and asserts the resulting store
 * mutation.
 */

const Host = () => {
  useGlobalShortcuts();
  return null;
};

beforeEach(resetStoreForTest);
afterEach(() => {
  resetStoreForTest();
  cleanup();
});

const s = () => useDocumentStore.getState();

describe('useGlobalShortcuts — Cmd+K (palette)', () => {
  it('toggles the palette open', () => {
    render(<Host />);
    fireEvent.keyDown(window, { key: 'k', metaKey: true });
    expect(s().paletteOpen).toBe(true);
  });

  it('Cmd+K again closes the palette', () => {
    useDocumentStore.getState().togglePalette();
    render(<Host />);
    fireEvent.keyDown(window, { key: 'k', metaKey: true });
    expect(s().paletteOpen).toBe(false);
  });
});

describe('useGlobalShortcuts — Cmd+S (save)', () => {
  it('toasts "Saved to this browser" after Cmd+S', () => {
    render(<Host />);
    fireEvent.keyDown(window, { key: 's', metaKey: true });
    expect(s().toasts.some((t) => /Saved to this browser/i.test(t.message))).toBe(true);
  });
});

describe('useGlobalShortcuts — Cmd+Shift+S (swap-entities)', () => {
  it('swaps two selected entities', () => {
    const a = seedEntity('Alpha');
    const b = seedEntity('Beta');
    useDocumentStore.getState().selectEntities([a.id, b.id]);
    render(<Host />);
    fireEvent.keyDown(window, { key: 's', metaKey: true, shiftKey: true });
    expect(s().doc.entities[a.id]?.title).toBe('Beta');
    expect(s().doc.entities[b.id]?.title).toBe('Alpha');
  });

  it('toasts info when not exactly two entities are selected', () => {
    const a = seedEntity('Alpha');
    useDocumentStore.getState().selectEntities([a.id]);
    render(<Host />);
    fireEvent.keyDown(window, { key: 's', metaKey: true, shiftKey: true });
    expect(s().toasts.some((t) => /exactly two entities/i.test(t.message))).toBe(true);
  });
});

describe('useGlobalShortcuts — Cmd+E (export menu)', () => {
  it('opens the palette pre-filtered to "Export"', () => {
    render(<Host />);
    fireEvent.keyDown(window, { key: 'e', metaKey: true });
    expect(s().paletteOpen).toBe(true);
    expect(s().paletteInitialQuery).toBe('Export');
  });
});

describe('useGlobalShortcuts — Cmd+, (settings)', () => {
  it('opens the settings dialog', () => {
    render(<Host />);
    fireEvent.keyDown(window, { key: ',', metaKey: true });
    expect(s().settingsOpen).toBe(true);
  });
});

describe('useGlobalShortcuts — Cmd+F (find)', () => {
  it('opens the search panel', () => {
    render(<Host />);
    fireEvent.keyDown(window, { key: 'f', metaKey: true });
    expect(s().searchOpen).toBe(true);
  });
});

describe('useGlobalShortcuts — Cmd+\\ (toggle-inspector)', () => {
  it('clears the current selection', () => {
    const e = seedEntity('thing');
    useDocumentStore.getState().selectEntities([e.id]);
    expect(s().selection.kind).toBe('entities');
    render(<Host />);
    fireEvent.keyDown(window, { key: '\\', metaKey: true });
    expect(s().selection.kind).toBe('none');
  });
});

describe('useGlobalShortcuts — E (quick-capture)', () => {
  it('opens the Quick Capture dialog on bare E', () => {
    render(<Host />);
    fireEvent.keyDown(window, { key: 'e' });
    expect(s().quickCaptureOpen).toBe(true);
  });

  it('does NOT trigger when typing in an editable element', () => {
    render(
      <div>
        <input data-testid="input" />
        <Host />
      </div>
    );
    const input = document.querySelector('input') as HTMLInputElement;
    input.focus();
    fireEvent.keyDown(input, { key: 'e' });
    expect(s().quickCaptureOpen).toBe(false);
  });
});

describe('useGlobalShortcuts — Cmd+C / Cmd+X / Cmd+V (clipboard)', () => {
  it('Cmd+C copies the selection and toasts the count', () => {
    const e = seedEntity('thing');
    useDocumentStore.getState().selectEntities([e.id]);
    render(<Host />);
    fireEvent.keyDown(window, { key: 'c', metaKey: true });
    expect(s().toasts.some((t) => /Copied 1 entity/i.test(t.message))).toBe(true);
  });

  it('Cmd+X with no selection does not toast', () => {
    render(<Host />);
    fireEvent.keyDown(window, { key: 'x', metaKey: true });
    expect(s().toasts.length).toBe(0);
  });
});

describe('useGlobalShortcuts — Cmd+Z / Cmd+Shift+Z (undo/redo)', () => {
  // Note: history slice listens for `undo` / `redo` actions, not directly
  // for the keyboard shortcuts -- the hook only attaches its handler when
  // the underlying actions exist. Confirm the wiring exists by hammering
  // a mutation, then Cmd+Z, then checking the entity disappeared.
  it('Cmd+Z reverses the last mutation', () => {
    const e = seedEntity('first');
    render(<Host />);
    fireEvent.keyDown(window, { key: 'z', metaKey: true });
    expect(Object.keys(s().doc.entities)).not.toContain(e.id);
  });

  it('Cmd+Shift+Z redoes the just-undone mutation', () => {
    const e = seedEntity('first');
    render(<Host />);
    fireEvent.keyDown(window, { key: 'z', metaKey: true });
    fireEvent.keyDown(window, { key: 'z', metaKey: true, shiftKey: true });
    expect(Object.keys(s().doc.entities)).toContain(e.id);
  });
});

describe('useGlobalShortcuts — Esc cascade', () => {
  it('closes the palette when Esc is pressed and palette is open', () => {
    useDocumentStore.getState().togglePalette();
    expect(s().paletteOpen).toBe(true);
    render(<Host />);
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(s().paletteOpen).toBe(false);
  });

  it('closes the help dialog when Esc is pressed and help is open', () => {
    useDocumentStore.getState().openHelp();
    render(<Host />);
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(s().helpOpen).toBe(false);
  });

  it('clears the selection when Esc is pressed and nothing else is open', () => {
    const { edge } = seedConnectedPair();
    useDocumentStore.getState().selectEdges([edge.id]);
    render(<Host />);
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(s().selection.kind).toBe('none');
  });

  it('closes an open walkthrough on Esc WITHOUT clearing the selection', () => {
    const { edge } = seedConnectedPair();
    useDocumentStore.getState().selectEdges([edge.id]);
    useDocumentStore.getState().startReadThrough([edge.id]);
    expect(s().walkthrough.kind).toBe('read-through');
    render(<Host />);
    fireEvent.keyDown(window, { key: 'Escape' });
    // Walkthrough closes as the topmost surface…
    expect(s().walkthrough.kind).toBe('closed');
    // …and the selection survives (the bug this fixes: the walkthrough's own
    // Esc handler used to let the cascade fall through to clearSelection).
    expect(s().selection.kind).toBe('edges');
  });
});

describe('useGlobalShortcuts — tab shortcuts (installed PWA only)', () => {
  // jsdom has no `matchMedia`; stub it so the standalone gate can flip on/off.
  const stubStandalone = (on: boolean) =>
    vi.stubGlobal(
      'matchMedia',
      (q: string) =>
        ({
          matches: on && q.includes('display-mode'),
          media: q,
          onchange: null,
          addEventListener: () => {},
          removeEventListener: () => {},
          addListener: () => {},
          removeListener: () => {},
          dispatchEvent: () => false,
        }) as unknown as MediaQueryList
    );
  afterEach(() => vi.unstubAllGlobals());

  it('Cmd+T opens a new tab when standalone', () => {
    stubStandalone(true);
    const before = s().tabOrder.length;
    render(<Host />);
    fireEvent.keyDown(window, { key: 't', metaKey: true });
    expect(s().tabOrder.length).toBe(before + 1);
  });

  it('Cmd+T does nothing in a normal browser tab (not standalone)', () => {
    stubStandalone(false);
    const before = s().tabOrder.length;
    render(<Host />);
    fireEvent.keyDown(window, { key: 't', metaKey: true });
    expect(s().tabOrder.length).toBe(before);
  });

  it('Cmd+1 switches to the first tab when standalone', () => {
    stubStandalone(true);
    const aId = s().activeDocId;
    s().openTab(createDocument('frt')); // [A, B], active = B
    render(<Host />);
    fireEvent.keyDown(window, { key: '1', metaKey: true });
    expect(s().activeDocId).toBe(aId);
  });

  it('Cmd+W closes the active tab when standalone', () => {
    stubStandalone(true);
    const aId = s().activeDocId;
    s().openTab(createDocument('frt')); // active = B
    render(<Host />);
    fireEvent.keyDown(window, { key: 'w', metaKey: true });
    expect(s().tabOrder).toEqual([aId]);
    expect(s().activeDocId).toBe(aId);
  });
});
