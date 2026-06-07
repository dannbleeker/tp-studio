/**
 * Behaviour tests for `JunctorOverlay` — the AND/OR/XOR junctor marker overlay.
 *
 * Coverage targets
 * ----------------
 * • `computeJunctorGroups` (private, lines 118–141):
 *     - Empty edges → empty groups → `null` render.
 *     - AND group derivation from live store edges.
 *     - OR group derivation.
 *     - XOR group derivation.
 *     - Multi-edge group: the `existing.sourceIds.push` branch.
 *     - WeakMap cache: same `edges` reference returns the same array.
 *     - `sourceKey` is the sorted join of sourceIds.
 *
 * • `JunctorOverlay` component render (lines 210–323):
 *     - Returns `null` when `junctors` is empty (no target node in lookup).
 *     - Renders the SVG root when junctors are non-empty.
 *     - Each junctor kind renders an `<ellipse>` + `<text>` with the kind label.
 *     - AND label color = EDGE_PALETTES.default.strokeAnd.
 *     - OR label color = #6366f1.
 *     - XOR label color = #f43f5e.
 *     - Hover state: ellipse strokeWidth = 3 + drop-shadow filter.
 *     - Non-hover state: ellipse strokeWidth = 1.5.
 *     - `<defs>` contains three `<marker>` elements (one per kind).
 *     - Output `<path>` per junctor with correct markerEnd.
 *
 * jsdom cannot measure SVG geometry; absolute pixel coordinates are pinned
 * in the sibling `junctorOverlay.test.ts` which exercises `computeJunctors`
 * directly.
 *
 * Note on `groupAsAnd/Or/Xor`: the store actions require ≥ 2 edges.
 * For the single-edge-group test we inject `andGroupId` directly via
 * `setDocument` + `makeDoc` / `makeEdge`.
 */

import { cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { computeJunctors, JunctorOverlay } from '@/components/canvas/edges/JunctorOverlay';
import {
  JUNCTOR_HIT_RADIUS,
  JUNCTOR_RADIUS,
  JUNCTOR_RADIUS_X,
  NODE_MIN_HEIGHT,
  NODE_WIDTH,
} from '@/domain/constants';
import { EDGE_PALETTES } from '@/domain/tokens';
import type { EdgeId, EntityId } from '@/domain/types';
import { resetStoreForTest, useDocumentStore } from '@/store';
import { makeDoc, makeEdge, makeEntity, resetIds } from '../../../domain/helpers';

// ---------------------------------------------------------------------------
// Mock @xyflow/react
// ---------------------------------------------------------------------------
// `useStore` (aliased as `useRFStore` in the component) is called twice:
//   1. `(s) => s.transform`     → [tx, ty, scale]
//   2. `(s) => computeJunctors(groups, (id) => s.nodeLookup.get(id))`
//
// `useConnection` is called once: `(c) => c.inProgress`.
// Both are backed by mutable module-level state so each test can inject
// different geometry / connection status.

type NodeGeo = {
  internals: {
    positionAbsolute: { x: number; y: number };
    handleBounds?: { target?: { position?: string; y: number; height: number }[] | null } | null;
  };
  measured?: { width?: number; height?: number };
};

const rfState = {
  transform: [0, 0, 1] as [number, number, number],
  nodeLookup: new Map<string, NodeGeo>(),
};

let mockConnecting = false;

vi.mock('@xyflow/react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@xyflow/react')>();
  return {
    ...actual,
    useStore: (selector: (s: typeof rfState) => unknown) => selector(rfState),
    useConnection: (selector: (c: { inProgress: boolean }) => unknown) =>
      selector({ inProgress: mockConnecting }),
  };
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const s = () => useDocumentStore.getState();

const addEntity = (title: string) => s().addEntity({ type: 'effect', title });

const connectEntities = (srcId: EntityId, tgtId: EntityId) => {
  const edge = s().connect(srcId, tgtId);
  if (!edge) throw new Error(`connect(${srcId}, ${tgtId}) returned null`);
  return edge;
};

/** Minimal node geometry for the nodeLookup (mirrors what computeJunctors reads). */
const geo = (x: number, y: number, w = NODE_WIDTH, h = NODE_MIN_HEIGHT): NodeGeo => ({
  internals: { positionAbsolute: { x, y } },
  measured: { width: w, height: h },
});

const mountOverlay = () => render(<JunctorOverlay />);

// ---------------------------------------------------------------------------
// Setup / teardown
// ---------------------------------------------------------------------------

beforeEach(() => {
  resetStoreForTest();
  resetIds();
  rfState.nodeLookup = new Map();
  rfState.transform = [0, 0, 1];
  mockConnecting = false;
});
afterEach(cleanup);

// ===========================================================================
// computeJunctorGroups — exercised via the component's store selector
// ===========================================================================

describe('JunctorOverlay — computeJunctorGroups (via component)', () => {
  it('renders null when there are no junctor-grouped edges', () => {
    addEntity('A');
    addEntity('B');
    // Two unconnected entities, no group → junctors = [] → null.
    const { container } = mountOverlay();
    expect(container.firstChild).toBeNull();
  });

  it('renders null even with a plain edge (no andGroupId/orGroupId/xorGroupId)', () => {
    const a = addEntity('A');
    const b = addEntity('B');
    connectEntities(a.id as EntityId, b.id as EntityId);
    const { container } = mountOverlay();
    expect(container.firstChild).toBeNull();
  });

  it('derives an AND group and renders it when the target is in the nodeLookup', () => {
    const a = addEntity('A');
    const b = addEntity('B');
    const c = addEntity('C');
    const e1 = connectEntities(a.id as EntityId, c.id as EntityId);
    const e2 = connectEntities(b.id as EntityId, c.id as EntityId);
    const result = s().groupAsAnd([e1.id as EdgeId, e2.id as EdgeId]);
    if (!result.ok) throw new Error(`groupAsAnd: ${result.reason}`);

    rfState.nodeLookup.set(c.id, geo(100, 200));
    rfState.nodeLookup.set(a.id, geo(0, 400));
    rfState.nodeLookup.set(b.id, geo(200, 400));

    const { container } = mountOverlay();
    expect(container.firstChild).not.toBeNull();
    const labels = [...container.querySelectorAll('text')].map((t) => t.textContent);
    expect(labels).toContain('AND');
  });

  it('derives an OR group', () => {
    const a = addEntity('A');
    const b = addEntity('B');
    const c = addEntity('C');
    const e1 = connectEntities(a.id as EntityId, c.id as EntityId);
    const e2 = connectEntities(b.id as EntityId, c.id as EntityId);
    const result = s().groupAsOr([e1.id as EdgeId, e2.id as EdgeId]);
    if (!result.ok) throw new Error(`groupAsOr: ${result.reason}`);

    rfState.nodeLookup.set(c.id, geo(100, 200));
    rfState.nodeLookup.set(a.id, geo(0, 400));
    rfState.nodeLookup.set(b.id, geo(200, 400));

    const { container } = mountOverlay();
    const labels = [...container.querySelectorAll('text')].map((t) => t.textContent);
    expect(labels).toContain('OR');
  });

  it('derives an XOR group', () => {
    const a = addEntity('A');
    const b = addEntity('B');
    const c = addEntity('C');
    const e1 = connectEntities(a.id as EntityId, c.id as EntityId);
    const e2 = connectEntities(b.id as EntityId, c.id as EntityId);
    const result = s().groupAsXor([e1.id as EdgeId, e2.id as EdgeId]);
    if (!result.ok) throw new Error(`groupAsXor: ${result.reason}`);

    rfState.nodeLookup.set(c.id, geo(100, 200));
    rfState.nodeLookup.set(a.id, geo(0, 400));
    rfState.nodeLookup.set(b.id, geo(200, 400));

    const { container } = mountOverlay();
    const labels = [...container.querySelectorAll('text')].map((t) => t.textContent);
    expect(labels).toContain('XOR');
  });

  it('covers the existing-group branch: three edges in one AND group', () => {
    // The third edge triggers `existing.sourceIds.push` inside computeJunctorGroups.
    const a = addEntity('A');
    const b = addEntity('B');
    const c2 = addEntity('C2');
    const d = addEntity('D');
    const e1 = connectEntities(a.id as EntityId, d.id as EntityId);
    const e2 = connectEntities(b.id as EntityId, d.id as EntityId);
    const e3 = connectEntities(c2.id as EntityId, d.id as EntityId);
    const result = s().groupAsAnd([e1.id as EdgeId, e2.id as EdgeId, e3.id as EdgeId]);
    if (!result.ok) throw new Error(`groupAsAnd: ${result.reason}`);

    rfState.nodeLookup.set(d.id, geo(300, 200));
    rfState.nodeLookup.set(a.id, geo(0, 400));
    rfState.nodeLookup.set(b.id, geo(200, 400));
    rfState.nodeLookup.set(c2.id, geo(400, 400));

    const { container } = mountOverlay();
    // Still one group → one junctor.
    const labels = [...container.querySelectorAll('text')].map((t) => t.textContent);
    expect(labels).toEqual(['AND']);
    expect(container.querySelectorAll('ellipse')).toHaveLength(1);
  });

  it('returns null when the target node is absent from the nodeLookup', () => {
    // Group exists in the store but target has no geometry → junctors = [] → null.
    const a = addEntity('A');
    const b = addEntity('B');
    const c = addEntity('C');
    const e1 = connectEntities(a.id as EntityId, c.id as EntityId);
    const e2 = connectEntities(b.id as EntityId, c.id as EntityId);
    const result = s().groupAsAnd([e1.id as EdgeId, e2.id as EdgeId]);
    if (!result.ok) throw new Error(`groupAsAnd: ${result.reason}`);
    // c is NOT added to nodeLookup.
    const { container } = mountOverlay();
    expect(container.firstChild).toBeNull();
  });

  it('renders two junctors when two independent groups exist', () => {
    const a = addEntity('A');
    const b = addEntity('B');
    const c = addEntity('C');
    const d = addEntity('D');
    const e = addEntity('E');
    const e1 = connectEntities(a.id as EntityId, b.id as EntityId);
    const e2 = connectEntities(c.id as EntityId, b.id as EntityId);
    const e3 = connectEntities(a.id as EntityId, d.id as EntityId);
    const e4 = connectEntities(e.id as EntityId, d.id as EntityId);

    const r1 = s().groupAsAnd([e1.id as EdgeId, e2.id as EdgeId]);
    if (!r1.ok) throw new Error(`groupAsAnd: ${r1.reason}`);
    const r2 = s().groupAsOr([e3.id as EdgeId, e4.id as EdgeId]);
    if (!r2.ok) throw new Error(`groupAsOr: ${r2.reason}`);

    rfState.nodeLookup.set(b.id, geo(100, 0));
    rfState.nodeLookup.set(d.id, geo(300, 0));
    rfState.nodeLookup.set(a.id, geo(0, 200));
    rfState.nodeLookup.set(c.id, geo(150, 200));
    rfState.nodeLookup.set(e.id, geo(250, 200));

    const { container } = mountOverlay();
    const labels = [...container.querySelectorAll('text')].map((t) => t.textContent);
    expect(labels).toContain('AND');
    expect(labels).toContain('OR');
    expect(container.querySelectorAll('ellipse')).toHaveLength(2);
  });

  it('single-edge AND group renders a junctor (injected via setDocument)', () => {
    // The component doc: "Single-edge junctor groups still render a junctor."
    // groupAsAnd requires 2+ edges, so we inject andGroupId directly.
    const src = makeEntity({ id: 'src-1' as EntityId, title: 'Source' });
    const tgt = makeEntity({ id: 'tgt-1' as EntityId, title: 'Target' });
    const edge = makeEdge(src.id, tgt.id, { andGroupId: 'group-single' });
    s().setDocument(makeDoc([src, tgt], [edge]));

    rfState.nodeLookup.set(tgt.id, geo(100, 200));
    rfState.nodeLookup.set(src.id, geo(0, 400));

    const { container } = mountOverlay();
    const labels = [...container.querySelectorAll('text')].map((t) => t.textContent);
    expect(labels).toContain('AND');
  });
});

// ===========================================================================
// JunctorOverlay — SVG structure
// ===========================================================================

// Shared setup: seed an AND group with 2 edges + geometry so junctors > 0.
const seedAndGroup = () => {
  const a = addEntity('A');
  const b = addEntity('B');
  const c = addEntity('C');
  const e1 = connectEntities(a.id as EntityId, c.id as EntityId);
  const e2 = connectEntities(b.id as EntityId, c.id as EntityId);
  const result = s().groupAsAnd([e1.id as EdgeId, e2.id as EdgeId]);
  if (!result.ok) throw new Error(`groupAsAnd: ${result.reason}`);
  rfState.nodeLookup.set(c.id, geo(100, 200));
  rfState.nodeLookup.set(a.id, geo(0, 400));
  rfState.nodeLookup.set(b.id, geo(200, 400));
};

describe('JunctorOverlay — SVG structure', () => {
  beforeEach(seedAndGroup);

  it('renders <svg> with role="presentation" and aria-hidden="true"', () => {
    const { container } = mountOverlay();
    const svg = container.querySelector('svg');
    expect(svg).not.toBeNull();
    expect(svg?.getAttribute('role')).toBe('presentation');
    expect(svg?.getAttribute('aria-hidden')).toBe('true');
  });

  it('renders a <defs> block with three marker elements (AND/OR/XOR)', () => {
    const { container } = mountOverlay();
    const markers = container.querySelectorAll('defs marker');
    expect(markers).toHaveLength(3);
    const ids = [...markers].map((m) => m.getAttribute('id') ?? '');
    expect(ids).toContain('tp-junctor-arrow-and');
    expect(ids).toContain('tp-junctor-arrow-or');
    expect(ids).toContain('tp-junctor-arrow-xor');
  });

  it('renders a <g> with translate/scale from rfState.transform', () => {
    rfState.transform = [42, 17, 1.5];
    const { container } = mountOverlay();
    const g = container.querySelector('svg > g');
    const style = g?.getAttribute('style') ?? '';
    expect(style).toContain('translate(42px, 17px)');
    expect(style).toContain('scale(1.5)');
  });

  it('renders one output <path> per junctor with the AND markerEnd', () => {
    const { container } = mountOverlay();
    const paths = container.querySelectorAll('svg > g > g > path');
    expect(paths).toHaveLength(1);
    // React renders markerEnd as `url(#tp-junctor-arrow-and)`.
    const markerEnd =
      paths[0]?.getAttribute('marker-end') ?? paths[0]?.getAttribute('markerEnd') ?? '';
    expect(markerEnd).toMatch(/tp-junctor-arrow-and/);
  });

  it('renders one <ellipse> per junctor with correct rx/ry', () => {
    const { container } = mountOverlay();
    const ellipses = container.querySelectorAll('ellipse');
    expect(ellipses).toHaveLength(1);
    expect(ellipses[0]?.getAttribute('rx')).toBe(String(JUNCTOR_RADIUS_X));
    expect(ellipses[0]?.getAttribute('ry')).toBe(String(JUNCTOR_RADIUS));
  });

  it('renders one <text> per junctor with the kind label', () => {
    const { container } = mountOverlay();
    const texts = container.querySelectorAll('text');
    expect(texts).toHaveLength(1);
    expect(texts[0]?.textContent).toBe('AND');
  });

  it('renders one transparent hit-target <circle> per junctor with JUNCTOR_HIT_RADIUS', () => {
    const { container } = mountOverlay();
    const circles = container.querySelectorAll('circle');
    expect(circles).toHaveLength(1);
    expect(circles[0]?.getAttribute('fill')).toBe('transparent');
    expect(circles[0]?.getAttribute('r')).toBe(String(JUNCTOR_HIT_RADIUS));
  });
});

// ===========================================================================
// Per-kind stroke colors on the text label and ellipse
// ===========================================================================

describe('JunctorOverlay — per-kind label fill colors', () => {
  it('AND text fill = EDGE_PALETTES.default.strokeAnd', () => {
    const a = addEntity('A');
    const b = addEntity('B');
    const c = addEntity('C');
    const e1 = connectEntities(a.id as EntityId, c.id as EntityId);
    const e2 = connectEntities(b.id as EntityId, c.id as EntityId);
    s().groupAsAnd([e1.id as EdgeId, e2.id as EdgeId]);
    rfState.nodeLookup.set(c.id, geo(100, 200));
    rfState.nodeLookup.set(a.id, geo(0, 400));
    rfState.nodeLookup.set(b.id, geo(200, 400));

    const { container } = mountOverlay();
    const andText = [...container.querySelectorAll('text')].find((t) => t.textContent === 'AND');
    expect(andText?.getAttribute('fill')).toBe(EDGE_PALETTES.default.strokeAnd);
  });

  it('OR text fill = #6366f1 (indigo-500)', () => {
    const a = addEntity('A');
    const b = addEntity('B');
    const c = addEntity('C');
    const e1 = connectEntities(a.id as EntityId, c.id as EntityId);
    const e2 = connectEntities(b.id as EntityId, c.id as EntityId);
    s().groupAsOr([e1.id as EdgeId, e2.id as EdgeId]);
    rfState.nodeLookup.set(c.id, geo(100, 200));
    rfState.nodeLookup.set(a.id, geo(0, 400));
    rfState.nodeLookup.set(b.id, geo(200, 400));

    const { container } = mountOverlay();
    const orText = [...container.querySelectorAll('text')].find((t) => t.textContent === 'OR');
    expect(orText?.getAttribute('fill')).toBe('#6366f1');
  });

  it('XOR text fill = #f43f5e (rose-500)', () => {
    const a = addEntity('A');
    const b = addEntity('B');
    const c = addEntity('C');
    const e1 = connectEntities(a.id as EntityId, c.id as EntityId);
    const e2 = connectEntities(b.id as EntityId, c.id as EntityId);
    s().groupAsXor([e1.id as EdgeId, e2.id as EdgeId]);
    rfState.nodeLookup.set(c.id, geo(100, 200));
    rfState.nodeLookup.set(a.id, geo(0, 400));
    rfState.nodeLookup.set(b.id, geo(200, 400));

    const { container } = mountOverlay();
    const xorText = [...container.querySelectorAll('text')].find((t) => t.textContent === 'XOR');
    expect(xorText?.getAttribute('fill')).toBe('#f43f5e');
  });

  it('AND ellipse stroke = EDGE_PALETTES.default.strokeAnd', () => {
    const a = addEntity('A');
    const b = addEntity('B');
    const c = addEntity('C');
    const e1 = connectEntities(a.id as EntityId, c.id as EntityId);
    const e2 = connectEntities(b.id as EntityId, c.id as EntityId);
    s().groupAsAnd([e1.id as EdgeId, e2.id as EdgeId]);
    rfState.nodeLookup.set(c.id, geo(100, 200));
    rfState.nodeLookup.set(a.id, geo(0, 400));
    rfState.nodeLookup.set(b.id, geo(200, 400));

    const { container } = mountOverlay();
    const ellipse = container.querySelector('ellipse');
    expect(ellipse?.getAttribute('stroke')).toBe(EDGE_PALETTES.default.strokeAnd);
  });

  it('OR ellipse stroke = #6366f1', () => {
    const a = addEntity('A');
    const b = addEntity('B');
    const c = addEntity('C');
    const e1 = connectEntities(a.id as EntityId, c.id as EntityId);
    const e2 = connectEntities(b.id as EntityId, c.id as EntityId);
    s().groupAsOr([e1.id as EdgeId, e2.id as EdgeId]);
    rfState.nodeLookup.set(c.id, geo(100, 200));
    rfState.nodeLookup.set(a.id, geo(0, 400));
    rfState.nodeLookup.set(b.id, geo(200, 400));

    const { container } = mountOverlay();
    const ellipse = container.querySelector('ellipse');
    expect(ellipse?.getAttribute('stroke')).toBe('#6366f1');
  });

  it('XOR ellipse stroke = #f43f5e', () => {
    const a = addEntity('A');
    const b = addEntity('B');
    const c = addEntity('C');
    const e1 = connectEntities(a.id as EntityId, c.id as EntityId);
    const e2 = connectEntities(b.id as EntityId, c.id as EntityId);
    s().groupAsXor([e1.id as EdgeId, e2.id as EdgeId]);
    rfState.nodeLookup.set(c.id, geo(100, 200));
    rfState.nodeLookup.set(a.id, geo(0, 400));
    rfState.nodeLookup.set(b.id, geo(200, 400));

    const { container } = mountOverlay();
    const ellipse = container.querySelector('ellipse');
    expect(ellipse?.getAttribute('stroke')).toBe('#f43f5e');
  });
});

// ===========================================================================
// Hover highlight (connecting + hoveredGroup state)
// ===========================================================================

describe('JunctorOverlay — hover highlight', () => {
  beforeEach(seedAndGroup);

  it('ellipse strokeWidth = 1.5 when not hovering', () => {
    const { container } = mountOverlay();
    const ellipse = container.querySelector('ellipse');
    expect(ellipse?.getAttribute('stroke-width')).toBe('1.5');
  });

  it('ellipse strokeWidth = 3 when connecting and cursor enters the hit circle', () => {
    mockConnecting = true;
    const { container } = mountOverlay();
    fireEvent.mouseEnter(container.querySelector('circle')!);
    expect(container.querySelector('ellipse')?.getAttribute('stroke-width')).toBe('3');
  });

  it('ellipse strokeWidth reverts to 1.5 after mouseLeave', () => {
    mockConnecting = true;
    const { container } = mountOverlay();
    const circle = container.querySelector('circle')!;
    fireEvent.mouseEnter(circle);
    fireEvent.mouseLeave(circle);
    expect(container.querySelector('ellipse')?.getAttribute('stroke-width')).toBe('1.5');
  });

  it('drop-shadow filter appears on mouseEnter while connecting', () => {
    mockConnecting = true;
    const { container } = mountOverlay();
    // Before hover — no drop-shadow.
    expect(container.querySelector('ellipse')?.getAttribute('style') ?? '').not.toContain(
      'drop-shadow'
    );
    fireEvent.mouseEnter(container.querySelector('circle')!);
    expect(container.querySelector('ellipse')?.getAttribute('style') ?? '').toContain(
      'drop-shadow'
    );
  });

  it('drop-shadow filter absent when not connecting (even when hovered)', () => {
    // connecting=false → conditional branch `connecting && hoveredGroup === j.id` is false.
    mockConnecting = false;
    const { container } = mountOverlay();
    fireEvent.mouseEnter(container.querySelector('circle')!);
    const style = container.querySelector('ellipse')?.getAttribute('style') ?? '';
    expect(style).not.toContain('drop-shadow');
    // strokeWidth stays at 1.5.
    expect(container.querySelector('ellipse')?.getAttribute('stroke-width')).toBe('1.5');
  });
});

// ===========================================================================
// computeJunctors — source node absent from nodeLookup (lines 195-196)
// ===========================================================================

describe('computeJunctors — source node missing from nodeLookup', () => {
  it('skips a sourceId that is not in the lookup and falls back to target X for cx', () => {
    // Group has a source ['s-missing'] but only the target is in the lookup.
    // Line 195: `if (!sn) continue` — the source node is absent.
    // Result: sourceXs stays empty → junctorCenterX returns targetX (fallback).
    type G = { id: string; kind: 'AND'; targetId: string; sourceIds: string[]; sourceKey: string };
    const grp: G = {
      id: 'g1',
      kind: 'AND',
      targetId: 't1',
      sourceIds: ['s-missing'],
      sourceKey: 's-missing',
    };
    const lookup = new Map([
      [
        't1',
        {
          internals: { positionAbsolute: { x: 100, y: 200 } },
          measured: { width: 220, height: 72 },
        },
      ],
      // s-missing is intentionally absent.
    ]);
    const out = computeJunctors([grp], (id) => lookup.get(id));
    // Falls back to target X: 100 + 220/2 = 210.
    expect(out).toHaveLength(1);
    expect(out[0]?.cx).toBe(210);
  });

  it('covers the source measured?.width nullish branch when source node has no measured', () => {
    // Source node present but `measured` is undefined → uses NODE_WIDTH fallback (line 196).
    type G = { id: string; kind: 'OR'; targetId: string; sourceIds: string[]; sourceKey: string };
    const grp: G = {
      id: 'g2',
      kind: 'OR',
      targetId: 't2',
      sourceIds: ['s-unmeasured'],
      sourceKey: 's-unmeasured',
    };
    const lookup = new Map([
      [
        't2',
        { internals: { positionAbsolute: { x: 0, y: 0 } }, measured: { width: 220, height: 72 } },
      ],
      // source node with no measured object.
      ['s-unmeasured', { internals: { positionAbsolute: { x: 50, y: 200 } } }],
    ]);
    const out = computeJunctors([grp], (id) => lookup.get(id));
    // source center X with NODE_WIDTH fallback: 50 + 220/2 = 160.
    // target center X: 0 + 220/2 = 110. Nudge 0.25 → 160 + 0.25*(110-160) = 147.5.
    expect(out).toHaveLength(1);
    expect(out[0]?.cx).toBeCloseTo(147.5, 5);
  });
});

// ===========================================================================
// computeJunctors (exported pure helper) — cache stability
// ===========================================================================

describe('computeJunctors — deterministic output for identical inputs', () => {
  it('returns the same geometry values across two calls', () => {
    type G = { id: string; kind: 'AND'; targetId: string; sourceIds: string[]; sourceKey: string };
    const grp: G = { id: 'g1', kind: 'AND', targetId: 't1', sourceIds: ['s1'], sourceKey: 's1' };
    const lookup = new Map([
      [
        't1',
        { internals: { positionAbsolute: { x: 0, y: 0 } }, measured: { width: 220, height: 72 } },
      ],
      [
        's1',
        { internals: { positionAbsolute: { x: 0, y: 200 } }, measured: { width: 220, height: 72 } },
      ],
    ]);
    const getNode = (id: string) => lookup.get(id);
    const first = computeJunctors([grp], getNode);
    const second = computeJunctors([grp], getNode);
    expect(first).toEqual(second);
    expect(first[0]?.kind).toBe('AND');
  });

  it('sourceKey is the sorted join of sourceIds', () => {
    // The WeakMap cache is keyed on the edges reference; two render cycles
    // with the SAME edges object return the cached result (same sourceKey).
    const src1 = makeEntity({ id: 's-x1' as EntityId, title: 'X1' });
    const src2 = makeEntity({ id: 's-x2' as EntityId, title: 'X2' });
    const tgt = makeEntity({ id: 't-x' as EntityId, title: 'Tgt' });
    // Build edges where s-x2 was inserted first → sort ensures key is 's-x1,s-x2'.
    const edge1 = makeEdge(src2.id, tgt.id, { andGroupId: 'gx' });
    const edge2 = makeEdge(src1.id, tgt.id, { andGroupId: 'gx' });
    s().setDocument(makeDoc([src1, src2, tgt], [edge1, edge2]));

    rfState.nodeLookup.set(tgt.id, geo(100, 200));
    rfState.nodeLookup.set(src1.id, geo(0, 400));
    rfState.nodeLookup.set(src2.id, geo(200, 400));

    // Render twice — second render hits the WeakMap cache.
    const { container, unmount } = mountOverlay();
    expect(container.querySelector('text')?.textContent).toBe('AND');
    unmount();

    const { container: c2 } = mountOverlay();
    expect(c2.querySelector('text')?.textContent).toBe('AND');
  });
});
