import { TOAST_AUTO_DISMISS_MS_BY_KIND } from '@/domain/constants';
import { nanoid } from 'nanoid';
import type { StateCreator } from 'zustand';
import type { RootStore } from '../types';
import type { ContextMenuState, ContextMenuTarget, Toast, ToastAction, ToastKind } from './types';

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
  /** Session 79 / brief §12 — templates picker dialog. */
  templatePickerOpen: boolean;
  /** Session 90 — diagram-type picker. Tri-state: `null` (closed), or
   *  the mode (`'new'` = create blank, `'example'` = load example).
   *  Replaces the 14 per-diagram-type palette commands with one
   *  picker per mode. */
  diagramPickerOpen: 'new' | 'example' | null;
  /** Session 90 — single Export… picker. Replaces the ~17 individual
   *  export-format palette commands with one dialog grouped by
   *  category (Images / Documents / Data / Text / Share). */
  exportPickerOpen: boolean;
  /** Session 78 / brief §5 + §6 — creation-wizard panel for the
   *  diagram type the user just opened. `null` when closed; carries
   *  `step` (0-based) and `minimised` so the user can collapse the
   *  panel without dismissing it entirely. The wizard creates / fills
   *  entities live as the user types, so dismissal at any step is
   *  always safe — the canvas state already reflects whatever was
   *  entered. */
  creationWizard: null | {
    kind: 'goalTree' | 'ec';
    step: number;
    minimised: boolean;
    /** Session 88 (S18) — drag-to-reposition. `x` / `y` are the
     *  upper-left corner of the panel in viewport pixels. `null`
     *  on a fresh wizard so the panel falls back to its
     *  `top-14 left-4` Tailwind default. Persisted on the slice
     *  per-session — refreshing the page resets to the default
     *  position (cheap; the wizard is per-doc-creation flow). */
    x: number | null;
    y: number | null;
  };
  /** Session 87 — EC PPT comparison items #1+#7. The active tab on the
   *  EC inspector's 3-tab bar. Lives on the store so canvas chrome
   *  (the new injection chip) can request "open injections" from
   *  outside the Inspector component. Defaults to `'inspector'`; reset
   *  to default on `clearSelection`-equivalent operations is the
   *  Inspector's job, not the store's. */
  ecInspectorTab: 'inspector' | 'verbalisation' | 'injections';
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

  /** Session 88 (S14) — the optional `action` renders an Undo-style
   *  button on the toast. Existing two-arg callers continue to work
   *  unchanged; new call-sites pass `{ action: { label, run } }` to
   *  surface an affordance the user can click before the auto-dismiss
   *  fires.
   *
   *  Session 91 — optional `durationMs` overrides the per-kind default
   *  in `TOAST_AUTO_DISMISS_MS_BY_KIND`. The PWA "New version available"
   *  toast uses this to dwell longer than even the info default since
   *  the user often needs a moment to save their canvas state before
   *  refreshing. Omit for the per-kind default. */
  showToast: (
    kind: ToastKind,
    message: string,
    options?: { action?: ToastAction; durationMs?: number }
  ) => void;
  dismissToast: (id: string) => void;

  openQuickCapture: () => void;
  closeQuickCapture: () => void;

  /** Session 77 / brief §10 — print preview modal. */
  openPrintPreview: () => void;
  closePrintPreview: () => void;

  /** Session 79 — templates picker. */
  openTemplatePicker: () => void;
  closeTemplatePicker: () => void;

  /** Session 90 — diagram-type picker (replaces the 14 per-diagram
   *  palette commands). Mode determines the action on card click:
   *  `'new'` → `newDocument(type)`; `'example'` → `setDocument(buildExample(type))`. */
  openDiagramPicker: (mode: 'new' | 'example') => void;
  closeDiagramPicker: () => void;

  /** Session 90 — single Export… picker (replaces ~17 export commands). */
  openExportPicker: () => void;
  closeExportPicker: () => void;

  /** Session 78 — creation-wizard panel control. `openCreationWizard`
   *  resets the panel to step 0 on the given diagram type;
   *  `advanceCreationWizardStep` moves forward by one; `closeCreationWizard`
   *  dismisses entirely; `toggleCreationWizardMinimised` collapses /
   *  re-expands without losing state. */
  openCreationWizard: (kind: 'goalTree' | 'ec') => void;
  advanceCreationWizardStep: () => void;
  closeCreationWizard: () => void;
  toggleCreationWizardMinimised: () => void;
  /** Session 88 (S18) — persist a new wizard panel position after a
   *  drag. The values are clamped on read by the panel itself so a
   *  stored position that's now off-viewport (e.g. after a window
   *  resize) gets snapped back into view. */
  setCreationWizardPosition: (x: number, y: number) => void;

  /** Session 87 — set the active EC inspector tab. Used by the
   *  Inspector itself (tab clicks) AND by the canvas-side injection
   *  chip and assumption badges (`requestECInjectionsView`,
   *  `requestECInspectorView`). */
  setECInspectorTab: (tab: 'inspector' | 'verbalisation' | 'injections') => void;
  /** Session 87 — flip the EC inspector to its Injections tab. The
   *  injection chip on the canvas calls this on click; the chip is
   *  visible regardless of selection so it deliberately does NOT
   *  change `selection` here — the Inspector decides what to render
   *  on the active tab based on selection. The Inspector's Injections
   *  tab is selection-independent (it's the doc-level injection
   *  workbench), so the chip just nudges the tab. */
  requestECInjectionsView: () => void;

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
  | 'templatePickerOpen'
  | 'diagramPickerOpen'
  | 'exportPickerOpen'
  | 'creationWizard'
  | 'ecInspectorTab'
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
  templatePickerOpen: false,
  diagramPickerOpen: null,
  exportPickerOpen: false,
  creationWizard: null,
  ecInspectorTab: 'inspector',
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
  templatePickerOpen: false,
  diagramPickerOpen: null,
  exportPickerOpen: false,
  creationWizard: null,
  ecInspectorTab: 'inspector',
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

  showToast: (kind, message, options) => {
    // Dedup: if the same (kind, message) is already on the queue, drop
    // this one. Several validators sometimes fire on a single edit and
    // would otherwise stack identical toasts on top of each other. The
    // queue is short (≤5 in practice) so the linear scan is free.
    const existing = get().toasts;
    if (existing.some((t) => t.kind === kind && t.message === message)) return;
    const id = nanoid(8);
    // Session 88 (S14) — action is optional; spread keeps the shape
    // clean for the common two-arg call. The action's `run` is stored
    // by reference; Toaster invokes it on click.
    const toast: Toast = options?.action
      ? { id, kind, message, action: options.action }
      : { id, kind, message };
    set({ toasts: [...existing, toast] });
    // Session 91 — per-kind defaults grade by urgency (success short,
    // info medium, error long); per-call `durationMs` overrides for
    // edge cases like the PWA refresh toast.
    const duration = options?.durationMs ?? TOAST_AUTO_DISMISS_MS_BY_KIND[kind];
    setTimeout(() => {
      set({ toasts: get().toasts.filter((t) => t.id !== id) });
    }, duration);
  },
  dismissToast: (id) => set({ toasts: get().toasts.filter((t) => t.id !== id) }),

  openQuickCapture: () => set({ quickCaptureOpen: true }),
  closeQuickCapture: () => set({ quickCaptureOpen: false }),

  openPrintPreview: () => set({ printOpen: true }),
  closePrintPreview: () => set({ printOpen: false }),

  openTemplatePicker: () => set({ templatePickerOpen: true }),
  closeTemplatePicker: () => set({ templatePickerOpen: false }),

  openDiagramPicker: (mode) => set({ diagramPickerOpen: mode }),
  closeDiagramPicker: () => set({ diagramPickerOpen: null }),

  openExportPicker: () => set({ exportPickerOpen: true }),
  closeExportPicker: () => set({ exportPickerOpen: false }),

  openCreationWizard: (kind) =>
    set({ creationWizard: { kind, step: 0, minimised: false, x: null, y: null } }),
  advanceCreationWizardStep: () => {
    const cur = get().creationWizard;
    if (!cur) return;
    set({ creationWizard: { ...cur, step: cur.step + 1 } });
  },
  closeCreationWizard: () => set({ creationWizard: null }),
  toggleCreationWizardMinimised: () => {
    const cur = get().creationWizard;
    if (!cur) return;
    set({ creationWizard: { ...cur, minimised: !cur.minimised } });
  },
  setCreationWizardPosition: (x, y) => {
    const cur = get().creationWizard;
    if (!cur) return;
    set({ creationWizard: { ...cur, x, y } });
  },

  setECInspectorTab: (tab) => set({ ecInspectorTab: tab }),
  requestECInjectionsView: () => set({ ecInspectorTab: 'injections' }),

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
