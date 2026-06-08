import { cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createDocument } from '@/domain/factory';
import { useGlobalShortcuts } from '@/hooks/useGlobalShortcuts';
import * as canvasRef from '@/services/canvasRef';
import { __clearClipboardForTest } from '@/services/clipboard';
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

beforeEach(() => {
  resetStoreForTest();
  __clearClipboardForTest();
});
afterEach(() => {
  resetStoreForTest();
  __clearClipboardForTest();
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

describe('useGlobalShortcuts — bare keys defer to a focused control', () => {
  // The bare-key shortcuts (Quick Capture) must not fire when a button/menu owns
  // focus — same class as the canvas-selection shortcuts. Chords (Cmd+K/S/Z/…)
  // and Escape stay broad and are covered by their own describes.
  it('E (Quick Capture) on a focused button does NOT open Quick Capture', () => {
    render(
      <div>
        <button type="button">x</button>
        <Host />
      </div>
    );
    const button = document.querySelector('button') as HTMLButtonElement;
    button.focus();
    fireEvent.keyDown(button, { key: 'e' });
    expect(s().quickCaptureOpen).toBe(false);
  });

  it('E on the canvas (no control focused) DOES open Quick Capture', () => {
    render(<Host />);
    fireEvent.keyDown(window, { key: 'e' });
    expect(s().quickCaptureOpen).toBe(true);
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

  it('Cmd+9 switches to the last tab when standalone', () => {
    stubStandalone(true);
    const aId = s().activeDocId;
    s().openTab(createDocument('frt')); // tab B
    const cDoc = createDocument('frt');
    s().openTab(cDoc); // tab C — active, last
    const lastId = cDoc.id;
    // Switch to first tab so we can verify pressing 9 goes to last.
    s().switchTab(aId);
    render(<Host />);
    fireEvent.keyDown(window, { key: '9', metaKey: true });
    expect(s().activeDocId).toBe(lastId);
  });

  it('Cmd+1 is a no-op when already on the target tab', () => {
    stubStandalone(true);
    const aId = s().activeDocId; // already tab 1
    render(<Host />);
    fireEvent.keyDown(window, { key: '1', metaKey: true });
    // Nothing changes.
    expect(s().activeDocId).toBe(aId);
  });

  it('Cmd+T with altKey present does NOT open a new tab (altKey guard)', () => {
    stubStandalone(true);
    const before = s().tabOrder.length;
    render(<Host />);
    fireEvent.keyDown(window, { key: 't', metaKey: true, altKey: true });
    expect(s().tabOrder.length).toBe(before);
  });
});

describe('useGlobalShortcuts — Cmd+Shift+S suppressed when typing in a field', () => {
  it('does NOT swap when focus is in an editable element', () => {
    const a = seedEntity('Alpha');
    const b = seedEntity('Beta');
    useDocumentStore.getState().selectEntities([a.id, b.id]);
    render(
      <div>
        <input data-testid="input" />
        <Host />
      </div>
    );
    const input = document.querySelector('input') as HTMLInputElement;
    input.focus();
    fireEvent.keyDown(input, { key: 's', metaKey: true, shiftKey: true });
    // Titles must be unchanged.
    expect(s().doc.entities[a.id]?.title).toBe('Alpha');
    expect(s().doc.entities[b.id]?.title).toBe('Beta');
  });
});

describe('useGlobalShortcuts — Cmd+Z suppressed when typing in a field', () => {
  it('does NOT undo when focus is in an editable element', () => {
    const e = seedEntity('first');
    render(
      <div>
        <input data-testid="input" />
        <Host />
      </div>
    );
    const input = document.querySelector('input') as HTMLInputElement;
    input.focus();
    fireEvent.keyDown(input, { key: 'z', metaKey: true });
    // Entity must still exist — undo was suppressed.
    expect(Object.keys(s().doc.entities)).toContain(e.id);
  });
});

describe('useGlobalShortcuts — browse-lock guards', () => {
  it('Cmd+Z toasts when browse-locked instead of undoing', () => {
    seedEntity('first');
    useDocumentStore.getState().setBrowseLocked(true);
    render(<Host />);
    const before = Object.keys(s().doc.entities).length;
    fireEvent.keyDown(window, { key: 'z', metaKey: true });
    // Entity count unchanged — undo was blocked.
    expect(Object.keys(s().doc.entities).length).toBe(before);
    expect(s().toasts.some((t) => /Browse Lock/i.test(t.message))).toBe(true);
  });

  it('E (quick-capture) toasts when browse-locked', () => {
    useDocumentStore.getState().setBrowseLocked(true);
    render(<Host />);
    fireEvent.keyDown(window, { key: 'e' });
    expect(s().quickCaptureOpen).toBe(false);
    expect(s().toasts.some((t) => /Browse Lock/i.test(t.message))).toBe(true);
  });

  it('Cmd+Shift+S toasts when browse-locked', () => {
    const a = seedEntity('Alpha');
    const b = seedEntity('Beta');
    useDocumentStore.getState().selectEntities([a.id, b.id]);
    useDocumentStore.getState().setBrowseLocked(true);
    render(<Host />);
    fireEvent.keyDown(window, { key: 's', metaKey: true, shiftKey: true });
    expect(s().doc.entities[a.id]?.title).toBe('Alpha'); // unchanged
    expect(s().toasts.some((t) => /Browse Lock/i.test(t.message))).toBe(true);
  });
});

describe('useGlobalShortcuts — Cmd+C / Cmd+X suppressed in a field', () => {
  it('Cmd+C inside an input does NOT toast', () => {
    const e = seedEntity('thing');
    useDocumentStore.getState().selectEntities([e.id]);
    render(
      <div>
        <input />
        <Host />
      </div>
    );
    const input = document.querySelector('input') as HTMLInputElement;
    input.focus();
    fireEvent.keyDown(input, { key: 'c', metaKey: true });
    expect(s().toasts.length).toBe(0);
  });

  it('Cmd+X inside an input does NOT toast', () => {
    const a = seedEntity('thing');
    useDocumentStore.getState().selectEntities([a.id]);
    render(
      <div>
        <input />
        <Host />
      </div>
    );
    const input = document.querySelector('input') as HTMLInputElement;
    input.focus();
    fireEvent.keyDown(input, { key: 'x', metaKey: true });
    expect(s().toasts.length).toBe(0);
  });
});

describe('useGlobalShortcuts — Cmd+X / Cmd+V (clipboard cut + paste)', () => {
  it('Cmd+X cuts the selection and toasts the count', () => {
    const e = seedEntity('thing');
    useDocumentStore.getState().selectEntities([e.id]);
    render(<Host />);
    fireEvent.keyDown(window, { key: 'x', metaKey: true });
    expect(s().toasts.some((t) => /Cut 1 entity/i.test(t.message))).toBe(true);
    expect(Object.keys(s().doc.entities)).not.toContain(e.id);
  });

  it('Cmd+V pastes a previously-cut entity and toasts', () => {
    const e = seedEntity('paste-me');
    useDocumentStore.getState().selectEntities([e.id]);
    render(<Host />);
    // Cut first to populate the buffer.
    fireEvent.keyDown(window, { key: 'x', metaKey: true });
    expect(Object.keys(s().doc.entities)).not.toContain(e.id);
    // Now paste.
    fireEvent.keyDown(window, { key: 'v', metaKey: true });
    expect(s().toasts.some((t) => /Pasted/i.test(t.message))).toBe(true);
    // At least one entity should exist with the same title.
    const titles = Object.values(s().doc.entities).map((ent) => ent.title);
    expect(titles).toContain('paste-me');
  });

  it('Cmd+V with empty clipboard does not toast', () => {
    render(<Host />);
    fireEvent.keyDown(window, { key: 'v', metaKey: true });
    expect(s().toasts.length).toBe(0);
  });

  it('Cmd+V inside a field does not paste', () => {
    render(
      <div>
        <input />
        <Host />
      </div>
    );
    const input = document.querySelector('input') as HTMLInputElement;
    input.focus();
    fireEvent.keyDown(input, { key: 'v', metaKey: true });
    expect(s().toasts.length).toBe(0);
  });
});

describe('useGlobalShortcuts — zoom shortcuts', () => {
  // Build a minimal canvas-instance mock with just the zoom methods.
  const makeMockCanvas = () => ({
    zoomIn: vi.fn(),
    zoomOut: vi.fn(),
    fitView: vi.fn(),
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('+ zooms in when canvas instance is available', () => {
    const mock = makeMockCanvas();
    vi.spyOn(canvasRef, 'getCanvasInstance').mockReturnValue(mock as never);
    render(<Host />);
    fireEvent.keyDown(window, { key: '+' });
    expect(mock.zoomIn).toHaveBeenCalledOnce();
  });

  it('= also zooms in (same physical key on US keyboard)', () => {
    const mock = makeMockCanvas();
    vi.spyOn(canvasRef, 'getCanvasInstance').mockReturnValue(mock as never);
    render(<Host />);
    fireEvent.keyDown(window, { key: '=' });
    expect(mock.zoomIn).toHaveBeenCalledOnce();
  });

  it('- zooms out', () => {
    const mock = makeMockCanvas();
    vi.spyOn(canvasRef, 'getCanvasInstance').mockReturnValue(mock as never);
    render(<Host />);
    fireEvent.keyDown(window, { key: '-' });
    expect(mock.zoomOut).toHaveBeenCalledOnce();
  });

  it('_ also zooms out (shifted -)', () => {
    const mock = makeMockCanvas();
    vi.spyOn(canvasRef, 'getCanvasInstance').mockReturnValue(mock as never);
    render(<Host />);
    fireEvent.keyDown(window, { key: '_' });
    expect(mock.zoomOut).toHaveBeenCalledOnce();
  });

  it('0 fits the view', () => {
    const mock = makeMockCanvas();
    vi.spyOn(canvasRef, 'getCanvasInstance').mockReturnValue(mock as never);
    render(<Host />);
    fireEvent.keyDown(window, { key: '0' });
    expect(mock.fitView).toHaveBeenCalledWith(
      expect.objectContaining({ padding: 0.4, maxZoom: 1.2 })
    );
  });

  it('zoom keys are no-ops when canvas instance is null', () => {
    vi.spyOn(canvasRef, 'getCanvasInstance').mockReturnValue(null);
    render(<Host />);
    // No crash, no dispatch — just verify nothing is called.
    fireEvent.keyDown(window, { key: '+' });
    fireEvent.keyDown(window, { key: '-' });
    fireEvent.keyDown(window, { key: '0' });
    // If we reach here without throwing the test passes.
  });

  it('zoom keys are suppressed when inside a text field', () => {
    const mock = makeMockCanvas();
    vi.spyOn(canvasRef, 'getCanvasInstance').mockReturnValue(mock as never);
    render(
      <div>
        <input />
        <Host />
      </div>
    );
    const input = document.querySelector('input') as HTMLInputElement;
    input.focus();
    fireEvent.keyDown(input, { key: '+' });
    expect(mock.zoomIn).not.toHaveBeenCalled();
  });

  it('zoom keys are suppressed when a Cmd/Ctrl modifier is held', () => {
    const mock = makeMockCanvas();
    vi.spyOn(canvasRef, 'getCanvasInstance').mockReturnValue(mock as never);
    render(<Host />);
    fireEvent.keyDown(window, { key: '+', metaKey: true });
    expect(mock.zoomIn).not.toHaveBeenCalled();
  });
});

describe('useGlobalShortcuts — Esc cascade (remaining layers)', () => {
  it('Esc resolves an open confirmDialog as false', () => {
    render(<Host />);
    // Open a confirm dialog and hold onto the promise.
    const promise = s().confirm('Are you sure?');
    expect(s().confirmDialog).not.toBeNull();
    fireEvent.keyDown(window, { key: 'Escape' });
    // Dialog cleared immediately.
    expect(s().confirmDialog).toBeNull();
    // Promise resolves to false (cancelled).
    return promise.then((result) => expect(result).toBe(false));
  });

  it('Esc closes quickCapture when open', () => {
    useDocumentStore.getState().openQuickCapture();
    render(<Host />);
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(s().quickCaptureOpen).toBe(false);
  });

  it('Esc closes diagramPicker when open', () => {
    useDocumentStore.getState().openDiagramPicker('new');
    expect(s().diagramPickerOpen).toBe('new');
    render(<Host />);
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(s().diagramPickerOpen).toBeNull();
  });

  it('Esc closes exportPicker when open', () => {
    useDocumentStore.getState().openExportPicker();
    render(<Host />);
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(s().exportPickerOpen).toBe(false);
  });

  it('Esc closes templatePicker when open', () => {
    useDocumentStore.getState().openTemplatePicker();
    render(<Host />);
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(s().templatePickerOpen).toBe(false);
  });

  it('Esc closes printPreview when open', () => {
    useDocumentStore.getState().openPrintPreview();
    render(<Host />);
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(s().printOpen).toBe(false);
  });

  it('Esc closes docSettings when open', () => {
    useDocumentStore.getState().openDocSettings();
    render(<Host />);
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(s().docSettingsOpen).toBe(false);
  });

  it('Esc closes settings when open', () => {
    useDocumentStore.getState().openSettings();
    render(<Host />);
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(s().settingsOpen).toBe(false);
  });

  it('Esc closes search panel when open', () => {
    useDocumentStore.getState().openSearch();
    render(<Host />);
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(s().searchOpen).toBe(false);
  });

  it('Esc closes About dialog when open', () => {
    useDocumentStore.getState().openAbout();
    render(<Host />);
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(s().aboutOpen).toBe(false);
  });

  it('Esc closes sideBySide when active', () => {
    useDocumentStore.setState({ sideBySideRevisionId: 'rev-abc' });
    render(<Host />);
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(s().sideBySideRevisionId).toBeNull();
  });

  it('Esc closes compareRevision when active', () => {
    useDocumentStore.setState({ compareRevisionId: 'rev-xyz' });
    render(<Host />);
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(s().compareRevisionId).toBeNull();
  });

  it('Esc closes commentsPanel when open', () => {
    useDocumentStore.getState().openCommentsPanel();
    render(<Host />);
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(s().commentsPanelOpen).toBe(false);
  });

  it('Esc closes historyPanel when open', () => {
    useDocumentStore.getState().openHistoryPanel();
    render(<Host />);
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(s().historyPanelOpen).toBe(false);
  });

  it('Esc falls through to clearSelection when editingEntityId is set (node handles its own esc)', () => {
    const e = seedEntity('editing');
    useDocumentStore.setState({ editingEntityId: e.id });
    useDocumentStore.getState().selectEntities([e.id]);
    render(<Host />);
    fireEvent.keyDown(window, { key: 'Escape' });
    // Hook must NOT clear — it returns early to let the textarea handle it.
    expect(s().editingEntityId).toBe(e.id);
    // Selection also survives (no clearSelection was called).
    expect(s().selection.kind).toBe('entities');
  });

  it('Esc cancels pending-edge mode', () => {
    const e = seedEntity('src');
    useDocumentStore.getState().startPendingEdge(e.id);
    expect(s().canvasMode.kind).toBe('pending-edge');
    render(<Host />);
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(s().canvasMode.kind).toBe('idle');
  });

  it('Esc cancels edge-join mode', () => {
    const { edge } = seedConnectedPair();
    useDocumentStore.getState().startEdgeJoinMode(edge.id);
    expect(s().canvasMode.kind).toBe('edge-join');
    render(<Host />);
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(s().canvasMode.kind).toBe('idle');
  });

  it('Esc unhoists one level when inside a hoisted group', () => {
    const a = seedEntity('A');
    const b = seedEntity('B');
    const g = useDocumentStore.getState().createGroupFromSelection([a.id, b.id]);
    if (!g) throw new Error('createGroupFromSelection failed');
    useDocumentStore.getState().hoistGroup(g.id);
    expect(s().hoistedGroupId).toBe(g.id);
    render(<Host />);
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(s().hoistedGroupId).toBeNull();
  });

  it('Esc cascade priority: quickCapture takes priority over palette', () => {
    useDocumentStore.getState().togglePalette();
    useDocumentStore.getState().openQuickCapture();
    render(<Host />);
    fireEvent.keyDown(window, { key: 'Escape' });
    // quickCapture (higher priority) should close; palette stays open.
    expect(s().quickCaptureOpen).toBe(false);
    expect(s().paletteOpen).toBe(true);
  });

  it('Esc cascade priority: about takes priority over help', () => {
    useDocumentStore.getState().openHelp();
    useDocumentStore.getState().openAbout();
    render(<Host />);
    fireEvent.keyDown(window, { key: 'Escape' });
    // about (topmost) should close; help stays open.
    expect(s().aboutOpen).toBe(false);
    expect(s().helpOpen).toBe(true);
  });
});

describe('useGlobalShortcuts — E bare-key guard: altKey suppresses', () => {
  it('Alt+E does NOT open quick capture', () => {
    render(<Host />);
    fireEvent.keyDown(window, { key: 'e', altKey: true });
    expect(s().quickCaptureOpen).toBe(false);
  });

  it('Shift+E does NOT open quick capture', () => {
    render(<Host />);
    fireEvent.keyDown(window, { key: 'E', shiftKey: true });
    expect(s().quickCaptureOpen).toBe(false);
  });
});

describe('useGlobalShortcuts — Cmd+C with zero copied entities does not toast', () => {
  it('Cmd+C with no selection produces no toast', () => {
    render(<Host />);
    fireEvent.keyDown(window, { key: 'c', metaKey: true });
    expect(s().toasts.length).toBe(0);
  });

  it('Cmd+C with multiple entities selected toasts with plural form', () => {
    const a = seedEntity('A');
    const b = seedEntity('B');
    useDocumentStore.getState().selectEntities([a.id, b.id]);
    render(<Host />);
    fireEvent.keyDown(window, { key: 'c', metaKey: true });
    expect(s().toasts.some((t) => /Copied 2 entities/i.test(t.message))).toBe(true);
  });
});

describe('useGlobalShortcuts — Cmd+Shift+S: swaps with empty selection toasts info', () => {
  it('info toast when zero entities are selected', () => {
    render(<Host />);
    fireEvent.keyDown(window, { key: 's', metaKey: true, shiftKey: true });
    expect(s().toasts.some((t) => /exactly two entities/i.test(t.message))).toBe(true);
  });
});
