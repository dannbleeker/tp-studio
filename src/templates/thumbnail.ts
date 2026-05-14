import { ENTITY_STRIPE_COLOR } from '@/domain/tokens';
import type { TemplateSpec } from './shared';

/**
 * Session 79 / brief §12 — Template thumbnail generator.
 *
 * Renders a tiny SVG preview of a template's diagram shape. The
 * idea is to give the user a visual cue about the diagram's
 * structure without rendering React Flow + dagre off-screen (which
 * would be expensive for a picker grid).
 *
 * Strategy:
 *   - For EC docs, we know the 5-box layout exactly — render the 5
 *     stripes in their canonical positions, sized to fit the
 *     thumbnail.
 *   - For Goal Tree / CRT docs, we run a tiny per-thumbnail layout:
 *     bin entities by their distance-from-the-apex (the only sink
 *     for goal trees, the only UDE-like for CRTs), then row them out
 *     bottom-up.
 *
 * Output is a plain SVG string the caller can drop into a
 * `dangerouslySetInnerHTML` or render via `<img src="data:...">`.
 * No JS, no React, framework-free.
 */

const THUMB_W = 160;
const THUMB_H = 96;
const PAD = 4;

const escapeAttr = (s: string): string =>
  s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');

/** Renders a small rectangle with a coloured left stripe matching
 *  the entity's stripe colour token. */
const node = (x: number, y: number, w: number, h: number, stripe: string, fill: string): string =>
  `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="2" fill="${fill}" stroke="#d4d4d4" stroke-width="0.5" /><rect x="${x}" y="${y}" width="2" height="${h}" rx="1" fill="${stripe}" />`;

const stripeFor = (type: string): string =>
  ENTITY_STRIPE_COLOR[type as keyof typeof ENTITY_STRIPE_COLOR] ?? '#94a3b8';

/**
 * EC layout — canonical 5-box arrangement scaled to thumbnail.
 * Slots A on the left, B + C stacked centrally, D + D' stacked on
 * the right. Conflict line between D and D' in red.
 */
const renderEC = (spec: TemplateSpec): string => {
  const w = 32;
  const h = 14;
  const xA = 10;
  const xBC = (THUMB_W - w) / 2 - 6;
  const xDDP = THUMB_W - w - 10;
  const yMid = THUMB_H / 2 - h / 2;
  const yTop = THUMB_H / 2 - h - 6;
  const yBot = THUMB_H / 2 + 6;
  const slot = (key: 'a' | 'b' | 'c' | 'd' | 'dPrime') =>
    spec.entities.find((e) => e.ecSlot === key);
  const a = slot('a');
  const b = slot('b');
  const c = slot('c');
  const d = slot('d');
  const dp = slot('dPrime');
  const parts: string[] = [
    `<rect width="${THUMB_W}" height="${THUMB_H}" fill="#fafafa" />`,
    a ? node(xA, yMid, w, h, stripeFor(a.type), '#ffffff') : '',
    b ? node(xBC, yTop, w, h, stripeFor(b.type), '#ffffff') : '',
    c ? node(xBC, yBot, w, h, stripeFor(c.type), '#ffffff') : '',
    d ? node(xDDP, yTop, w, h, stripeFor(d.type), '#ffffff') : '',
    dp ? node(xDDP, yBot, w, h, stripeFor(dp.type), '#ffffff') : '',
    // Connecting strokes (faint).
    `<line x1="${xBC}" y1="${yTop + h / 2}" x2="${xA + w}" y2="${yMid + h / 2}" stroke="#cbd5e1" stroke-width="0.5" />`,
    `<line x1="${xBC}" y1="${yBot + h / 2}" x2="${xA + w}" y2="${yMid + h / 2}" stroke="#cbd5e1" stroke-width="0.5" />`,
    `<line x1="${xDDP}" y1="${yTop + h / 2}" x2="${xBC + w}" y2="${yTop + h / 2}" stroke="#cbd5e1" stroke-width="0.5" />`,
    `<line x1="${xDDP}" y1="${yBot + h / 2}" x2="${xBC + w}" y2="${yBot + h / 2}" stroke="#cbd5e1" stroke-width="0.5" />`,
    // Conflict — red dashed lightning between D and D′.
    `<line x1="${xDDP + w / 2}" y1="${yTop + h}" x2="${xDDP + w / 2}" y2="${yBot}" stroke="#dc2626" stroke-width="1" stroke-dasharray="2,2" />`,
  ];
  return parts.join('');
};

