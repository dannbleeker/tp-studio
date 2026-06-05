/**
 * Session 171 — Unit tests for the shared junctor geometry (`junctorCenterX` +
 * `collectGroupSourceIds`). These pin the "junctor follows its causes" placement
 * that both JunctorOverlay and TPEdge rely on, so the circle and the cause-edge
 * termini can't drift apart.
 */

import { describe, expect, it } from 'vitest';
import {
  collectGroupSourceIds,
  JUNCTOR_NUDGE_TOWARD_TARGET,
  junctorCenterX,
  junctorKindField,
  junctorOutputPath,
  junctorSourceAnchor,
} from '@/components/canvas/edges/junctorGeometry';
import type { TPDocument } from '@/domain/types';

describe('junctorCenterX', () => {
  it('falls back to the target X when no cause positions are known', () => {
    expect(junctorCenterX([], 500)).toBe(500);
  });

  it('sits exactly over the causes midpoint with no nudge', () => {
    // Causes at 100 and 300 → midpoint 200; nudge 0 keeps it there.
    expect(junctorCenterX([100, 300], 1000, 0)).toBe(200);
  });

  it('slides toward the target by the nudge fraction', () => {
    // midpoint 200, target 1000, nudge 0.25 → 200 + 0.25*(1000-200) = 400.
    expect(junctorCenterX([100, 300], 1000, 0.25)).toBe(400);
  });

  it('reduces to the target X when nudge is 1 (the old under-target behaviour)', () => {
    expect(junctorCenterX([100, 300], 1000, 1)).toBe(1000);
  });

  it('barely moves when the causes already sit under the target', () => {
    // A single cause directly below the target → centroid ≈ target, so the
    // default nudge leaves it essentially where it was (no regression for the
    // well-placed common case).
    expect(junctorCenterX([500], 500)).toBe(500);
  });

  it('defaults to a gentle nudge toward the target', () => {
    // midpoint 0, target 100 → 0 + DEFAULT*(100) = 100*DEFAULT.
    expect(junctorCenterX([-100, 100], 100)).toBeCloseTo(100 * JUNCTOR_NUDGE_TOWARD_TARGET, 6);
  });
});

describe('collectGroupSourceIds', () => {
  const edges = {
    e1: { id: 'e1', sourceId: 'A', targetId: 'Z', andGroupId: 'g1' },
    e2: { id: 'e2', sourceId: 'B', targetId: 'Z', andGroupId: 'g1' },
    e3: { id: 'e3', sourceId: 'C', targetId: 'Z', orGroupId: 'g2' },
    e4: { id: 'e4', sourceId: 'D', targetId: 'Y' },
  } as unknown as TPDocument['edges'];

  it('collects the source ids of every edge in the group', () => {
    expect(collectGroupSourceIds(edges, 'andGroupId', 'g1').sort()).toEqual(['A', 'B']);
  });

  it('does not cross junctor kinds (an AND lookup ignores an OR group)', () => {
    expect(collectGroupSourceIds(edges, 'andGroupId', 'g2')).toEqual([]);
    expect(collectGroupSourceIds(edges, 'orGroupId', 'g2')).toEqual(['C']);
  });

  it('returns empty for an unknown group', () => {
    expect(collectGroupSourceIds(edges, 'andGroupId', 'nope')).toEqual([]);
  });
});

describe('junctorSourceAnchor', () => {
  it('leaves the handle point untouched when the node edge is unknown', () => {
    // null topLeft (node not measured yet / non-junctor edge) → no change.
    expect(junctorSourceAnchor('vertical', 120, 222, null)).toEqual({ x: 120, y: 222 });
    expect(junctorSourceAnchor('horizontal', 120, 222, null)).toEqual({ x: 120, y: 222 });
  });

  it('snaps a vertical-tree source onto the node TOP, keeping the handle X', () => {
    // The handle sits ~10px above the card (React Flow reports the outer edge of
    // the 20px handle); the real top is topLeft.y. X (the on-axis center) stays.
    expect(junctorSourceAnchor('vertical', 120, 222.67, { x: 50, y: 232 })).toEqual({
      x: 120,
      y: 232,
    });
  });

  it('snaps a horizontal-EC source onto the node LEFT, keeping the handle Y', () => {
    expect(junctorSourceAnchor('horizontal', 222.67, 300, { x: 410, y: 280 })).toEqual({
      x: 410,
      y: 300,
    });
  });
});

describe('junctorOutputPath', () => {
  it('rises straight up into the effect (last control point shares the endpoint X)', () => {
    // Circle at (100,200), effect bottom-center at (160,150). The 2nd control
    // point + the endpoint share x=160, so the end tangent is vertical and the
    // `orient="auto"` arrowhead points perpendicular into the card.
    expect(junctorOutputPath(100, 200, 160, 150)).toBe('M 100 200 C 130 200, 160 200, 160 150');
  });
});

describe('junctorKindField', () => {
  it('returns null for a plain edge (no junctor group)', () => {
    expect(junctorKindField(undefined, undefined, undefined)).toBeNull();
  });

  it('resolves an AND edge to its andGroupId field + id', () => {
    expect(junctorKindField('g1', undefined, undefined)).toEqual({
      field: 'andGroupId',
      groupId: 'g1',
    });
  });

  it('resolves an OR edge to its orGroupId field + id', () => {
    expect(junctorKindField(undefined, 'g2', undefined)).toEqual({
      field: 'orGroupId',
      groupId: 'g2',
    });
  });

  it('resolves a XOR edge to its xorGroupId field + id', () => {
    expect(junctorKindField(undefined, undefined, 'g3')).toEqual({
      field: 'xorGroupId',
      groupId: 'g3',
    });
  });

  it('precedence AND → OR → XOR when more than one is somehow set', () => {
    // An edge carries at most one in practice; pin the deterministic order anyway.
    expect(junctorKindField('a', 'o', 'x')).toEqual({ field: 'andGroupId', groupId: 'a' });
    expect(junctorKindField(undefined, 'o', 'x')).toEqual({ field: 'orGroupId', groupId: 'o' });
  });
});
