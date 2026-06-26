/**
 * Constants shared across the three `useGraphView` sub-hooks. They lived as
 * file-local consts in the original monolithic hook; lifting them here lets
 * `useGraphPositions` (which needs the collapsed-card geometry to size dagre
 * nodes) and `useGraphEmission` (which renders the cards and the group
 * rectangles around them) read the same numbers without re-declaring them.
 */

import { NODE_MIN_HEIGHT, NODE_WIDTH, ST_NODE_HEIGHT } from '@/domain/constants';
import { isStNodeFormat } from '@/domain/graph';
import type { Entity, TPDocument } from '@/domain/types';
import type { AppMode } from '@/store/uiSlice/types';

/** Padding around a group's bounding box on every side. */
export const GROUP_PADDING = 24;
/** Extra top padding inside a group rect to reserve space for the title row. */
export const GROUP_TITLE_TOP = 14;
/** Collapsed-group card width — also the width dagre uses when laying out a
 *  collapsed group as a single virtual node. */
export const COLLAPSED_WIDTH = 220;
/** Collapsed-group card height — same dual role as `COLLAPSED_WIDTH`. */
export const COLLAPSED_HEIGHT = 90;

// --- Grow-to-fit title sizing (opt-in via the "Grow cards to fit text" pref) ---

/** Usable title-wrap width inside a card at the fixed `NODE_WIDTH`:
 *  220 − 6px colour stripe (`w-1.5`) − 24px content padding (`px-3`) − 2px
 *  border (border-box) = 188px. The estimator wraps the title in this width. */
const TITLE_TEXT_WIDTH = NODE_WIDTH - 6 - 24 - 2;

/** Lines the default (non-grown) card already shows via `line-clamp-2`. Height
 *  only grows for lines BEYOND this, so a ≤2-line title keeps today's 72px box. */
const BASE_TITLE_LINES = 2;

/** Hard cap on grown height — Dann's "up to a point". A longer title clamps with
 *  an ellipsis (the card switches to `line-clamp-6`). */
export const MAX_CARD_GROW_LINES = 6;

/** Average glyph advance as a fraction of font size. Biased slightly WIDE (a real
 *  proportional sans averages ~0.5) so the estimate rounds toward MORE lines: a
 *  too-tall box is a harmless gap, a too-short one would clip text or let an
 *  unrelated edge graze the card. */
const AVG_CHAR_WIDTH_RATIO = 0.52;

/**
 * The font the title span actually renders at, by per-entity `titleSize` and the
 * app `appMode` (`--text-node` is 15px by default, 18px in workshop, 16px in
 * presentation; `sm`→`text-xs` 12px, `lg`→`text-base` 16px). The estimator needs
 * the EFFECTIVE size so the computed box matches the rendered card.
 */
const effectiveTitleFont = (
  titleSize: Entity['titleSize'],
  appMode: AppMode | undefined
): { fontSize: number; lineHeightPx: number } => {
  if (titleSize === 'sm') return { fontSize: 12, lineHeightPx: 16 };
  if (titleSize === 'lg') return { fontSize: 16, lineHeightPx: 24 };
  // 'md' / unset → the app-mode-driven `--text-node`.
  if (appMode === 'workshop') return { fontSize: 18, lineHeightPx: 18 * 1.4 };
  if (appMode === 'presentation') return { fontSize: 16, lineHeightPx: 16 * 1.35 };
  return { fontSize: 15, lineHeightPx: 15 * 1.35 };
};

/**
 * Estimate how many visual lines `title` wraps to at `fontSize` inside the fixed
 * {@link TITLE_TEXT_WIDTH}. Greedy word-wrap (whole words; a single word longer
 * than a line breaks mid-word), honouring explicit `\n` (the span is
 * `whitespace-pre-line`). Pure + deterministic — no DOM measurement — so the
 * layout stays stable and the geometry tests can pin it.
 */
export const estimateTitleLines = (title: string, fontSize: number): number => {
  const perLine = Math.max(1, Math.floor(TITLE_TEXT_WIDTH / (fontSize * AVG_CHAR_WIDTH_RATIO)));
  let lines = 0;
  for (const para of title.split('\n')) {
    const words = para.split(/\s+/).filter(Boolean);
    if (words.length === 0) {
      lines += 1; // a blank line still occupies a row
      continue;
    }
    let col = 0; // chars used on the current line (0 = empty)
    for (const word of words) {
      const sep = col === 0 ? 0 : 1; // the space before this word
      if (col !== 0 && col + sep + word.length > perLine) {
        lines += 1; // doesn't fit — wrap to a fresh line
        col = 0;
      }
      if (word.length > perLine) {
        // A single word longer than a line breaks mid-word across rows.
        const span = Math.ceil(word.length / perLine);
        lines += span - 1;
        col = word.length - (span - 1) * perLine;
      } else {
        col = col === 0 ? word.length : col + 1 + word.length;
      }
    }
    lines += 1; // the paragraph's final line
  }
  return Math.max(1, lines);
};

/** Grown card height for a normal entity: today's 72px floor plus one line-height
 *  per wrapped line beyond {@link BASE_TITLE_LINES}, capped at
 *  {@link MAX_CARD_GROW_LINES}. */
const grownEntityHeight = (entity: Entity, appMode: AppMode | undefined): number => {
  const { fontSize, lineHeightPx } = effectiveTitleFont(entity.titleSize, appMode);
  const lines = Math.min(estimateTitleLines(entity.title || '', fontSize), MAX_CARD_GROW_LINES);
  const extraLines = Math.max(0, lines - BASE_TITLE_LINES);
  return NODE_MIN_HEIGHT + Math.ceil(extraLines * lineHeightPx);
};

