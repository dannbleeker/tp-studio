import type { StateCreator } from 'zustand';
import type { RootStore } from '../types';
import { readInitialPrefs, readInitialTheme, writePrefs, writeTheme } from './prefs';
import type {
  AnimationSpeed,
  AppMode,
  CausalityLabel,
  DefaultLayoutDirection,
  EdgePalette,
  EdgeRouting,
  LayoutMode,
  PrintLayout,
  Theme,
} from './types';

/**
 * Persisted UI preferences (theme + the rest of the localStorage-backed
 * `StoredPrefs` bag) plus the one-shot "empty-state tip" dismissal flag.
 *
 * The setters each call `persistPrefs()` so localStorage stays in sync. The
 * helper is colocated in the slice creator so it can read fresh state via
 * `get()` after the `set()` lands.
 */
export type PreferencesSlice = {
  theme: Theme;
  animationSpeed: AnimationSpeed;
  edgePalette: EdgePalette;
  browseLocked: boolean;
  /** Local display name stamped on review comments (not authenticated). */
  commentAuthorName: string;
  showAnnotationNumbers: boolean;
  showEntityIds: boolean;
  showReachBadges: boolean;
  /** E2 — reverse reach badge: per-entity count of root causes that
   *  transitively feed it via incoming edges. Independent of
   *  `showReachBadges` so the user can show one, the other, or both.
   *  Defaults off; turned on in Settings → Display. */
  showReverseReachBadges: boolean;
  /** Session 135 — at-a-glance action-eligibility badge on TT Action
   *  nodes (eligible ✓ / blocked ✗ / pending ?). Off by default; the
   *  full readout always lives in the Entity Inspector. Turned on in
   *  Settings → Display. */
  showActionEligibility: boolean;
  showMinimap: boolean;
  printInkSaver: boolean;
  layoutMode: LayoutMode;
  causalityLabel: CausalityLabel;
  defaultLayoutDirection: DefaultLayoutDirection;
  /** First-run UI tip about Tab / drag / Cmd-K. Not part of `StoredPrefs`
   *  — it's a session flag that resets across `resetStoreForTest`. */
  emptyStateTipDismissed: boolean;
  /** Session 87 — EC PPT comparison item #1. Dismissal flag for the
   *  reading-instruction strip rendered above the EC canvas. Session-
   *  scoped (not persisted) so users see the meta-instruction "1) In
   *  order to / 2) we must / 3) because" the first time on a new EC,
   *  but a single dismissal hides it for the rest of the session. */
  ecReadingInstructionsDismissed: boolean;
  /** Session 78 / brief §5 + §6 — show the creation-wizard panel on
   *  new Goal Tree documents. Default true so first-time users get
   *  the guided flow; user can flip it off in Settings → Behavior or
   *  via the "Don't show this again" checkbox on the panel itself. */
  showGoalTreeWizard: boolean;
  /** Session 78 — same shape for Evaporating Cloud. Independent of
   *  the Goal Tree flag so a user can keep the EC wizard on while
   *  dismissing the Goal Tree one. */
  showECWizard: boolean;
  /** Session 136 — layout density. Three presets that scale the
   *  auto-layout's rank + node separation: `'compact'` 0.75× (pull
   *  entities closer for dense maps), `'balanced'` 1.0× (the
   *  Session-136 tightened default — see `constants.ts`), `'spacious'`
   *  1.5× (looser layout for projector mode / accessibility). Applied
   *  at `layoutConfigToOptions()` time; per-doc `layoutConfig.rankSep`
   *  / `.nodeSep` still wins when set explicitly. */
  layoutDensity: 'compact' | 'balanced' | 'spacious';
  /** Session 136 — CRT creation wizard preference. The Current
   *  Reality Tree starts with UDE discovery; the wizard walks the
   *  user through capturing the first three UDEs and then steps
   *  out so the user can build the causal chain by hand. Default
   *  true so first-time users get the guided flow. */
  showCRTWizard: boolean;
  /** Session 87 — collapse the EC verbalisation strip above the
   *  canvas to a one-line summary by default. Default true so the
   *  canvas reclaims ~150 px of vertical chrome; user expands per-
   *  session via a chevron on the strip. Persisted across reloads. */
  verbalisationStripCollapsed: boolean;
  /** Session 88 (V2) — wraps the EC reading-instructions strip + the
   *  verbalisation strip in a single collapsible surface. When
   *  collapsed, both strips drop to one summary line; expanded, both
   *  render in their normal form. Per-strip dismiss / collapse stays
   *  available — this is the *outer* layer the user reaches first. */
  ecChromeCollapsed: boolean;
  /** Session 95 — show the floating SelectionToolbar above the
   *  current selection. Defaults to `true`; user can opt out via
   *  Settings → Behavior. Mirrors the StatusStrip chip pattern
   *  (small floating chrome that's easy to dismiss for users who
   *  prefer keyboard-only flow). */
  showSelectionToolbar: boolean;
  /** Session 138 — open loaded documents (import / pattern / template
   *  / example / share-link) in a NEW tab. Default `true`; opt out
   *  (replace the active document instead) via Settings → Behavior. */
  openDocsInNewTab: boolean;
  /** Session 137 — discoverability hint dismissed flag. The toolbar
   *  shows a one-line tip below its chip row ("Right-click for more
   *  actions") until this is `true`. Flipped permanently by the
   *  first verb-click or the tip's own X. Persisted across reloads. */
  selectionToolbarTipDismissed: boolean;
  /** Session 135 / spec major gap #9 — app-mode (Expert / Guided /
   *  Workshop / Presentation). Phase 1 lands the state field +
   *  setter + palette commands; per-mode chrome wiring follows.
   *  See {@link AppMode}. Persisted across reloads. */
  appMode: AppMode;
  /** Session 135 medium gap — reveal archived groups (preserve rejected
   *  logic) on the canvas. Default `false`. */
  showArchivedGroups: boolean;
  /** Edge routing mode. `'smart'` runs the visibility-graph + A\* router so
   *  edges avoid passing through non-endpoint node bodies; `'direct'` is the
   *  opt-out (React Flow's default curve). Default `'smart'`. */
  edgeRouting: EdgeRouting;
  /** Session 178 — print page setup (paper / orientation / fit scale).
   *  Read by `usePrintCanvas` on `beforeprint` so native Ctrl+P honours it,
   *  and by the Print dialog for the vector PDF. */
  printLayout: PrintLayout;

  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
  setAnimationSpeed: (speed: AnimationSpeed) => void;
  setEdgePalette: (palette: EdgePalette) => void;
  setBrowseLocked: (locked: boolean) => void;
  /** Review comments — set the local display name stamped on new comments. */
  setCommentAuthorName: (name: string) => void;
  setShowAnnotationNumbers: (show: boolean) => void;
  setShowEntityIds: (show: boolean) => void;
  setShowReachBadges: (show: boolean) => void;
  setShowReverseReachBadges: (show: boolean) => void;
  /** Session 135 — toggle the action-eligibility canvas badge. */
  setShowActionEligibility: (show: boolean) => void;
  setShowMinimap: (show: boolean) => void;
  setPrintInkSaver: (on: boolean) => void;
  setLayoutMode: (mode: LayoutMode) => void;
  setCausalityLabel: (label: CausalityLabel) => void;
  setDefaultLayoutDirection: (direction: DefaultLayoutDirection) => void;
  dismissEmptyStateTip: () => void;
  /** Session 87 — dismiss the EC reading-instruction strip for the
   *  remainder of this session. */
  dismissECReadingInstructions: () => void;
  /** Session 78 — toggle the per-diagram creation-wizard preference.
   *  Persists to localStorage so the choice survives reloads. */
  setShowGoalTreeWizard: (show: boolean) => void;
  setShowECWizard: (show: boolean) => void;
  /** Session 136 — toggle the CRT creation-wizard preference. */
  setShowCRTWizard: (show: boolean) => void;
  /** Session 136 — set the layout-density preset. */
  setLayoutDensity: (density: 'compact' | 'balanced' | 'spacious') => void;
  /** Session 87 — toggle the EC verbalisation-strip collapse flag.
   *  Persisted across reloads. */
  setVerbalisationStripCollapsed: (collapsed: boolean) => void;
  /** Session 88 (V2) — toggle the combined EC chrome wrapper. */
  setECChromeCollapsed: (collapsed: boolean) => void;
  /** Session 95 — toggle the floating SelectionToolbar. */
  setShowSelectionToolbar: (show: boolean) => void;
  /** Session 138 — toggle whether loaded documents open in a new tab
   *  (default) or replace the active document. */
  setOpenDocsInNewTab: (open: boolean) => void;
  /** Session 137 — dismiss the SelectionToolbar discoverability hint.
   *  Idempotent: once flipped to `true`, subsequent calls are no-ops.
   *  Persisted so the hint never reappears. */
  dismissSelectionToolbarTip: () => void;
  /** Session 135 — set the active app mode. */
  setAppMode: (mode: AppMode) => void;
  /** Session 135 — reveal / hide archived groups on the canvas. */
  setShowArchivedGroups: (show: boolean) => void;
  /** Toggle the edge-routing mode preference (smart ↔ direct). */
  setEdgeRouting: (mode: EdgeRouting) => void;
  /** Session 178 — patch the print page-setup pref (merges with current). */
  setPrintLayout: (patch: Partial<PrintLayout>) => void;
  /** Session 136 — reset every persisted preference back to its
   *  factory default, including theme. Per Dann's usage-feedback ask
   *  ("all settings should be able to restore to defaults"). The
   *  session-only flags (`emptyStateTipDismissed`,
   *  `ecReadingInstructionsDismissed`) reset too so the welcome
   *  affordances reappear on the next interaction — matches what a
   *  user expects from "reset". */
  resetPreferencesToDefaults: () => void;
};

