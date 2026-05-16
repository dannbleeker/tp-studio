/**
 * Session 106 — Pin the `React.memo` comparator on TPEdge + TPNode.
 *
 * Session 105 / Tier 1 #6 replaced the default shallow-equal memo
 * comparator with a custom one that does shallow-equality *on* the
 * `data` prop's contents (rather than referential equality of `data`
 * itself). The default-memo bailed for every component on every
 * emission because `useGraph*Emission` rebuilds each component's
 * `data` literal as a fresh spread.
 *
 * Initial approach was to mount the component inside React's
 * `Profiler` and count `onRender` callbacks before/after a re-render
 * with same-content-different-reference props. That turned out to be
 * unreliable: `Profiler.onRender` fires for reconciliation work on
 * the surrounding tree even when the memo'd component itself bails.
 *
 * Direct comparator unit tests are the cleaner discipline: they pin
 * the function's logic without relying on React's render scheduler.
 * If the comparator returns `true`, React skips the re-render — and
 * vice versa.
 */
import { shallowEqualObject, tpEdgePropsEqual } from '@/components/canvas/TPEdge';
import { tpNodePropsEqual } from '@/components/canvas/TPNode';
import { describe, expect, it } from 'vitest';

const makeEdgeProps = (overrides: Record<string, unknown> = {}) =>
  ({
    id: 'edge-1',
    source: 'a',
    target: 'b',
    sourceX: 0,
    sourceY: 0,
    targetX: 100,
    targetY: 100,
    sourcePosition: 'bottom' as const,
    targetPosition: 'top' as const,
    data: {},
    selected: false,
    markerEnd: undefined,
    markerStart: undefined,
    ...overrides,
  }) as unknown as Parameters<typeof tpEdgePropsEqual>[0];

const makeNodeProps = (overrides: Record<string, unknown> = {}) =>
  ({
    id: 'node-1',
    type: 'tp',
    data: { entity: { id: 'e-1' } },
    selected: false,
    dragging: false,
    positionAbsoluteX: 0,
    positionAbsoluteY: 0,
    ...overrides,
  }) as unknown as Parameters<typeof tpNodePropsEqual>[0];

describe('shallowEqualObject', () => {
  it('returns true for the same reference', () => {
    const obj = { a: 1, b: 2 };
    expect(shallowEqualObject(obj, obj)).toBe(true);
  });
  it('returns true for distinct objects with identical key/value pairs', () => {
    expect(shallowEqualObject({ a: 1, b: 2 }, { a: 1, b: 2 })).toBe(true);
  });
  it('returns false when a value differs', () => {
    expect(shallowEqualObject({ a: 1 }, { a: 2 })).toBe(false);
  });
  it('returns false when key counts differ', () => {
    expect(shallowEqualObject({ a: 1 }, { a: 1, b: 2 })).toBe(false);
  });
  it('returns true for two empty objects', () => {
    expect(shallowEqualObject({}, {})).toBe(true);
  });
  it('returns false when either is null', () => {
    expect(shallowEqualObject(null, {})).toBe(false);
    expect(shallowEqualObject({}, null)).toBe(false);
  });
  it('returns true when both are null', () => {
    expect(shallowEqualObject(null, null)).toBe(true);
  });
  it('returns false when nested objects have distinct references (deliberate — this is shallow)', () => {
    const inner1 = { x: 1 };
    const inner2 = { x: 1 };
    expect(shallowEqualObject({ a: inner1 }, { a: inner2 })).toBe(false);
  });
});

