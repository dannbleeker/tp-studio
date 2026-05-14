import type { StateCreator } from 'zustand';
import type { RootStore } from '../types';
import { readInitialPrefs, readInitialTheme, writePrefs, writeTheme } from './prefs';
import type {
  AnimationSpeed,
  CausalityLabel,
  DefaultLayoutDirection,
  EdgePalette,
  LayoutMode,
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
  showAnnotationNumbers: boolean;
  showEntityIds: boolean;
  showReachBadges: boolean;
  /** E2 — reverse reach badge: per-entity count of root causes that
   *  transitively feed it via incoming edges. Independent of
   *  `showReachBadges` so the user can show one, the other, or both.
   *  Defaults off; turned on in Settings → Display. */
  showReverseReachBadges: boolean;
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

  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
  setAnimationSpeed: (speed: AnimationSpeed) => void;
  setEdgePalette: (palette: EdgePalette) => void;
  setBrowseLocked: (locked: boolean) => void;
  setShowAnnotationNumbers: (show: boolean) => void;
  setShowEntityIds: (show: boolean) => void;
  setShowReachBadges: (show: boolean) => void;
  setShowReverseReachBadges: (show: boolean) => void;
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
  /** Session 87 — toggle the EC verbalisation-strip collapse flag.
   *  Persisted across reloads. */
  setVerbalisationStripCollapsed: (collapsed: boolean) => void;
  /** Session 88 (V2) — toggle the combined EC chrome wrapper. */
  setECChromeCollapsed: (collapsed: boolean) => void;
};

export type PreferencesDataKeys =
  | 'theme'
  | 'animationSpeed'
  | 'edgePalette'
  | 'browseLocked'
  | 'showAnnotationNumbers'
  | 'showEntityIds'
  | 'showReachBadges'
  | 'showReverseReachBadges'
  | 'showMinimap'
  | 'printInkSaver'
  | 'layoutMode'
  | 'causalityLabel'
  | 'defaultLayoutDirection'
  | 'emptyStateTipDismissed'
  | 'ecReadingInstructionsDismissed'
  | 'showGoalTreeWizard'
  | 'showECWizard'
  | 'verbalisationStripCollapsed'
  | 'ecChromeCollapsed';

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
  showAnnotationNumbers: false,
  showEntityIds: false,
  showReachBadges: false,
  showReverseReachBadges: false,
  showMinimap: true,
  printInkSaver: false,
  layoutMode: 'flow',
  causalityLabel: 'none',
  defaultLayoutDirection: 'auto',
  emptyStateTipDismissed: false,
  ecReadingInstructionsDismissed: false,
  showGoalTreeWizard: true,
  showECWizard: true,
  // Collapsed by default — Dann's Session 87 UX feedback: the full
  // chained verbalisation paragraph eats ~150 px of canvas chrome and
  // wraps to 5+ lines on a typical EC. Default collapsed, expand per
  // user intent.
  verbalisationStripCollapsed: true,
  // Session 88 (V2) — outer chrome defaults to expanded so the user
  // sees the reading instructions / verbalisation strips on first
  // load. Once the user collapses the combined surface, that choice
  // sticks across reloads (persisted via prefs).
  ecChromeCollapsed: false,
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
      showAnnotationNumbers: s.showAnnotationNumbers,
      showEntityIds: s.showEntityIds,
      showReachBadges: s.showReachBadges,
      showReverseReachBadges: s.showReverseReachBadges,
      showMinimap: s.showMinimap,
      printInkSaver: s.printInkSaver,
      layoutMode: s.layoutMode,
      causalityLabel: s.causalityLabel,
      defaultLayoutDirection: s.defaultLayoutDirection,
      showGoalTreeWizard: s.showGoalTreeWizard,
      showECWizard: s.showECWizard,
      verbalisationStripCollapsed: s.verbalisationStripCollapsed,
      ecChromeCollapsed: s.ecChromeCollapsed,
    });
  };

  return {
    theme: readInitialTheme(),
    animationSpeed: initialPrefs.animationSpeed,
    edgePalette: initialPrefs.edgePalette,
    browseLocked: initialPrefs.browseLocked,
    showAnnotationNumbers: initialPrefs.showAnnotationNumbers,
    showEntityIds: initialPrefs.showEntityIds,
    showReachBadges: initialPrefs.showReachBadges,
    showReverseReachBadges: initialPrefs.showReverseReachBadges,
    showMinimap: initialPrefs.showMinimap,
    printInkSaver: initialPrefs.printInkSaver,
    layoutMode: initialPrefs.layoutMode,
    causalityLabel: initialPrefs.causalityLabel,
    defaultLayoutDirection: initialPrefs.defaultLayoutDirection,
    emptyStateTipDismissed: false,
    ecReadingInstructionsDismissed: false,
    showGoalTreeWizard: initialPrefs.showGoalTreeWizard,
    showECWizard: initialPrefs.showECWizard,
    verbalisationStripCollapsed: initialPrefs.verbalisationStripCollapsed,
    ecChromeCollapsed: initialPrefs.ecChromeCollapsed,

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
    setVerbalisationStripCollapsed: (collapsed) => {
      set({ verbalisationStripCollapsed: collapsed });
      persistPrefs();
    },
    setECChromeCollapsed: (collapsed) => {
      set({ ecChromeCollapsed: collapsed });
      persistPrefs();
    },
  };
};
