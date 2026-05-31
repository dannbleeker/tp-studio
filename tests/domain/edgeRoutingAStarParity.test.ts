/**
 * GOLDEN ROUTE PARITY — A* open-list data-structure swap (Session 145).
 *
 * The A* open-list was changed from an O(V^2) `Set` linear-scan to a binary
 * min-heap. The scan broke f-score ties by `Set` insertion order (the first
 * minimum it met won, via strict `<`); the heap reproduces that EXACTLY by
 * keying on `(fScore, insertion-seq)`, so it pops vertices in an identical
 * order and therefore returns identical paths.
 *
 * These goldens are the proof. Each routes through a SYMMETRIC, tie-prone
 * obstacle field where two (or more) equal-length detours exist — precisely
 * the case an unstable tie-break would resolve differently (picking the
 * "down" detour where the scan picked "up", say). They were captured from the
 * linear-scan implementation; the heap must reproduce them point-for-point.
 *
 * A diff in any snapshot below means the refactor changed routing — STOP and
 * fix the tie-break, do not `--update`.
 */

import { describe, expect, it } from 'vitest';
import type { Box, Point } from '@/domain/edgeRouting';
import { findVisibilityPath } from '@/domain/edgeRouting';

/** Compact, exact serialization — corner coords are integers for integer
 *  inputs (corners are obstacle edges ± the integer OBSTACLE_PADDING), so a
 *  changed detour shows up as a clean coordinate diff. */
const fmt = (path: Point[] | null): string =>
  path === null ? 'null' : path.map((p) => `(${p.x}, ${p.y})`).join(' -> ');

const route = (source: Point, target: Point, obstacles: Box[]): string =>
  fmt(findVisibilityPath(source, target, obstacles));

describe('A* open-list parity — golden routes through tie-prone fields', () => {
  it('single centred box, horizontal traverse (up/down detour tie)', () => {
    // Direct line y=100 runs through the box; the up-and-over and
    // down-and-under detours are mirror-images of equal length → a pure tie.
    expect(
      route({ x: 0, y: 100 }, { x: 400, y: 100 }, [{ x: 180, y: 60, width: 40, height: 80 }])
    ).toMatchInlineSnapshot(`"(0, 100) -> (172, 52) -> (228, 52) -> (400, 100)"`);
  });

  it('single centred box, vertical traverse (left/right detour tie)', () => {
    expect(
      route({ x: 100, y: 0 }, { x: 100, y: 400 }, [{ x: 60, y: 180, width: 80, height: 40 }])
    ).toMatchInlineSnapshot(`"(100, 0) -> (52, 172) -> (52, 228) -> (100, 400)"`);
  });

  it('asymmetric box — unique shortest detour (no tie, locks general routing)', () => {
    // Box hangs far below the line, so the over-the-top detour is strictly
    // shorter — a deterministic single best path regardless of tie-break.
    expect(
      route({ x: 0, y: 100 }, { x: 400, y: 100 }, [{ x: 180, y: 70, width: 40, height: 200 }])
    ).toMatchInlineSnapshot(`"(0, 100) -> (172, 62) -> (228, 62) -> (400, 100)"`);
  });

  it('two symmetric boxes, horizontal traverse (up/down over both)', () => {
    expect(
      route({ x: 0, y: 100 }, { x: 400, y: 100 }, [
        { x: 120, y: 40, width: 40, height: 120 },
        { x: 240, y: 40, width: 40, height: 120 },
      ])
    ).toMatchInlineSnapshot(`"(0, 100) -> (112, 32) -> (288, 32) -> (400, 100)"`);
  });

  it('three boxes in a row (multi-corner detour, up/down tie)', () => {
    expect(
      route({ x: 0, y: 100 }, { x: 500, y: 100 }, [
        { x: 100, y: 60, width: 40, height: 80 },
        { x: 250, y: 60, width: 40, height: 80 },
        { x: 400, y: 60, width: 40, height: 80 },
      ])
    ).toMatchInlineSnapshot(`"(0, 100) -> (92, 52) -> (448, 52) -> (500, 100)"`);
  });

  it('centred box on the diagonal (symmetric corner tie)', () => {
    expect(
      route({ x: 0, y: 0 }, { x: 400, y: 400 }, [{ x: 160, y: 160, width: 80, height: 80 }])
    ).toMatchInlineSnapshot(`"(0, 0) -> (248, 152) -> (400, 400)"`);
  });

  it('2x2 symmetric grid on the diagonal', () => {
    expect(
      route({ x: 0, y: 0 }, { x: 400, y: 400 }, [
        { x: 120, y: 120, width: 40, height: 40 },
        { x: 120, y: 240, width: 40, height: 40 },
        { x: 240, y: 120, width: 40, height: 40 },
        { x: 240, y: 240, width: 40, height: 40 },
      ])
    ).toMatchInlineSnapshot(`"(0, 0) -> (168, 112) -> (288, 232) -> (400, 400)"`);
  });

  it('centred box on the anti-diagonal (mirror of the diagonal case)', () => {
    // Same box as the diagonal case but source/target swapped to the other
    // diagonal — exercises the mirror-image corner tie.
    expect(
      route({ x: 0, y: 400 }, { x: 400, y: 0 }, [{ x: 160, y: 160, width: 80, height: 80 }])
    ).toMatchInlineSnapshot(`"(0, 400) -> (152, 152) -> (400, 0)"`);
  });
});
