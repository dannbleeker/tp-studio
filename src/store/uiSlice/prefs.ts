import {
  readJSON,
  readString,
  STORAGE_KEYS,
  writeJSON,
  writeString,
} from '@/services/storage/storage';
import type {
  AnimationSpeed,
  AppMode,
  CausalityLabel,
  DefaultLayoutDirection,
  EdgePalette,
  EdgeRouting,
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
const VALID_APP_MODES: ReadonlySet<AppMode> = new Set([
  'expert',
  'guided',
  'workshop',
  'presentation',
]);
const VALID_EDGE_ROUTING: ReadonlySet<EdgeRouting> = new Set(['smart', 'direct']);

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
    commentAuthorName: typeof raw?.commentAuthorName === 'string' ? raw.commentAuthorName : '',
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
    // Session 135 — action-eligibility badge OFF by default. It's only
    // meaningful on a Transition Tree where the user has set entity
    // states; on a fresh TT every action would read amber "pending",
    // which is noise. Opt in via Settings → Display.
    showActionEligibility: raw?.showActionEligibility === true,
    // Minimap default ON — it's a useful affordance for non-trivial diagrams
    // and easy to dismiss in Settings.
    showMinimap: raw?.showMinimap !== false,
    // Session 181 — grow-cards-to-fit-text OFF by default (fixed-height cards).
    growCardsToFitText: raw?.growCardsToFitText === true,
    // Session 182 — Building Blocks rail expanded by default (collapsed = false).
    blocksRailCollapsed: raw?.blocksRailCollapsed === true,
    // Session 188 — method-path strip expanded by default (collapsed = false).
    methodPathCollapsed: raw?.methodPathCollapsed === true,
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
    // Session 136 — CRT wizard preference, same `!== false` semantics
    // so first-run users get the guided 3-UDE elicitation.
    showCRTWizard: raw?.showCRTWizard !== false,
    // Session 136 — layout density. Default `'balanced'`; unknown
    // values (future / corrupt) fall back to balanced rather than
    // throwing.
    layoutDensity:
      raw?.layoutDensity === 'compact' ||
      raw?.layoutDensity === 'spacious' ||
      raw?.layoutDensity === 'balanced'
        ? raw.layoutDensity
        : 'balanced',
    // Session 87 — collapsed by default so the EC canvas reclaims
    // ~150 px of vertical chrome; user expands per-session via the
    // strip's chevron. `!== false` semantics: any non-`false` value
    // (including `undefined` on a first-run install) keeps the
    // collapsed default.
    verbalisationStripCollapsed: raw?.verbalisationStripCollapsed !== false,
    // Session 89 EC chrome cleanup — default flipped to `true`
    // (hidden). Same `!== false` semantics as the other "hidden by
    // default" flags: any non-`false` value (including `undefined` on
    // first-run) keeps the chrome hidden. Users opt in via the palette
    // command "Show EC reading guide."
    ecChromeCollapsed: raw?.ecChromeCollapsed !== false,
    // Session 95 — default ON. `!== false` semantics: any non-`false`
    // value (including `undefined` for first-run users) keeps the
    // toolbar visible. Users disable via Settings → Behavior.
    showSelectionToolbar: raw?.showSelectionToolbar !== false,
    // Session 137 — discoverability hint default OFF (tip visible).
    // Flips to `true` (dismissed) the first time the user clicks any
    // toolbar verb or the tip's own X. `=== true` semantics: any
    // non-`true` value (including `undefined` on first-run) keeps
    // the tip visible — same default-show pattern as the first-entity
    // tip.
    selectionToolbarTipDismissed: raw?.selectionToolbarTipDismissed === true,
    // Session 135 — `'expert'` is the default for first-run users;
    // unknown / stale mode values fall back to expert so a future
    // schema change doesn't strand someone in an unusable mode.
    appMode: raw?.appMode && VALID_APP_MODES.has(raw.appMode) ? raw.appMode : 'expert',
    // Session 135 medium gap — archived groups hidden by default; the
    // whole point of archiving is to declutter, so reveal is opt-in.
    showArchivedGroups: raw?.showArchivedGroups === true,
    // Edge routing — `'smart'` is the locked default per the routing
    // proposal. The `'direct'` opt-out exists as an escape hatch for
    // users who specifically want React Flow's default curves. Unknown
    // values (stale / corrupt) fall back to smart rather than
    // throwing.
    edgeRouting:
      raw?.edgeRouting && VALID_EDGE_ROUTING.has(raw.edgeRouting) ? raw.edgeRouting : 'smart',
    // Session 138 — open loaded documents in a new tab by default.
    // `!== false` semantics: any non-`false` value (including
    // `undefined` for existing users with no stored value) keeps the
    // new-tab default. Opt out via Settings → Behavior.
    openDocsInNewTab: raw?.openDocsInNewTab !== false,
    // Session 178 — print page setup. Each field is validated independently
    // so a stale / tampered value falls back to today's default (A4 ·
    // portrait · fit-to-one-page) rather than throwing.
    printLayout: {
      paper: raw?.printLayout?.paper === 'letter' ? 'letter' : 'a4',
      orientation: raw?.printLayout?.orientation === 'landscape' ? 'landscape' : 'portrait',
      scale: raw?.printLayout?.scale === 'fit-width' ? 'fit-width' : 'fit-page',
      // Default on (`!== false`): any non-`false` value, including `undefined`
      // on a first-run / pre-Session-178 stored pref, keeps the legend on.
      showLegend: raw?.printLayout?.showLegend !== false,
    },
  };
};

export const writePrefs = (prefs: StoredPrefs): void => {
  writeJSON(STORAGE_KEYS.prefs, prefs);
};
