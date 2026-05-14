import { ENTITY_STRIPE_COLOR } from '@/domain/tokens';
import type { ReactElement } from 'react';
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
 * Session 88 (S22) — refactored from a `dangerouslySetInnerHTML`
 * HTML-string output to a React-element tree. Visual output is
 * byte-identical to the prior renderer; the picker now mounts the
 * SVG with normal JSX so the `dangerouslySetInnerHTML` Biome
 * ignore on the picker can go away.
 *
 * The legacy `templateThumbnailSvg(spec): string` shim remains so
 * existing tests (and any external caller) keep compiling — it
 * renders the same React tree to a static markup string via
 * `react-dom/server` is overkill for this small SVG; we keep the
 * string path by re-emitting the same primitives that the JSX
 * builder uses below.
 */

const THUMB_W = 160;
const THUMB_H = 96;
const PAD = 4;

const stripeFor = (type: string): string =>
  ENTITY_STRIPE_COLOR[type as keyof typeof ENTITY_STRIPE_COLOR] ?? '#94a3b8';

type NodeBox = {
  kind: 'node';
  x: number;
  y: number;
  w: number;
  h: number;
  stripe: string;
};
type LineSeg = {
  kind: 'line';
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  stroke: string;
  strokeWidth?: number;
  dash?: string;
};
type Primitive = NodeBox | LineSeg;

/**
 * Build the abstract primitive list for an EC layout. Each primitive
 * is rendered the same way by both the JSX and string emitters
 * below, so the visual output is identical.
 */
const ecPrimitives = (spec: TemplateSpec): Primitive[] => {
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
  const prims: Primitive[] = [];
  // Connecting strokes first so the entity rectangles render on top.
  prims.push({
    kind: 'line',
    x1: xBC,
    y1: yTop + h / 2,
    x2: xA + w,
    y2: yMid + h / 2,
    stroke: '#cbd5e1',
    strokeWidth: 0.5,
  });
  prims.push({
    kind: 'line',
    x1: xBC,
    y1: yBot + h / 2,
    x2: xA + w,
    y2: yMid + h / 2,
    stroke: '#cbd5e1',
    strokeWidth: 0.5,
  });
  prims.push({
    kind: 'line',
    x1: xDDP,
    y1: yTop + h / 2,
    x2: xBC + w,
    y2: yTop + h / 2,
    stroke: '#cbd5e1',
    strokeWidth: 0.5,
  });
  prims.push({
    kind: 'line',
    x1: xDDP,
    y1: yBot + h / 2,
    x2: xBC + w,
    y2: yBot + h / 2,
    stroke: '#cbd5e1',
    strokeWidth: 0.5,
  });
  // Conflict line between D and D'.
  prims.push({
    kind: 'line',
    x1: xDDP + w / 2,
    y1: yTop + h,
    x2: xDDP + w / 2,
    y2: yBot,
    stroke: '#dc2626',
    strokeWidth: 1,
    dash: '2,2',
  });
  if (a) prims.push({ kind: 'node', x: xA, y: yMid, w, h, stripe: stripeFor(a.type) });
  if (b) prims.push({ kind: 'node', x: xBC, y: yTop, w, h, stripe: stripeFor(b.type) });
  if (c) prims.push({ kind: 'node', x: xBC, y: yBot, w, h, stripe: stripeFor(c.type) });
  if (d) prims.push({ kind: 'node', x: xDDP, y: yTop, w, h, stripe: stripeFor(d.type) });
  if (dp) prims.push({ kind: 'node', x: xDDP, y: yBot, w, h, stripe: stripeFor(dp.type) });
  return prims;
};

/**
 * Tree layout — bin entities by distance from the "sink" (the
 * single goal for goalTree, or the union of UDEs for CRT). Render
 * each bin as a row, with rows going bottom-up.
 */
