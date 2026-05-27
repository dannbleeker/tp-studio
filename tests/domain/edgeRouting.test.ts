/**
 * Phase A — unit tests for the `edgeRouting` module's API contract.
 *
 * The module ships in the "scaffolding" state (no real obstacle
 * avoidance yet; the router returns a default cubic bezier between
 * source and target). These tests pin the shape of the API so Phase B
 * (single-obstacle heuristic) and Phase C (visibility graph + A\*)
 * can extend the function without changing the contract callers depend
 * on. See `docs/EDGE_ROUTING_PROPOSAL.md`.
 */

import { describe, expect, it } from 'vitest';
import { type Box, defaultBezierPath, type EdgeRoute, routeEdge } from '@/domain/edgeRouting';

const ORIGIN = { x: 0, y: 0 };
const FAR = { x: 200, y: 300 };

describe('routeEdge — Phase A contract', () => {
  it('returns an EdgeRoute with `d` (path string) and `waypoints` (endpoints)', () => {
    const route: EdgeRoute = routeEdge({ source: ORIGIN, target: FAR, obstacles: [] });
    expect(typeof route.d).toBe('string');
    expect(route.d.length).toBeGreaterThan(0);
    expect(route.waypoints).toEqual([ORIGIN, FAR]);
  });

  it('path starts at source coordinates', () => {
    const route = routeEdge({
      source: { x: 100, y: 50 },
      target: { x: 400, y: 250 },
      obstacles: [],
    });
    // M100,50 ...
    expect(route.d.startsWith('M100,50')).toBe(true);
  });

  it('path ends at target coordinates', () => {
    const route = routeEdge({ source: ORIGIN, target: { x: 250, y: 175 }, obstacles: [] });
    // The cubic ends with the target x,y as the final pair on the C command.
    expect(route.d.endsWith('250,175')).toBe(true);
  });

  it('returns the default bezier verbatim (no obstacle avoidance in Phase A)', () => {
    // Phase A obstacle list is ignored — the router walks through any
    // boxes provided. Phase B will start consuming them; this test pins
    // the no-op behavior so an accidental Phase B leak into main lights
    // up immediately.
    const obstacleInPath: Box = { x: 50, y: 100, width: 100, height: 100 };
    const a = routeEdge({ source: ORIGIN, target: FAR, obstacles: [obstacleInPath] });
    const b = routeEdge({ source: ORIGIN, target: FAR, obstacles: [] });
    expect(a.d).toBe(b.d);
    expect(a.waypoints).toEqual(b.waypoints);
  });

  it('ignores `rankSpacing` in Phase A', () => {
    // The field is in the input type for Phase C+ but Phase A should
    // produce identical output regardless of its value.
    const a = routeEdge({ source: ORIGIN, target: FAR, obstacles: [], rankSpacing: 100 });
    const b = routeEdge({ source: ORIGIN, target: FAR, obstacles: [] });
    expect(a.d).toBe(b.d);
  });

  it('handles degenerate zero-length input without throwing', () => {
    // Defensive guard — real React Flow edges never produce
    // source==target, but the function should stay total.
    const route = routeEdge({ source: ORIGIN, target: ORIGIN, obstacles: [] });
    expect(route.d).toContain('M0,0');
    expect(route.waypoints).toEqual([ORIGIN, ORIGIN]);
  });

  it('is pure — repeated calls with the same input return equal output', () => {
    const a = routeEdge({ source: { x: 10, y: 20 }, target: { x: 100, y: 200 }, obstacles: [] });
    const b = routeEdge({ source: { x: 10, y: 20 }, target: { x: 100, y: 200 }, obstacles: [] });
    expect(a.d).toBe(b.d);
    expect(a.waypoints).toEqual(b.waypoints);
  });
});

describe('defaultBezierPath', () => {
  it('emits a cubic-bezier SVG path (M ... C ...)', () => {
    const d = defaultBezierPath({ x: 0, y: 0 }, { x: 100, y: 100 });
    expect(d).toMatch(/^M0,0 C/);
  });

  it('uses the vertical midpoint as control y for both control points', () => {
    // Verifies the visual feel matches React Flow's top/bottom bezier:
    // control points lie along the vertical axis at the midpoint
    // y-value, so the curve eases smoothly from one node's bottom
    // handle into the other's top handle.
    const d = defaultBezierPath({ x: 0, y: 0 }, { x: 200, y: 100 });
    // midY = 50; expect `0,50 200,50` in the control-point section.
    expect(d).toContain('C0,50 200,50 200,100');
  });

  it('round-trips horizontally for source-left-of-target', () => {
    const d = defaultBezierPath({ x: 10, y: 20 }, { x: 110, y: 220 });
    // midY = 120; control points at (10, 120) and (110, 120).
    expect(d).toBe('M10,20 C10,120 110,120 110,220');
  });
});
