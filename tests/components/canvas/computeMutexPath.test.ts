import { describe, expect, it } from 'vitest';
import { computeMutexPath } from '@/components/canvas/edges/resolveEdgePath';

/**
 * `computeMutexPath` — the EC mutex (D ↔ D′) straight-line override, pulled out
 * of TPEdge's render so its geometry is testable without mounting the edge.
 */
describe('computeMutexPath', () => {
  it('returns null when the two Wants basically overlap (no clean facing pair)', () => {
    expect(computeMutexPath({ x: 0, y: 0 }, { x: 8, y: 8 })).toBeNull();
  });

  it('draws a straight segment between the facing sides of stacked Wants', () => {
    const p = computeMutexPath({ x: 0, y: 0 }, { x: 0, y: 400 });
    expect(p).not.toBeNull();
    // A single dead-straight segment "M ax,ay L tx,ty".
    expect(p?.path).toMatch(/^M -?[\d.]+,-?[\d.]+ L -?[\d.]+,-?[\d.]+$/);
    // The label sits at the midpoint of the two anchors.
    expect(typeof p?.labelX).toBe('number');
    expect(typeof p?.labelY).toBe('number');
  });

  it('also connects side-by-side Wants (horizontal gap dominant)', () => {
    const p = computeMutexPath({ x: 0, y: 0 }, { x: 600, y: 0 });
    expect(p).not.toBeNull();
    expect(p?.path).toMatch(/^M /);
  });
});