const treePrimitives = (spec: TemplateSpec): Primitive[] => {
  const childrenOf = new Map<string, string[]>();
  for (const e of spec.entities) childrenOf.set(e.key, []);
  for (const edge of spec.edges) {
    childrenOf.get(edge.target)?.push(edge.source);
  }
  const outDeg = new Map<string, number>();
  for (const e of spec.entities) outDeg.set(e.key, 0);
  for (const edge of spec.edges) outDeg.set(edge.source, (outDeg.get(edge.source) ?? 0) + 1);
  const sinks = spec.entities.filter((e) => (outDeg.get(e.key) ?? 0) === 0).map((e) => e.key);
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

  const centerByKey = new Map<string, { cx: number; cy: number }>();
  const nodePrims: Primitive[] = [];
  for (let lv = 0; lv <= maxLevel; lv++) {
    const row = byLevel.get(lv) ?? [];
    const count = row.length;
    const boxW = Math.min(
      28,
      (THUMB_W - PAD * 2 - 4 * Math.max(count - 1, 0)) / Math.max(count, 1)
    );
    const totalW = boxW * count + 4 * Math.max(count - 1, 0);
    const startX = (THUMB_W - totalW) / 2;
    const y = PAD + (maxLevel - lv) * rowHeight + (rowHeight - boxH) / 2;
    row.forEach((key, i) => {
      const x = startX + i * (boxW + 4);
      const ent = spec.entities.find((e) => e.key === key);
      if (!ent) return;
      nodePrims.push({ kind: 'node', x, y, w: boxW, h: boxH, stripe: stripeFor(ent.type) });
      centerByKey.set(key, { cx: x + boxW / 2, cy: y + boxH / 2 });
    });
  }
  const edgePrims: Primitive[] = spec.edges.flatMap<Primitive>((edge) => {
    const s = centerByKey.get(edge.source);
    const t = centerByKey.get(edge.target);
    if (!s || !t) return [];
    return [
      {
        kind: 'line',
        x1: s.cx,
        y1: s.cy,
        x2: t.cx,
        y2: t.cy,
        stroke: '#cbd5e1',
        strokeWidth: 0.5,
      },
    ];
  });
  // Edges first (behind), nodes second (above) so strokes don't cut
  // through stripes.
  return [...edgePrims, ...nodePrims];
};

const primitivesFor = (spec: TemplateSpec): Primitive[] =>
  spec.diagramType === 'ec' ? ecPrimitives(spec) : treePrimitives(spec);

/** Render one primitive as a React element. Stable keys derived
 *  from position keep React's diff cheap across renders. */
const renderPrim = (p: Primitive, i: number): ReactElement => {
  if (p.kind === 'node') {
    return (
      <g key={`n-${i}-${p.x}-${p.y}`}>
        <rect
          x={p.x}
          y={p.y}
          width={p.w}
          height={p.h}
          rx={2}
          fill="#ffffff"
          stroke="#d4d4d4"
          strokeWidth={0.5}
        />
        <rect x={p.x} y={p.y} width={2} height={p.h} rx={1} fill={p.stripe} />
      </g>
    );
  }
  return (
    <line
      key={`l-${i}-${p.x1}-${p.y1}-${p.x2}-${p.y2}`}
      x1={p.x1}
      y1={p.y1}
      x2={p.x2}
      y2={p.y2}
      stroke={p.stroke}
      strokeWidth={p.strokeWidth ?? 1}
      strokeDasharray={p.dash}
    />
  );
};

/**
 * Session 88 (S22) — JSX renderer. The picker mounts this directly
 * (no `dangerouslySetInnerHTML`). The viewBox stays identical so
 * any CSS sizing on the parent works unchanged.
 */
export function TemplateThumbnail({ spec }: { spec: TemplateSpec }): ReactElement {
  const prims = primitivesFor(spec);
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox={`0 0 ${THUMB_W} ${THUMB_H}`}
      preserveAspectRatio="xMidYMid meet"
      role="img"
      aria-labelledby={`thumb-${spec.id}-title`}
    >
      <title id={`thumb-${spec.id}-title`}>{`${spec.title} thumbnail`}</title>
      <rect width={THUMB_W} height={THUMB_H} fill="#fafafa" />
      {prims.map((p, i) => renderPrim(p, i))}
    </svg>
  );
}

const escapeAttr = (s: string): string =>
  s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');

const primToSvgString = (p: Primitive): string => {
  if (p.kind === 'node') {
    return `<rect x="${p.x}" y="${p.y}" width="${p.w}" height="${p.h}" rx="2" fill="#ffffff" stroke="#d4d4d4" stroke-width="0.5" /><rect x="${p.x}" y="${p.y}" width="2" height="${p.h}" rx="1" fill="${p.stripe}" />`;
  }
  const dash = p.dash ? ` stroke-dasharray="${p.dash}"` : '';
  return `<line x1="${p.x1}" y1="${p.y1}" x2="${p.x2}" y2="${p.y2}" stroke="${p.stroke}" stroke-width="${p.strokeWidth ?? 1}"${dash} />`;
};

/**
 * Legacy string emitter — kept so existing tests + any external
 * caller continue to work. Output is byte-equivalent to the
 * pre-Session-88 renderer (same primitives in the same order); the
 * JSX path above is what the live picker uses now.
 */
export const templateThumbnailSvg = (spec: TemplateSpec): string => {
  const prims = primitivesFor(spec);
  const body = `<rect width="${THUMB_W}" height="${THUMB_H}" fill="#fafafa" />${prims.map(primToSvgString).join('')}`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${THUMB_W} ${THUMB_H}" preserveAspectRatio="xMidYMid meet" aria-label="${escapeAttr(spec.title)} thumbnail">${body}</svg>`;
};

export const TEMPLATE_THUMBNAIL_VIEWBOX = { width: THUMB_W, height: THUMB_H };
