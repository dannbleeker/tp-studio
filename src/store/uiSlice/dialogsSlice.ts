import { TOAST_AUTO_DISMISS_MS } from '@/domain/constants';
import { nanoid } from 'nanoid';
import type { StateCreator } from 'zustand';
import type { RootStore } from '../types';
import type { ContextMenuState, ContextMenuTarget, Toast, ToastKind } from './types';

/**
 * Everything modal-ish: the command palette, help / settings / doc-settings
 * dialogs, the right-click context menu, the toast stack, and Quick Capture.
 * Each has its own `open*` / `close*` pair; only the toast stack has any
 * real logic (auto-dismiss after `TOAST_AUTO_DISMISS_MS`).
 */
export type DialogsSlice = {
  paletteOpen: boolean;
  paletteInitialQuery: string;
  helpOpen: boolean;
  settingsOpen: boolean;
  docSettingsOpen: boolean;
  contextMenu: ContextMenuState;
  toasts: Toast[];
  /** FL-QC1 Quick Capture dialog. */
  quickCaptureOpen: boolean;
  /** Session 77 / brief §10 — print preview modal. */
  printOpen: boolean;
  /** H1 — revision-history panel visibility. */
  historyPanelOpen: boolean;
  /** H2 — when set, the canvas is in visual-diff mode and entities/edges
   *  are tinted by their diff status against this revision (added /
   *  removed / changed / unchanged). `null` = not in compare mode. */
  compareRevisionId: string | null;
  /** H4 — when set, a fullscreen side-by-side modal renders the named
   *  revision next to the live doc. Independent of `compareRevisionId`
   *  (the user can choose either flavor of comparison per revision). */
  sideBySideRevisionId: string | null;
  /** Async-confirm dialog state. `null` when no confirm is pending; an
   *  object holds the message and the pending resolver. The
   *  `<ConfirmDialog>` component reads this; the `confirm()` action
   *  returns a Promise<boolean> that resolves once the user picks
   *  Confirm or Cancel. Replaces the previous synchronous
   *  `window.confirm` calls so the UI stays theme-aware and the JS
   *  thread isn't blocked. */
  confirmDialog: {
    message: string;
    confirmLabel?: string;
    cancelLabel?: string;
    /** Resolver kept in store so the dialog component can settle it on click. */
    resolve: (ok: boolean) => void;
  } | null;

  openPalette: () => void;
  openPaletteWithQuery: (query: string) => void;
  closePalette: () => void;
  togglePalette: () => void;

  openHelp: () => void;
  closeHelp: () => void;

  openSettings: () => void;
  closeSettings: () => void;

  openDocSettings: () => void;
  closeDocSettings: () => void;

  openContextMenu: (target: ContextMenuTarget, x: number, y: number) => void;
  closeContextMenu: () => void;

  showToast: (kind: ToastKind, message: string) => void;
  dismissToast: (id: string) => void;

  openQuickCapture: () => void;
  closeQuickCapture: () => void;

  /** Session 77 / brief §10 — print preview modal. */
  openPrintPreview: () => void;
  closePrintPreview: () => void;

  openHistoryPanel: () => void;
  closeHistoryPanel: () => void;
  toggleHistoryPanel: () => void;

  /** H2 — enter / exit visual-diff mode. Esc clears via Esc-cascade. */
  openCompare: (revisionId: string) => void;
  closeCompare: () => void;

  /** H4 — open / close the side-by-side dialog. */
  openSideBySide: (revisionId: string) => void;
  closeSideBySide: () => void;

  /**
   * Open the async-confirm dialog. Resolves to `true` if the user
   * confirms, `false` if they cancel (Esc, backdrop click, or
   * Cancel button). Use this in place of `window.confirm`.
   */
  confirm: (
    message: string,
    options?: { confirmLabel?: string; cancelLabel?: string }
  ) => Promise<boolean>;
  /** Settle the open confirm with the given answer. The component
   *  wires both buttons + Esc through this. */
  resolveConfirm: (ok: boolean) => void;
};

export type DialogsDataKeys =
  | 'paletteOpen'
  | 'paletteInitialQuery'
  | 'helpOpen'
  | 'settingsOpen'
  | 'docSettingsOpen'
  | 'contextMenu'
  | 'toasts'
  | 'quickCaptureOpen'
  | 'printOpen'
  | 'historyPanelOpen'
  | 'compareRevisionId'
  | 'sideBySideRevisionId'
  | 'confirmDialog';