describe('tpEdgePropsEqual — the TPEdge memo comparator', () => {
  it('returns TRUE when data is a fresh object with identical content (the Tier 1 #6 fix case)', () => {
    const a = makeEdgeProps({ data: { aggregateCount: 0 } });
    const b = makeEdgeProps({ data: { aggregateCount: 0 } });
    // Different references…
    expect(a.data).not.toBe(b.data);
    // …but shallow-equal content → comparator returns true → memo bails.
    expect(tpEdgePropsEqual(a, b)).toBe(true);
  });
  it('returns FALSE when an actual data field changes', () => {
    const a = makeEdgeProps({ data: { aggregateCount: 0 } });
    const b = makeEdgeProps({ data: { aggregateCount: 3 } });
    expect(tpEdgePropsEqual(a, b)).toBe(false);
  });
  it('returns FALSE when `selected` flips', () => {
    expect(
      tpEdgePropsEqual(makeEdgeProps({ selected: false }), makeEdgeProps({ selected: true }))
    ).toBe(false);
  });
  it('returns FALSE when `id` changes', () => {
    expect(tpEdgePropsEqual(makeEdgeProps({ id: 'e1' }), makeEdgeProps({ id: 'e2' }))).toBe(false);
  });
  it('returns FALSE when geometry changes', () => {
    expect(tpEdgePropsEqual(makeEdgeProps({ sourceX: 0 }), makeEdgeProps({ sourceX: 50 }))).toBe(
      false
    );
    expect(tpEdgePropsEqual(makeEdgeProps({ targetY: 100 }), makeEdgeProps({ targetY: 200 }))).toBe(
      false
    );
  });
  it('returns FALSE when source/target node id changes', () => {
    expect(tpEdgePropsEqual(makeEdgeProps({ source: 'a' }), makeEdgeProps({ source: 'c' }))).toBe(
      false
    );
  });
  it('returns FALSE when sourcePosition / targetPosition changes', () => {
    expect(
      tpEdgePropsEqual(
        makeEdgeProps({ sourcePosition: 'bottom' as const }),
        makeEdgeProps({ sourcePosition: 'top' as const })
      )
    ).toBe(false);
  });
  it('returns TRUE when only an unchecked prop drifts (defends the comparator against noise)', () => {
    // The comparator deliberately ignores props React Flow may attach
    // that don't affect TPEdge's render output. The full prop list
    // grew once already; the comparator should remain a positive
    // allowlist of the props that matter.
    const a = makeEdgeProps();
    const b = { ...a, somethingExtra: 'wobble' } as unknown as typeof a;
    expect(tpEdgePropsEqual(a, b)).toBe(true);
  });
});

describe('tpNodePropsEqual — the TPNode memo comparator', () => {
  it('returns TRUE when data is a fresh object with identical content', () => {
    const inner = { id: 'e-1' };
    const a = makeNodeProps({ data: { entity: inner } });
    const b = makeNodeProps({ data: { entity: inner } });
    expect(a.data).not.toBe(b.data);
    expect(tpNodePropsEqual(a, b)).toBe(true);
  });
  it('returns FALSE when the entity reference inside data changes', () => {
    const a = makeNodeProps({ data: { entity: { id: 'e-1' } } });
    const b = makeNodeProps({ data: { entity: { id: 'e-2' } } });
    expect(tpNodePropsEqual(a, b)).toBe(false);
  });
  it('returns FALSE when udeReachCount appears in data (extra optional field)', () => {
    const e = { id: 'e-1' };
    const a = makeNodeProps({ data: { entity: e } });
    const b = makeNodeProps({ data: { entity: e, udeReachCount: 3 } });
    expect(tpNodePropsEqual(a, b)).toBe(false);
  });
  it('returns FALSE when selection state flips', () => {
    expect(
      tpNodePropsEqual(makeNodeProps({ selected: false }), makeNodeProps({ selected: true }))
    ).toBe(false);
  });
  it('returns FALSE when dragging flips', () => {
    expect(
      tpNodePropsEqual(makeNodeProps({ dragging: false }), makeNodeProps({ dragging: true }))
    ).toBe(false);
  });
  it('returns FALSE when absolute position changes', () => {
    expect(
      tpNodePropsEqual(
        makeNodeProps({ positionAbsoluteX: 0 }),
        makeNodeProps({ positionAbsoluteX: 50 })
      )
    ).toBe(false);
  });
});