/**
 * Tree layout — bin entities by distance from the "sink" (the
 * single goal for goalTree, or the union of UDEs for CRT). Render
 * each bin as a row, with rows going bottom-up.
 */
const renderTree = (spec: TemplateSpec): string => {
  // Build adjacency.
  const childrenOf = new Map<string, string[]>(); // parent → list of children (incoming sources)
  for (const e of spec.entities) childrenOf.set(e.key, []);
  for (const edge of spec.edges) {
    childrenOf.get(edge.target)?.push(edge.source);
  }
  // Find sinks (no outgoing edges).
  const outDeg = new Map<string, number>();
  for (const e of spec.entities) outDeg.set(e.key, 0);
  for (const edge of spec.edges) outDeg.set(edge.source, (outDeg.get(edge.source) ?? 0) + 1);
  const sinks = spec.entities.filter((e) => (outDeg.get(e.key) ?? 0) === 0).map((e) => e.key);
  // BFS levels — sinks at level 0, things that feed them at 1, etc.
  const level = new Map<string, number>();
  for (const s of sinks) level.set(s, 0);
  const queue = [...sinks];
  while (queue.length > 0) {
    const cur = queue.shift();
    if (!cur) break;
    const curLevel = level.get(cur) ?? 0;
    for (const child of childrenOf.get(cur) ?? []) {
      if (!level.has(child)) {
        level.set(child, curLevel + 1);
        queue.push(child);
      }
    }
  }
  for (const e of spec.entities) if (!level.has(e.key)) level.set(e.key, 0);

  const byLevel = new Map<number, string[]>();
  for (const e of spec.entities) {
    const lv = level.get(e.key) ?? 0;
    if (!byLevel.has(lv)) byLevel.set(lv, []);
    byLevel.get(lv)?.push(e.key);
  }
  const maxLevel = Math.max(...byLevel.keys(), 0);
  const rowHeight = (THUMB_H - PAD * 2) / Math.max(maxLevel + 1, 1);
  const boxH = Math.min(Math.max(rowHeight - 4, 4), 10);

  // Walk every node first to compute (x, y) centers, then render
  // edges (behind) and nodes (above) in that order so strokes don't
  // cut through stripes.
  const centerByKey = new Map<string, { cx: number; cy: number }>();
  const nodeSvg: string[] = [];
  for (let lv = 0; lv <= maxLevel; lv++) {
    const row = byLevel.get(lv) ?? [];
    const count = row.length;
    const boxW = Math.min(
      28,
      (THUMB_W - PAD * 2 - 4 * Math.max(count - 1, 0)) / Math.max(count, 1)
    );
    const totalW = boxW * count + 4 * Math.max(count - 1, 0);
    const startX = (THUMB_W - totalW) / 2;
    // Lower levels (closer to sink) sit toward the top of the
    // thumbnail; higher levels (root causes) toward the bottom.
    const y = PAD + (maxLevel - lv) * rowHeight + (rowHeight - boxH) / 2;
    row.forEach((key, i) => {
      const x = startX + i * (boxW + 4);
      const ent = spec.entities.find((e) => e.key === key);
      if (!ent) return;
      nodeSvg.push(node(x, y, boxW, boxH, stripeFor(ent.type), '#ffffff'));
      centerByKey.set(key, { cx: x + boxW / 2, cy: y + boxH / 2 });
    });
  }
  const edgeStrokes = spec.edges
    .map((edge) => {
      const s = centerByKey.get(edge.source);
      const t = centerByKey.get(edge.target);
      if (!s || !t) return '';
      return `<line x1="${s.cx}" y1="${s.cy}" x2="${t.cx}" y2="${t.cy}" stroke="#cbd5e1" stroke-width="0.5" />`;
    })
    .join('');
  return `<rect width="${THUMB_W}" height="${THUMB_H}" fill="#fafafa" />${edgeStrokes}${nodeSvg.join('')}`;
};

/**
 * Build the SVG markup for a single template's preview thumbnail.
 * Returns the inner SVG (the caller wraps it in an `<svg>` element
 * via React with the right width / height).
 */
export const templateThumbnailSvg = (spec: TemplateSpec): string => {
  const body = spec.diagramType === 'ec' ? renderEC(spec) : renderTree(spec);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${THUMB_W} ${THUMB_H}" preserveAspectRatio="xMidYMid meet" aria-label="${escapeAttr(spec.title)} thumbnail">${body}</svg>`;
};

export const TEMPLATE_THUMBNAIL_VIEWBOX = { width: THUMB_W, height: THUMB_H };