/** Options for {@link nodeSizeFor}. When `growToFit` is set, a normal entity's
 *  height is estimated from its title (capped); omitted/false reproduces the
 *  original fixed-height behaviour exactly. `appMode` selects the render font. */
export type NodeSizeOpts = { growToFit?: boolean; appMode?: AppMode };

/**
 * Canonical render/layout size of a visible node, by id — the ONE place the
 * "how big is this node?" rule lives. Every pipeline stage that needs a node's
 * box (dagre layout inputs, A\* obstacle boxes, group-rect bbox, the MiniMap
 * measurement hint) calls this, so a node type's dimensions can't drift between
 * them and adding a new sized type is a one-line change here.
 *
 *   - entity            → `NODE_WIDTH`; `ST_NODE_HEIGHT` for an S&T-format
 *                         entity; the grow-to-fit height when `opts.growToFit`;
 *                         else `NODE_MIN_HEIGHT`;
 *   - collapsed-root    → `COLLAPSED_WIDTH × COLLAPSED_HEIGHT`;
 *   - neither (unknown) → `null`, so callers skip it (e.g. as a non-obstacle).
 */
export const nodeSizeFor = (
  doc: TPDocument,
  id: string,
  opts?: NodeSizeOpts
): { width: number; height: number } | null => {
  const entity = doc.entities[id];
  if (entity) {
    if (isStNodeFormat(entity)) return { width: NODE_WIDTH, height: ST_NODE_HEIGHT };
    if (opts?.growToFit) {
      return { width: NODE_WIDTH, height: grownEntityHeight(entity, opts.appMode) };
    }
    return { width: NODE_WIDTH, height: NODE_MIN_HEIGHT };
  }
  if (doc.groups[id]) return { width: COLLAPSED_WIDTH, height: COLLAPSED_HEIGHT };
  return null;
};

/**
 * A referentially-stable structural signature of every entity's
 * routing-relevant content. The edge router (`computeEdgeRoutes`) reads an
 * entity through exactly two channels:
 *
 *   - its obstacle SIZE, via {@link nodeSizeFor} (S&T-format vs normal, and —
 *     when grow-to-fit is on — the wrapped-title height);
 *   - its VISIBILITY, via the projection, which keys on entity existence + the
 *     per-entity F7 `collapsed` flag (see `useGraphProjection`).
 *
 * Nothing else about an entity reaches routing. So two documents whose entities
 * yield the same signature route identically. `useEdgeRoutes` keys its
 * expensive memo (visibility-graph build + A\* per edge + O(E²) decross) on this
 * string instead of the raw `doc.entities` reference: a title / description /
 * colour / state edit bumps the entities-map reference but changes no obstacle
 * box and no visibility bit, so the signature is unchanged and the router is
 * skipped. Before this gate, every such edit re-ran the whole router — the
 * edit-heavy perf regression (Session 190; trace p95 ~9 ms → ~18 ms).
 *
 * O(entities) string build — cheap next to the routing it guards, and the
 * entities-map key order is preserved across in-place patches (object spread),
 * so an unchanged graph yields a byte-identical (hence `===`-stable) string.
 */
export const entityRoutingSignature = (doc: TPDocument, opts?: NodeSizeOpts): string => {
  const parts: string[] = [];
  for (const id of Object.keys(doc.entities)) {
    const size = nodeSizeFor(doc, id, opts);
    if (!size) continue; // unreachable for an entity id; keeps the types honest
    const collapsed = doc.entities[id]?.collapsed ? '1' : '0';
    parts.push(`${id}:${size.width}x${size.height}:${collapsed}`);
  }
  return parts.join(';');
};

/**
 * A `===`-stable signature of the entity fields the reachability walks read:
 * each entity's `id` and `type`. The reach counters (`udeReachCounts` /
 * `rootCauseReachCounts`) seed off `type === 'ude'` / `'rootCause'` and traverse
 * the edge graph — they never read a title, description, state, or position.
 *
 * Keying the reach-count memos on this string (instead of the raw `doc.entities`
 * reference) means an ENTITY title / description / state / colour edit — which
 * bumps the entities-map reference but adds, removes, or retypes nothing — leaves
 * the signature unchanged, so the O(V·(V+E)) forward/backward BFS is skipped.
 * Before this, every such edit busted the WeakMap reach cache (keyed on the
 * entities reference) and re-walked the whole graph twice (Session 190 — the
 * residual half of the edit-heavy perf regression). Edges, the other input, are
 * already a separate dep that stays stable across an entity-content edit.
 */
export const entityTypeSignature = (doc: TPDocument): string => {
  const parts: string[] = [];
  for (const id of Object.keys(doc.entities)) {
    parts.push(`${id}:${doc.entities[id]?.type ?? ''}`);
  }
  return parts.join(';');
};

/**
 * A `===`-stable signature of the entity fields the visibility projection reads:
 * each entity's `id` (existence) and `collapsed` flag (F7 per-entity collapse).
 * `computeCollapseProjection` consults `doc.entities` only for existence, and the
 * projection's direct reads are the F7 `collapsed` flag — never a title,
 * description, state, type, or position.
 *
 * Keying `useGraphProjection` on this string (instead of the raw `doc.entities`
 * reference) means a title / description / state / colour edit — which bumps the
 * entities map but adds, removes, or re-collapses nothing — leaves the signature
 * unchanged, so the O(N) visibility rebuild (and its F7 collapse BFS) is skipped.
 */
export const entityCollapseSignature = (doc: TPDocument): string => {
  const parts: string[] = [];
  for (const id of Object.keys(doc.entities)) {
    parts.push(`${id}:${doc.entities[id]?.collapsed ? '1' : '0'}`);
  }
  return parts.join(';');
};
