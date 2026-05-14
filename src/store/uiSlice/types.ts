/**
 * UI-slice type definitions. Pulled out of the slice creators so the
 * sub-slice files can import these without circular dependencies, and so
 * external consumers (Inspector, Settings, etc.) can re-export them
 * through `@/store/uiSlice` for backward compatibility.
 */

import type { EdgeId, EntityId, GroupId } from '@/domain/types';

/**
 * Multi-selection model. Each variant holds ordered, de-duplicated id
 * lists of one kind — mixed selections aren't supported because the
 * inspector has one render path per kind.
 *
 * Session 85 (#1) added the `groups` variant so group cards can be
 * selected with proper `GroupId` branding instead of pretending to be
 * entities via an `as unknown as EntityId` cast.
 */
export type Selection =
  | { kind: 'none' }
  | { kind: 'entities'; ids: EntityId[] }
  | { kind: 'edges'; ids: EdgeId[] }
  | { kind: 'groups'; ids: GroupId[] };

/**
 * App-wide visual theme. `'light'` and `'dark'` are the canonical pair;
 * `'highContrast'` is a max-contrast dark layered for accessibility; the
 * four named dark variants (`rust`, `coal`, `navy`, `ayu`) are stylistic
 * dark themes drawn from the FL theme catalog. Each named variant layers
 * on top of `.dark` so Tailwind dark-mode utilities continue to work
 * everywhere; the variant CSS only adjusts body background and accent
 * colors.
 */
export type Theme = 'light' | 'dark' | 'highContrast' | 'rust' | 'coal' | 'navy' | 'ayu';
export type AnimationSpeed = 'instant' | 'slow' | 'default' | 'fast';
export type EdgePalette = 'default' | 'colorblindSafe' | 'mono';
/** F5: alternate-view toggle. `'flow'` runs dagre top-down (the default);
 *  `'radial'` runs the sunburst layout with apexes at the center. Hand-
 *  positioned diagrams (`LAYOUT_STRATEGY === 'manual'`) ignore this. */
export type LayoutMode = 'flow' | 'radial';
/**
 * Optional global causality-reading label for edges. When non-`'none'`,
 * every edge that doesn't already carry an explicit `Edge.label` renders
 * the chosen word mid-edge as a faint default. Lets the user pick how the
 * diagram reads aloud:
 *
 *   - **`'because'`** — reads bottom-up: "the effect happens *because* the
 *     cause exists." Matches the visual direction of CRT-style diagrams.
 *   - **`'therefore'`** — reads top-down: "the cause exists, *therefore*
 *     the effect happens." Matches argumentation-style readings.
 *   - **`'in-order-to'`** — necessity-flavor reading: "in order to obtain
 *     the effect, the cause must hold." The natural reading for PRT and
 *     EC, where edges are necessary-condition relations rather than
 *     sufficient-cause.
 *   - **`'auto'`** — TOC-reading mode: pick the right reading per diagram
 *     type. CRT/FRT/TT → `because`; PRT/EC → `in-order-to`. The label is
 *     chosen at render time, not stored.
 *   - **`'none'`** — no fallback label, the canvas stays clean.
 *
 * Per-edge labels (set via the EdgeInspector) always win — the fallback
 * only fills the gap. Styled distinctly (italic, muted) so the user can
 * still tell which labels are explicit vs. derived.
 */
export type CausalityLabel = 'none' | 'because' | 'therefore' | 'in-order-to' | 'auto';

export type ContextMenuTarget =
  | { kind: 'entity'; id: string }
  | { kind: 'edge'; id: string }
  | { kind: 'pane' };

export type ContextMenuState =
  | { open: true; x: number; y: number; target: ContextMenuTarget }
  | { open: false };

export type ToastKind = 'info' | 'success' | 'error';
/** Optional action button rendered on a toast. Session 88 (S14) added
 *  to surface affordances like Undo on actions that overwrite the doc
 *  (template load, large imports). `run` fires when the user clicks the
 *  button; the toast then auto-dismisses. Kept structural — the button
 *  is intentionally generic so other call-sites can reuse it without
 *  re-plumbing the toast pipeline. */
/** Optional visual emphasis on the action button. `prominent: true`
 *  renders the button as a filled call-to-action (e.g. PWA "Refresh now")
 *  rather than the default subtle outline. */
export type ToastAction = { label: string; run: () => void; prominent?: boolean };
export type Toast = {
  id: string;
  kind: ToastKind;
  message: string;
  action?: ToastAction;
};

export type SearchOptions = {
  regex: boolean;
  caseSensitive: boolean;
  wholeWord: boolean;
};

/**
 * App-wide default layout direction applied to *new* documents on creation.
 * `'auto'` falls back to each diagram type's natural default (CRT/FRT use
 * `BT`; Goal Trees / PRT typically `TB`; manual-layout diagrams like EC
 * ignore the field entirely). The setting only affects fresh documents —
 * existing docs keep whatever `doc.layoutConfig` they carry.
 */
export type DefaultLayoutDirection = 'auto' | 'BT' | 'TB' | 'LR' | 'RL';

/** Subset of UI state that gets persisted via `prefs.ts`. */
export type StoredPrefs = {
  animationSpeed?: AnimationSpeed;
  edgePalette?: EdgePalette;
  browseLocked?: boolean;
  showAnnotationNumbers?: boolean;
  showEntityIds?: boolean;
  /** When true, each entity in a CRT/FRT-style diagram renders a small
   *  "→N" badge counting how many UDEs the entity transitively reaches.
   *  Cheap continuous version of the Core Driver finder. Off by default —
   *  the badge is noise on diagrams without UDEs. */
  showReachBadges?: boolean;
  /** E2: reverse "←N root causes" badge — counts root causes that
   *  transitively feed each entity. Independent of the forward
   *  reach badge so the user can show one, the other, or both. */
  showReverseReachBadges?: boolean;
  showMinimap?: boolean;
  /** F6: ink-saving print mode — strips entity-stripe fills and drops the
   *  group background tints when sent to a printer / PDF. */
  printInkSaver?: boolean;
  /** F5: persisted layout-mode choice. Stored app-wide rather than per-doc
   *  because it's a viewing preference, not a property of the diagram. */
  layoutMode?: LayoutMode;
  /** Optional fallback causality label rendered mid-edge when no per-edge
   *  label is set. See `CausalityLabel` for the rationale. */
  causalityLabel?: CausalityLabel;
  /** FL-TO3: app-wide default layout direction for new documents. */
  defaultLayoutDirection?: DefaultLayoutDirection;
  /** Session 78 — per-diagram creation-wizard preferences. Default
   *  true for both; the user dismisses via the panel checkbox or
   *  Settings → Behavior. */
  showGoalTreeWizard?: boolean;
  showECWizard?: boolean;
  /** Session 87 — EC verbalisation strip collapse state. Default
   *  `true` (collapsed) so the canvas reclaims vertical space on EC
   *  docs; user expands per-session via the strip's chevron. */
  verbalisationStripCollapsed?: boolean;
  /** Session 88 (V2) — combined EC chrome wrapper collapse state.
   *  Default `false` (expanded) so first-time EC viewers see the
   *  reading instructions + verbalisation strips; manual collapse
   *  persists. */
  ecChromeCollapsed?: boolean;
};