export const dialogsDefaults = (): Pick<DialogsSlice, DialogsDataKeys> => ({
  paletteOpen: false,
  paletteInitialQuery: '',
  helpOpen: false,
  settingsOpen: false,
  docSettingsOpen: false,
  contextMenu: { open: false },
  toasts: [],
  quickCaptureOpen: false,
  printOpen: false,
  historyPanelOpen: false,
  compareRevisionId: null,
  sideBySideRevisionId: null,
  confirmDialog: null,
});

export const createDialogsSlice: StateCreator<RootStore, [], [], DialogsSlice> = (set, get) => ({
  paletteOpen: false,
  paletteInitialQuery: '',
  helpOpen: false,
  settingsOpen: false,
  docSettingsOpen: false,
  contextMenu: { open: false },
  toasts: [],
  quickCaptureOpen: false,
  printOpen: false,
  historyPanelOpen: false,
  compareRevisionId: null,
  sideBySideRevisionId: null,
  confirmDialog: null,

  openPalette: () => set({ paletteOpen: true, paletteInitialQuery: '' }),
  openPaletteWithQuery: (query) => set({ paletteOpen: true, paletteInitialQuery: query }),
  closePalette: () => set({ paletteOpen: false }),
  togglePalette: () => set({ paletteOpen: !get().paletteOpen, paletteInitialQuery: '' }),

  openHelp: () => set({ helpOpen: true }),
  closeHelp: () => set({ helpOpen: false }),

  openSettings: () => set({ settingsOpen: true }),
  closeSettings: () => set({ settingsOpen: false }),

  openDocSettings: () => set({ docSettingsOpen: true }),
  closeDocSettings: () => set({ docSettingsOpen: false }),

  openContextMenu: (target, x, y) => set({ contextMenu: { open: true, target, x, y } }),
  closeContextMenu: () => set({ contextMenu: { open: false } }),

  showToast: (kind, message) => {
    // Dedup: if the same (kind, message) is already on the queue, drop
    // this one. Several validators sometimes fire on a single edit and
    // would otherwise stack identical toasts on top of each other. The
    // queue is short (≤5 in practice) so the linear scan is free.
    const existing = get().toasts;
    if (existing.some((t) => t.kind === kind && t.message === message)) return;
    const id = nanoid(8);
    set({ toasts: [...existing, { id, kind, message }] });
    setTimeout(() => {
      set({ toasts: get().toasts.filter((t) => t.id !== id) });
    }, TOAST_AUTO_DISMISS_MS);
  },
  dismissToast: (id) => set({ toasts: get().toasts.filter((t) => t.id !== id) }),

  openQuickCapture: () => set({ quickCaptureOpen: true }),
  closeQuickCapture: () => set({ quickCaptureOpen: false }),

  openPrintPreview: () => set({ printOpen: true }),
  closePrintPreview: () => set({ printOpen: false }),

  // History panel and Inspector share the right-edge slot — opening
  // history clears any selection so the Inspector doesn't visually race
  // for the same z-20 column. Picking something on the canvas while
  // history is open closes history (Canvas's onSelectionChange will call
  // `closeHistoryPanel` once a selection lands).
  openHistoryPanel: () => set({ historyPanelOpen: true, selection: { kind: 'none' } }),
  closeHistoryPanel: () => set({ historyPanelOpen: false }),
  toggleHistoryPanel: () => {
    const next = !get().historyPanelOpen;
    set({ historyPanelOpen: next, ...(next ? { selection: { kind: 'none' } } : {}) });
  },

  openCompare: (revisionId) => set({ compareRevisionId: revisionId }),
  closeCompare: () => set({ compareRevisionId: null }),

  openSideBySide: (revisionId) => set({ sideBySideRevisionId: revisionId }),
  closeSideBySide: () => set({ sideBySideRevisionId: null }),

  confirm: (message, options) => {
    // If a confirm is somehow already open, resolve it as `false` first
    // so the previous caller doesn't hang on a forever-pending promise.
    const existing = get().confirmDialog;
    if (existing) existing.resolve(false);
    return new Promise<boolean>((resolve) => {
      set({
        confirmDialog: {
          message,
          confirmLabel: options?.confirmLabel,
          cancelLabel: options?.cancelLabel,
          resolve,
        },
      });
    });
  },
  resolveConfirm: (ok) => {
    const current = get().confirmDialog;
    if (!current) return;
    current.resolve(ok);
    set({ confirmDialog: null });
  },
});
