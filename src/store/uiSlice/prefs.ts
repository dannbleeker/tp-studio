import { STORAGE_KEYS, readJSON, readString, writeJSON, writeString } from '@/services/storage';
import type {
  AnimationSpeed,
  CausalityLabel,
  DefaultLayoutDirection,
  EdgePalette,
  LayoutMode,
  StoredPrefs,
  Theme,
} from './types';

/**
 * Local-storage backed UI preferences. Read once at slice-init via
 * `readInitialPrefs()` / `readInitialTheme()`; written through
 * `writePrefs()` / `writeTheme()` after every setter. Validation sets
 * here protect against tampered or stale localStorage values from older
 * app versions.
 */

const VALID_THEMES: ReadonlySet<Theme> = new Set([
  'light',
  'dark',
  'highContrast',
  'rust',
  'coal',
  'navy',
  'ayu',
]);
const VALID_SPEEDS: ReadonlySet<AnimationSpeed> = new Set(['instant', 'slow', 'default', 'fast']);
const VALID_PALETTES: ReadonlySet<EdgePalette> = new Set(['default', 'colorblindSafe', 'mono']);
const VALID_LAYOUT_MODES: ReadonlySet<LayoutMode> = new Set(['flow', 'radial']);
const VALID_CAUSALITY_LABELS: ReadonlySet<CausalityLabel> = new Set([
  'none',
  'because',
  'therefore',
  'in-order-to',
  'auto',
]);
const VALID_DEFAULT_DIRECTIONS: ReadonlySet<DefaultLayoutDirection> = new Set([
  'auto',
  'BT',
  'TB',
  'LR',
  'RL',
]);

export const readInitialTheme = (): Theme => {
  const raw = readString(STORAGE_KEYS.theme);
  return raw && VALID_THEMES.has(raw as Theme) ? (raw as Theme) : 'light';
};

export const writeTheme = (theme: Theme): void => {
  writeString(STORAGE_KEYS.theme, theme);
};

export const readInitialPrefs = (): Required<StoredPrefs> => {
  const raw = readJSON<StoredPrefs>(STORAGE_KEYS.prefs);
  return {
    animationSpeed:
      raw?.animationSpeed && VALID_SPEEDS.has(raw.animationSpeed) ? raw.animationSpeed : 'default',
    edgePalette:
      raw?.edgePalette && VALID_PALETTES.has(raw.edgePalette) ? raw.edgePalette : 'default',
    browseLocked: raw?.browseLocked === true,
    showAnnotationNumbers: raw?.showAnnotationNumbers === true,
    showEntityIds: raw?.showEntityIds === true,
    // Reach badges OFF by default — they're meaningful only on diagrams
    // that contain UDEs (CRT, FRT) and would otherwise just add visual
    // noise on PRT / TT / EC nodes.
    showReachBadges: raw?.showReachBadges === true,
    // E2: reverse reach badges OFF by default — same rationale as the
    // forward badge (noisy on diagrams that don't have the relevant
    // entity type — root causes here).
    showReverseReachBadges: raw?.showReverseReachBadges === true,
    // Minimap default ON — it's a useful affordance for non-trivial diagrams
    // and easy to dismiss in Settings.
    showMinimap: raw?.showMinimap !== false,
    // Ink-saver default OFF — preserves the colourful look people expect on
    // screen; users opt in when they're about to print.
    printInkSaver: raw?.printInkSaver === true,
    // Flow (dagre) is the default view; radial is an opt-in alternative.
    layoutMode: raw?.layoutMode && VALID_LAYOUT_MODES.has(raw.layoutMode) ? raw.layoutMode : 'flow',
    // Causality label default OFF — the canvas stays uncluttered; users opt
    // in via Settings when they're walking someone through the diagram.
    causalityLabel:
      raw?.causalityLabel && VALID_CAUSALITY_LABELS.has(raw.causalityLabel)
        ? raw.causalityLabel
        : 'none',
    // Default layout direction for new documents — `'auto'` means "use
    // each diagram type's natural default."
    defaultLayoutDirection:
      raw?.defaultLayoutDirection && VALID_DEFAULT_DIRECTIONS.has(raw.defaultLayoutDirection)
        ? raw.defaultLayoutDirection
        : 'auto',
    // Session 78 — creation-wizard preferences. Default ON for both
    // so first-time users get the guided flow; the panel itself
    // carries a "Don't show this again" checkbox + Settings exposes
    // the toggles for explicit control.
    showGoalTreeWizard: raw?.showGoalTreeWizard !== false,
    showECWizard: raw?.showECWizard !== false,
    // Session 87 — collapsed by default so the EC canvas reclaims
    // ~150 px of vertical chrome; user expands per-session via the
    // strip's chevron. `!== false` semantics: any non-`false` value
    // (including `undefined` on a first-run install) keeps the
    // collapsed default.
    verbalisationStripCollapsed: raw?.verbalisationStripCollapsed !== false,
  };
};

export const writePrefs = (prefs: StoredPrefs): void => {
  writeJSON(STORAGE_KEYS.prefs, prefs);
};
