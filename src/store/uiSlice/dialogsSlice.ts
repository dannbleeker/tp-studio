import type { StateCreator } from 'zustand';
import type { CommentAnchor, DiagramType, TPDocument } from '@/domain/types';
import type { RootStore } from '../types';
import type { ContextMenuState, ContextMenuTarget } from './types';

/**
 * Everything modal-ish: the command palette, help / settings / doc-settings
 * dialogs, the right-click context menu, and Quick Capture. Each has its
 * own `open*` / `close*` pair — a flat dialog-visibility registry.
 *
 * Session 135 — the two parts that carried real runtime logic moved to
 * their own sibling UI sub-slices: the toast stack to `toastsSlice.ts`,
 * the async-confirm dialog to `confirmSlice.ts`. Both still resolve on
 * the root store (`s.showToast`, `s.confirm`), so consumers are
 * unchanged.
 */
export type DialogsSlice = {
  paletteOpen: boolean;
  paletteInitialQuery: string;
  helpOpen: boolean;
  /** Session 111 — About TP Studio dialog. Permanent in-app surface for
   *  the practitioner's book, the User Guide, the security doc, the
   *  third-party notices, the GitHub source, the build version, and
   *  the dynamic copyright string. Lives behind Cmd+K → "About TP
   *  Studio…" and a footer link inside the Help dialog. */
  aboutOpen: boolean;
  settingsOpen: boolean;
  docSettingsOpen: boolean;
  contextMenu: ContextMenuState;
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
  /** Session 133 — single Import… picker that fronts the JSON /
   *  Mermaid / CSV / Flying Logic file pickers. Replaces the 4
   *  separate import palette commands with one dialog. */
  importPickerOpen: boolean;
  /** Session 135 / spec major gap #3 Phase 1B — cross-diagram
   *  entity import. `null` when no import is in progress; carries
   *  the parsed source document while the user picks an entity
   *  from it. The dialog reads the source doc, the user picks an
   *  entity, the store action mints a new entity in the current
   *  doc with `importedFrom` set, then this state clears. The
   *  source doc isn't persisted — it lives in memory only for the
   *  picker's lifetime. */
  importEntityPicker: null | { sourceDoc: TPDocument };
  /** Phase 2a — "Link to entity in another tab…" cross-doc link picker visibility. */
  linkEntityPickerOpen: boolean;
  /** Session 78 / brief §5 + §6 — creation-wizard panel for the
   *  diagram type the user just opened. `null` when closed; carries
   *  `step` (0-based) and `minimised` so the user can collapse the
   *  panel without dismissing it entirely. The wizard creates / fills
   *  entities live as the user types, so dismissal at any step is
   *  always safe — the canvas state already reflects whatever was
   *  entered. */
  creationWizard: null | {
    kind: 'goalTree' | 'ec' | 'crt';
    step: number;
    minimised: boolean;
    /** Session 88 (S18) — drag-to-reposition. `x` / `y` are the
     *  upper-left corner of the panel in viewport pixels. `null`
     *  on a fresh wizard so the panel falls back to its
     *  `top-2 left-4` Tailwind default. Persisted on the slice
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
  /** Session 133 — "Read entire diagram at once" dialog. Alternative
   *  to the step-through Read-through walkthrough for users who want
   *  to see (and copy) the full verbal form in one go — especially
   *  useful for large CRTs where 50+ edges of step-through gets
   *  tedious. */
  readAllAtOnceOpen: boolean;
  /** Session 134 — "Paste from whiteboard (Miro / Mural)" import
   *  dialog. Universal escape hatch for whiteboard-tool migration:
   *  user copies stickies from the source board, pastes into a
   *  textarea, one entity is minted per non-empty line. Closes the
   *  Miro/Mural-import gap from the spec gap analysis without
   *  requiring backend OAuth into either tool's REST API. */
  whiteboardPasteOpen: boolean;
  /** Session 134 — pattern-library picker. Closes minor gap #4 (sub-item
   *  A) from the spec gap analysis. Lists curated multi-per-type
   *  starter diagrams in a single grid; replaces / supplements the
   *  diagram-type picker's one-example-per-type behaviour. `null` =
   *  closed; `{ filter }` = open and (optionally) pre-filtered to a
   *  diagram type. */
  patternLibraryOpen: null | { filter: DiagramType | 'all' };

  /** H1 — revision-history panel visibility. */
  historyPanelOpen: boolean;
  /** Review-comments side panel visibility. Shares the right-edge slot
   *  with the history panel + inspector (opening one closes history), but
   *  — unlike history — opening comments does NOT clear the selection: the
   *  composer offers to anchor a new comment to whatever entity/edge is
   *  currently selected, so the selection must survive the panel opening. */
  commentsPanelOpen: boolean;
  /** A free-floating ("point") comment anchor staged by the pane
   *  "Add comment here" action. When set, the Comments composer anchors a
   *  new comment to this canvas coordinate instead of the selection. Cleared
   *  on submit or when the panel closes. */
  pendingCommentAnchor: CommentAnchor | null;
  /** H2 — when set, the canvas is in visual-diff mode and entities/edges
   *  are tinted by their diff status against this revision (added /
   *  removed / changed / unchanged). `null` = not in compare mode. */
  compareRevisionId: string | null;
  /** H4 — when set, a fullscreen side-by-side modal renders the named
   *  revision next to the live doc. Independent of `compareRevisionId`
   *  (the user can choose either flavor of comparison per revision). */
  sideBySideRevisionId: string | null;

  /** Phase 3 #7 — guided CLR-scrutiny dialog. The id of the edge being
   *  scrutinised, or `null` when closed. A read-only review surface that
   *  walks the eight canonical CLR questions for this one edge; it mutates
   *  nothing and persists nothing (no schema change). */
  edgeScrutinyId: string | null;

  /** Phase 3 #3 — "Injection Flower" dialog. The id of the injection entity
   *  whose cross-doc links are being grouped into Desired-Effect / Negative-
   *  Branch / Plan petals, or `null` when closed. Read-only lens over the
   *  existing `Entity.links`; no schema change. */
  injectionFlowerEntityId: string | null;

  /** Force-hide the Inspector panel even when something is selected (frees
   *  canvas width). Toggled from the TopBar; a double-click on an edge
   *  re-shows it. Independent of the selection-driven `open` derivation in
   *  `useSelectionShape`. */
  inspectorHidden: boolean;

  openPalette: () => void;
  openPaletteWithQuery: (query: string) => void;
  closePalette: () => void;
  togglePalette: () => void;

  openHelp: () => void;
  closeHelp: () => void;

  openAbout: () => void;
  closeAbout: () => void;

  openSettings: () => void;
  closeSettings: () => void;

  openDocSettings: () => void;
  closeDocSettings: () => void;

  openContextMenu: (target: ContextMenuTarget, x: number, y: number) => void;
  closeContextMenu: () => void;

  openQuickCapture: () => void;
  closeQuickCapture: () => void;

  /** Session 77 / brief §10 — print preview modal. */
  openPrintPreview: () => void;
  closePrintPreview: () => void;

  /** Session 79 — templates picker. */
  openTemplatePicker: () => void;
  closeTemplatePicker: () => void;

  /** Phase 2a — "Link to entity in another tab…" cross-doc link picker. */
  openLinkEntityPicker: () => void;
  closeLinkEntityPicker: () => void;

  /** Session 90 — diagram-type picker (replaces the 14 per-diagram
   *  palette commands). Mode determines the action on card click:
   *  `'new'` → `newDocument(type)`; `'example'` → `setDocument(buildExample(type))`. */
  openDiagramPicker: (mode: 'new' | 'example') => void;
  closeDiagramPicker: () => void;

  /** Session 90 — single Export… picker (replaces ~17 export commands). */
  openExportPicker: () => void;
  closeExportPicker: () => void;

  /** Session 133 — single Import… picker that fronts the JSON / Mermaid /
   *  CSV / Flying Logic file-pickers. Mirrors the Export picker pattern. */
  openImportPicker: () => void;
  closeImportPicker: () => void;

  /** Session 135 / spec major gap #3 Phase 1B — cross-diagram entity
   *  import. `openImportEntityPicker` stores the parsed source doc
   *  in the slice and triggers the dialog mount; `closeImportEntityPicker`
   *  clears it. The palette command runs the file-picker then calls
   *  open, so this action receives a fully-parsed `TPDocument`. */
  openImportEntityPicker: (sourceDoc: TPDocument) => void;
  closeImportEntityPicker: () => void;

  /** Session 78 — creation-wizard panel control. `openCreationWizard`
   *  resets the panel to step 0 on the given diagram type;
   *  `advanceCreationWizardStep` moves forward by one; `closeCreationWizard`
   *  dismisses entirely; `toggleCreationWizardMinimised` collapses /
   *  re-expands without losing state. */
  openCreationWizard: (kind: 'goalTree' | 'ec' | 'crt') => void;
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

  /** Review-comments panel control. Opening comments closes the history
   *  panel (shared right-edge slot) but leaves the selection intact. */
  openCommentsPanel: () => void;
  closeCommentsPanel: () => void;
  toggleCommentsPanel: () => void;
  /** Stage a free-floating point comment + open the panel (pane "Add
   *  comment here"). */
  startCommentAt: (anchor: CommentAnchor) => void;
  clearPendingCommentAnchor: () => void;

  /** Show/hide the Inspector panel independently of the selection.
   *  `toggleInspector` flips it; `showInspector` force-shows it (used by the
   *  double-click-edge gesture). */
  toggleInspector: () => void;
  showInspector: () => void;

  /** Session 133 — open / close the all-at-once verbalisation dialog. */
  openReadAllAtOnce: () => void;
  closeReadAllAtOnce: () => void;

  /** Session 134 — open / close the "Paste from whiteboard" import
   *  dialog (closes the Miro / Mural import gap). */
  openWhiteboardPaste: () => void;
  closeWhiteboardPaste: () => void;

  /** Session 134 — open / close the pattern-library picker (closes
   *  minor gap #4A: reusable domain templates). `filter` defaults to
   *  'all'; callers can pre-filter by diagram type for context-aware
   *  entry points (e.g. an empty-canvas hint that opens the picker
   *  pre-filtered to the current diagram's patterns). */
  openPatternLibrary: (filter?: DiagramType | 'all') => void;
  closePatternLibrary: () => void;

  /** H2 — enter / exit visual-diff mode. Esc clears via Esc-cascade. */
  openCompare: (revisionId: string) => void;
  closeCompare: () => void;

  /** H4 — open / close the side-by-side dialog. */
  openSideBySide: (revisionId: string) => void;
  closeSideBySide: () => void;

  /** Phase 3 #7 — open / close the per-edge CLR-scrutiny dialog. */
  openEdgeScrutiny: (edgeId: string) => void;
  closeEdgeScrutiny: () => void;

  /** Phase 3 #3 — open / close the per-injection "flower" dialog. */
  openInjectionFlower: (entityId: string) => void;
  closeInjectionFlower: () => void;
};

export type DialogsDataKeys =
  | 'paletteOpen'
  | 'paletteInitialQuery'
  | 'helpOpen'
  | 'aboutOpen'
  | 'settingsOpen'
  | 'docSettingsOpen'
  | 'contextMenu'
  | 'quickCaptureOpen'
  | 'printOpen'
  | 'templatePickerOpen'
  | 'diagramPickerOpen'
  | 'exportPickerOpen'
  | 'importPickerOpen'
  | 'importEntityPicker'
  | 'linkEntityPickerOpen'
  | 'creationWizard'
  | 'ecInspectorTab'
  | 'readAllAtOnceOpen'
  | 'whiteboardPasteOpen'
  | 'patternLibraryOpen'
  | 'historyPanelOpen'
  | 'commentsPanelOpen'
  | 'inspectorHidden'
  | 'pendingCommentAnchor'
  | 'compareRevisionId'
  | 'sideBySideRevisionId'
  | 'edgeScrutinyId'
  | 'injectionFlowerEntityId';

export const dialogsDefaults = (): Pick<DialogsSlice, DialogsDataKeys> => ({
  paletteOpen: false,
  paletteInitialQuery: '',
  helpOpen: false,
  aboutOpen: false,
  settingsOpen: false,
  docSettingsOpen: false,
  contextMenu: { open: false },
  quickCaptureOpen: false,
  printOpen: false,
  templatePickerOpen: false,
  diagramPickerOpen: null,
  exportPickerOpen: false,
  importPickerOpen: false,
  importEntityPicker: null,
  linkEntityPickerOpen: false,
  creationWizard: null,
  ecInspectorTab: 'inspector',
  readAllAtOnceOpen: false,
  whiteboardPasteOpen: false,
  patternLibraryOpen: null,
  historyPanelOpen: false,
  commentsPanelOpen: false,
  inspectorHidden: false,
  pendingCommentAnchor: null,
  compareRevisionId: null,
  sideBySideRevisionId: null,
  edgeScrutinyId: null,
  injectionFlowerEntityId: null,
});

/**
 * The right-edge panel slot is shared by History and Comments (and the
 * Inspector, which reads `selection`). Single source of truth for "only one of
 * them is open": opening either closes the other, and opening History also
 * clears the selection so the Inspector doesn't race it for the column. Callers
 * layer on panel-specific extras (e.g. `pendingCommentAnchor`). Adding a third
 * right-slot panel becomes a one-line change here instead of an audit of every
 * open/toggle action.
 */
const openRightPanel = (
  panel: 'history' | 'comments'
): Partial<Pick<RootStore, 'historyPanelOpen' | 'commentsPanelOpen' | 'selection'>> =>
  panel === 'history'
    ? { historyPanelOpen: true, commentsPanelOpen: false, selection: { kind: 'none' } }
    : { historyPanelOpen: false, commentsPanelOpen: true };

export const createDialogsSlice: StateCreator<RootStore, [], [], DialogsSlice> = (set, get) => ({
  paletteOpen: false,
  paletteInitialQuery: '',
  helpOpen: false,
  aboutOpen: false,
  settingsOpen: false,
  docSettingsOpen: false,
  contextMenu: { open: false },
  quickCaptureOpen: false,
  printOpen: false,
  templatePickerOpen: false,
  diagramPickerOpen: null,
  exportPickerOpen: false,
  importPickerOpen: false,
  importEntityPicker: null,
  linkEntityPickerOpen: false,
  creationWizard: null,
  ecInspectorTab: 'inspector',
  readAllAtOnceOpen: false,
  whiteboardPasteOpen: false,
  patternLibraryOpen: null,
  historyPanelOpen: false,
  commentsPanelOpen: false,
  inspectorHidden: false,
  pendingCommentAnchor: null,
  compareRevisionId: null,
  sideBySideRevisionId: null,
  edgeScrutinyId: null,
  injectionFlowerEntityId: null,

  openPalette: () => set({ paletteOpen: true, paletteInitialQuery: '' }),
  openPaletteWithQuery: (query) => set({ paletteOpen: true, paletteInitialQuery: query }),
  closePalette: () => set({ paletteOpen: false }),
  togglePalette: () => set({ paletteOpen: !get().paletteOpen, paletteInitialQuery: '' }),

  openHelp: () => set({ helpOpen: true }),
  closeHelp: () => set({ helpOpen: false }),

  openAbout: () => set({ aboutOpen: true }),
  closeAbout: () => set({ aboutOpen: false }),

  openSettings: () => set({ settingsOpen: true }),
  closeSettings: () => set({ settingsOpen: false }),

  openDocSettings: () => set({ docSettingsOpen: true }),
  closeDocSettings: () => set({ docSettingsOpen: false }),

  openContextMenu: (target, x, y) => set({ contextMenu: { open: true, target, x, y } }),
  closeContextMenu: () => set({ contextMenu: { open: false } }),

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

  openImportPicker: () => set({ importPickerOpen: true }),
  closeImportPicker: () => set({ importPickerOpen: false }),

  openImportEntityPicker: (sourceDoc) => set({ importEntityPicker: { sourceDoc } }),
  closeImportEntityPicker: () => set({ importEntityPicker: null }),

  openLinkEntityPicker: () => set({ linkEntityPickerOpen: true }),
  closeLinkEntityPicker: () => set({ linkEntityPickerOpen: false }),

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

  // History + Comments + the Inspector share the right-edge slot; `openRightPanel`
  // owns the "only one open" rule (opening History also clears selection so the
  // Inspector doesn't race it for the same z-20 column). Picking something on the
  // canvas while history is open closes it (Canvas's onSelectionChange calls
  // `closeHistoryPanel` once a selection lands).
  openHistoryPanel: () => set(openRightPanel('history')),
  closeHistoryPanel: () => set({ historyPanelOpen: false }),
  toggleHistoryPanel: () =>
    set(get().historyPanelOpen ? { historyPanelOpen: false } : openRightPanel('history')),

  // Comments preserve the selection (the composer anchors new comments to it);
  // closing clears the pending anchor.
  openCommentsPanel: () => set(openRightPanel('comments')),
  closeCommentsPanel: () => set({ commentsPanelOpen: false, pendingCommentAnchor: null }),
  toggleCommentsPanel: () =>
    set(
      get().commentsPanelOpen
        ? { commentsPanelOpen: false, pendingCommentAnchor: null }
        : openRightPanel('comments')
    ),
  startCommentAt: (anchor) => set({ ...openRightPanel('comments'), pendingCommentAnchor: anchor }),
  clearPendingCommentAnchor: () => set({ pendingCommentAnchor: null }),

  toggleInspector: () => set({ inspectorHidden: !get().inspectorHidden }),
  showInspector: () => set({ inspectorHidden: false }),

  openReadAllAtOnce: () => set({ readAllAtOnceOpen: true }),
  closeReadAllAtOnce: () => set({ readAllAtOnceOpen: false }),

  openWhiteboardPaste: () => set({ whiteboardPasteOpen: true }),
  closeWhiteboardPaste: () => set({ whiteboardPasteOpen: false }),

  openPatternLibrary: (filter = 'all') => set({ patternLibraryOpen: { filter } }),
  closePatternLibrary: () => set({ patternLibraryOpen: null }),

  openCompare: (revisionId) => set({ compareRevisionId: revisionId }),
  closeCompare: () => set({ compareRevisionId: null }),

  openSideBySide: (revisionId) => set({ sideBySideRevisionId: revisionId }),
  closeSideBySide: () => set({ sideBySideRevisionId: null }),

  openEdgeScrutiny: (edgeId) => set({ edgeScrutinyId: edgeId }),
  closeEdgeScrutiny: () => set({ edgeScrutinyId: null }),

  openInjectionFlower: (entityId) => set({ injectionFlowerEntityId: entityId }),
  closeInjectionFlower: () => set({ injectionFlowerEntityId: null }),
});