export type PreferencesDataKeys =
  | 'theme'
  | 'animationSpeed'
  | 'edgePalette'
  | 'browseLocked'
  | 'commentAuthorName'
  | 'showAnnotationNumbers'
  | 'showEntityIds'
  | 'showReachBadges'
  | 'showReverseReachBadges'
  | 'showActionEligibility'
  | 'showMinimap'
  | 'printInkSaver'
  | 'layoutMode'
  | 'causalityLabel'
  | 'defaultLayoutDirection'
  | 'emptyStateTipDismissed'
  | 'ecReadingInstructionsDismissed'
  | 'showGoalTreeWizard'
  | 'showECWizard'
  | 'showCRTWizard'
  | 'layoutDensity'
  | 'verbalisationStripCollapsed'
  | 'ecChromeCollapsed'
  | 'showSelectionToolbar'
  | 'selectionToolbarTipDismissed'
  | 'appMode'
  | 'showArchivedGroups'
  | 'openDocsInNewTab'
  | 'edgeRouting'
  | 'printLayout';

/**
 * Data-only defaults used by `resetStoreForTest`. The theme + persisted
 * prefs default to fixed values so tests are deterministic regardless of
 * what's sitting in localStorage when the suite starts.
 */
export const preferencesDefaults = (): Pick<PreferencesSlice, PreferencesDataKeys> => ({
  theme: 'light',
  animationSpeed: 'default',
  edgePalette: 'default',
  browseLocked: false,
  commentAuthorName: '',
  showAnnotationNumbers: false,
  showEntityIds: false,
  showReachBadges: false,
  showReverseReachBadges: false,
  showActionEligibility: false,
  showMinimap: true,
  printInkSaver: false,
  layoutMode: 'flow',
  // Session 136 — default flipped from 'none' to 'auto' per Dann's
  // usage feedback. Fresh installs get the diagram-type-aware verbal
  // reading right away ("because" on CRT/FRT/TT, "in order to" on PRT/EC)
  // without needing to discover the setting. Stored prefs are unaffected
  // — existing users who explicitly chose 'none' keep their selection.
  causalityLabel: 'auto',
  defaultLayoutDirection: 'auto',
  emptyStateTipDismissed: false,
  ecReadingInstructionsDismissed: false,
  showGoalTreeWizard: true,
  showECWizard: true,
  showCRTWizard: true,
  layoutDensity: 'balanced',
  // Collapsed by default — Dann's Session 87 UX feedback: the full
  // chained verbalisation paragraph eats ~150 px of canvas chrome and
  // wraps to 5+ lines on a typical EC. Default collapsed, expand per
  // user intent.
  verbalisationStripCollapsed: true,
  // Session 89 EC chrome cleanup — default flipped to `true`
  // (hidden). V2's expanded-by-default rendered three rows of chrome
  // on first load (label row + reading instructions + collapsed
  // verbalisation chip), eating ~120 px of vertical canvas. The
  // cleanest first-load experience hides the meta-instruction strips
  // entirely; users opt in via the palette command "Show EC reading
  // guide" when they want them.
  ecChromeCollapsed: true,
  // Session 95 — default ON. The toolbar surfaces 3-5 verbs per
  // selection above the selected element; users who prefer
  // keyboard-only flow can disable in Settings → Behavior.
  showSelectionToolbar: true,
  // Session 137 — discoverability tip starts un-dismissed so first-
  // time users see "Right-click for more actions" below the chip
  // row. Mirrors the first-entity tip's default-show + dismiss-once
  // pattern.
  selectionToolbarTipDismissed: false,
  // Session 135 — Expert is the default mode. First-run users get
  // the full-affordance experience the tool has shipped with since
  // v1; explicit switch via the palette to enter Guided / Workshop
  // / Presentation modes.
  appMode: 'expert',
  // Session 135 — archived groups hidden by default; reveal is opt-in.
  showArchivedGroups: false,
  // Smart routing is the locked default per the routing proposal.
  // The `'direct'` opt-out is exposed in Settings → Display.
  edgeRouting: 'smart',
  // Session 138 — loaded documents open in a new tab by default;
  // opt out (replace the active doc) in Settings → Behavior.
  openDocsInNewTab: true,
  // Session 178 — A4 · portrait · fit-to-one-page is today's browser-print
  // behaviour, so the default is a no-op for existing users.
  printLayout: { paper: 'a4', orientation: 'portrait', scale: 'fit-page', showLegend: true },
});

export const createPreferencesSlice: StateCreator<RootStore, [], [], PreferencesSlice> = (
  set,
  get
) => {
  const initialPrefs = readInitialPrefs();
  const persistPrefs = (): void => {
    const s = get();
    writePrefs({
      animationSpeed: s.animationSpeed,
      edgePalette: s.edgePalette,
      browseLocked: s.browseLocked,
      commentAuthorName: s.commentAuthorName,
      showAnnotationNumbers: s.showAnnotationNumbers,
      showEntityIds: s.showEntityIds,
      showReachBadges: s.showReachBadges,
      showReverseReachBadges: s.showReverseReachBadges,
      showActionEligibility: s.showActionEligibility,
      showMinimap: s.showMinimap,
      printInkSaver: s.printInkSaver,
      layoutMode: s.layoutMode,
      causalityLabel: s.causalityLabel,
      defaultLayoutDirection: s.defaultLayoutDirection,
      showGoalTreeWizard: s.showGoalTreeWizard,
      showECWizard: s.showECWizard,
      showCRTWizard: s.showCRTWizard,
      layoutDensity: s.layoutDensity,
      verbalisationStripCollapsed: s.verbalisationStripCollapsed,
      ecChromeCollapsed: s.ecChromeCollapsed,
      showSelectionToolbar: s.showSelectionToolbar,
      selectionToolbarTipDismissed: s.selectionToolbarTipDismissed,
      appMode: s.appMode,
      showArchivedGroups: s.showArchivedGroups,
      edgeRouting: s.edgeRouting,
      openDocsInNewTab: s.openDocsInNewTab,
      printLayout: s.printLayout,
    });
  };

  return {
    theme: readInitialTheme(),
    animationSpeed: initialPrefs.animationSpeed,
    edgePalette: initialPrefs.edgePalette,
    browseLocked: initialPrefs.browseLocked,
    commentAuthorName: initialPrefs.commentAuthorName,
    showAnnotationNumbers: initialPrefs.showAnnotationNumbers,
    showEntityIds: initialPrefs.showEntityIds,
    showReachBadges: initialPrefs.showReachBadges,
    showReverseReachBadges: initialPrefs.showReverseReachBadges,
    showActionEligibility: initialPrefs.showActionEligibility,
    showMinimap: initialPrefs.showMinimap,
    printInkSaver: initialPrefs.printInkSaver,
    layoutMode: initialPrefs.layoutMode,
    causalityLabel: initialPrefs.causalityLabel,
    defaultLayoutDirection: initialPrefs.defaultLayoutDirection,
    emptyStateTipDismissed: false,
    ecReadingInstructionsDismissed: false,
    showGoalTreeWizard: initialPrefs.showGoalTreeWizard,
    showECWizard: initialPrefs.showECWizard,
    showCRTWizard: initialPrefs.showCRTWizard,
    layoutDensity: initialPrefs.layoutDensity,
    verbalisationStripCollapsed: initialPrefs.verbalisationStripCollapsed,
    ecChromeCollapsed: initialPrefs.ecChromeCollapsed,
    showSelectionToolbar: initialPrefs.showSelectionToolbar,
    selectionToolbarTipDismissed: initialPrefs.selectionToolbarTipDismissed,
    appMode: initialPrefs.appMode,
    showArchivedGroups: initialPrefs.showArchivedGroups,
    edgeRouting: initialPrefs.edgeRouting,
    openDocsInNewTab: initialPrefs.openDocsInNewTab,
    printLayout: initialPrefs.printLayout,

    setTheme: (theme) => {
      writeTheme(theme);
      set({ theme });
    },
    // Toolbar icon cycles light <-> dark only; high-contrast is chosen
    // explicitly from the Settings dialog.
    toggleTheme: () => {
      const next: Theme = get().theme === 'dark' ? 'light' : 'dark';
      writeTheme(next);
      set({ theme: next });
    },
    setAnimationSpeed: (speed) => {
      set({ animationSpeed: speed });
      persistPrefs();
    },
    setEdgePalette: (palette) => {
      set({ edgePalette: palette });
      persistPrefs();
    },
    setBrowseLocked: (locked) => {
      set({ browseLocked: locked });
      persistPrefs();
    },
    setCommentAuthorName: (name) => {
      set({ commentAuthorName: name });
      persistPrefs();
    },
    setShowAnnotationNumbers: (show) => {
      set({ showAnnotationNumbers: show });
      persistPrefs();
    },
    setShowEntityIds: (show) => {
      set({ showEntityIds: show });
      persistPrefs();
    },
    setShowReachBadges: (show) => {
      set({ showReachBadges: show });
      persistPrefs();
    },
    setShowReverseReachBadges: (show) => {
      set({ showReverseReachBadges: show });
      persistPrefs();
    },
    setShowActionEligibility: (show) => {
      set({ showActionEligibility: show });
      persistPrefs();
    },
    setShowMinimap: (show) => {
      set({ showMinimap: show });
      persistPrefs();
    },
    setPrintInkSaver: (on) => {
      set({ printInkSaver: on });
      persistPrefs();
    },
    setLayoutMode: (mode) => {
      set({ layoutMode: mode });
      persistPrefs();
    },
    setCausalityLabel: (label) => {
      set({ causalityLabel: label });
      persistPrefs();
    },
    setDefaultLayoutDirection: (direction) => {
      set({ defaultLayoutDirection: direction });
      persistPrefs();
    },
    dismissEmptyStateTip: () => set({ emptyStateTipDismissed: true }),
    dismissECReadingInstructions: () => set({ ecReadingInstructionsDismissed: true }),

    setShowGoalTreeWizard: (show) => {
      set({ showGoalTreeWizard: show });
      persistPrefs();
    },
    setShowECWizard: (show) => {
      set({ showECWizard: show });
      persistPrefs();
    },
    setShowCRTWizard: (show) => {
      set({ showCRTWizard: show });
      persistPrefs();
    },
    setLayoutDensity: (density) => {
      set({ layoutDensity: density });
      persistPrefs();
    },
    setVerbalisationStripCollapsed: (collapsed) => {
      set({ verbalisationStripCollapsed: collapsed });
      persistPrefs();
    },
    setECChromeCollapsed: (collapsed) => {
      set({ ecChromeCollapsed: collapsed });
      persistPrefs();
    },
    setShowSelectionToolbar: (show) => {
      set({ showSelectionToolbar: show });
      persistPrefs();
    },
    setOpenDocsInNewTab: (open) => {
      set({ openDocsInNewTab: open });
      persistPrefs();
    },
    setPrintLayout: (patch) => {
      set({ printLayout: { ...get().printLayout, ...patch } });
      persistPrefs();
    },
    dismissSelectionToolbarTip: () => {
      // Idempotent — repeated calls (e.g. first verb click + first
      // X click landing close together) all coalesce into a single
      // persist write at the final `true`.
      if (get().selectionToolbarTipDismissed) return;
      set({ selectionToolbarTipDismissed: true });
      persistPrefs();
    },
    setAppMode: (mode) => {
      // Session 135 / Phase 1B — entering Presentation auto-engages
      // Browse Lock so a stray click can't accidentally edit the doc
      // while it's projected. Leaving Presentation does NOT auto-
      // unlock — the user can keep it locked explicitly if they want
      // to. The lock toggle in the (now-hidden) TopBar reappears as
      // soon as the mode flips back to Expert / Guided / Workshop.
      const next: Partial<{ appMode: AppMode; browseLocked: boolean }> = { appMode: mode };
      // Session 135 — presentation auto-locks; Session 180 — reader also auto-locks
      // (both are read-only modes where a stray click must not edit the doc).
      // Leaving either mode does NOT auto-unlock — the user keeps their choice.
      if ((mode === 'presentation' || mode === 'reader') && !get().browseLocked) {
        next.browseLocked = true;
      }
      set(next);
      persistPrefs();
    },
    setShowArchivedGroups: (show) => {
      set({ showArchivedGroups: show });
      persistPrefs();
    },
    setEdgeRouting: (mode) => {
      set({ edgeRouting: mode });
      persistPrefs();
    },
    resetPreferencesToDefaults: () => {
      // Session 136 — single canonical source for "what's a default" is
      // `preferencesDefaults()`; calling `set()` with its full result
      // rewrites every persisted field back to factory state. Theme has
      // its own writer (separate localStorage key, no need to recompute
      // CSS), so we hit `writeTheme` explicitly. `persistPrefs()` then
      // writes the rest to the canonical prefs slot.
      //
      // The auto-engage-Browse-Lock-on-Presentation pairing in
      // `setAppMode` is intentionally NOT replicated here: resetting
      // returns appMode to 'expert' (no auto-lock), so Browse Lock
      // returns to its default `false` — that's the right outcome.
      const d = preferencesDefaults();
      writeTheme(d.theme);
      set({
        theme: d.theme,
        animationSpeed: d.animationSpeed,
        edgePalette: d.edgePalette,
        browseLocked: d.browseLocked,
        commentAuthorName: d.commentAuthorName,
        showAnnotationNumbers: d.showAnnotationNumbers,
        showEntityIds: d.showEntityIds,
        showReachBadges: d.showReachBadges,
        showReverseReachBadges: d.showReverseReachBadges,
        showActionEligibility: d.showActionEligibility,
        showMinimap: d.showMinimap,
        printInkSaver: d.printInkSaver,
        layoutMode: d.layoutMode,
        causalityLabel: d.causalityLabel,
        defaultLayoutDirection: d.defaultLayoutDirection,
        emptyStateTipDismissed: d.emptyStateTipDismissed,
        ecReadingInstructionsDismissed: d.ecReadingInstructionsDismissed,
        showGoalTreeWizard: d.showGoalTreeWizard,
        showECWizard: d.showECWizard,
        showCRTWizard: d.showCRTWizard,
        verbalisationStripCollapsed: d.verbalisationStripCollapsed,
        ecChromeCollapsed: d.ecChromeCollapsed,
        showSelectionToolbar: d.showSelectionToolbar,
        selectionToolbarTipDismissed: d.selectionToolbarTipDismissed,
        appMode: d.appMode,
        showArchivedGroups: d.showArchivedGroups,
        edgeRouting: d.edgeRouting,
        openDocsInNewTab: d.openDocsInNewTab,
      });
      persistPrefs();
    },
  };
};
