/**
 * Session 101 — pin the junctor geometry constants as a single
 * source of truth.
 *
 * Both `TPEdge.tsx` and `JunctorOverlay.tsx` need to agree on the
 * circle's center offset and radius, otherwise the bezier terminus
 * in TPEdge stops landing on the junctor circle's perimeter
 * (visually a stroke that floats off the circle).
 *
 * Before Session 101 these were declared **twice** with identical
 * values — a future tweak in one file without the other would have
 * silently drifted. This test fails if anyone re-introduces a local
 * duplicate, by scanning the two consumer files for the constant
 * name and asserting they only `import` it (never `const ... =`).
 *
 * It also pins the derived `JUNCTOR_EDGE_TERMINAL_OFFSET_Y =
 * JUNCTOR_CENTER_OFFSET_Y + JUNCTOR_RADIUS` invariant — TPEdge uses
 * this as the bezier terminus offset; if the derivation changes,
 * the visual alignment breaks.
 */
import {
  JUNCTOR_CENTER_OFFSET_Y,
  JUNCTOR_EDGE_TERMINAL_OFFSET_Y,
  JUNCTOR_RADIUS,
} from '@/domain/constants';
import { describe, expect, it } from 'vitest';

// Vite's `import.meta.glob` reads the two consumer files at test
// time without a Node fs dependency (CI's tsc rejects `node:fs`).
const CONSUMER_FILES = import.meta.glob<string>(
  ['/src/components/canvas/TPEdge.tsx', '/src/components/canvas/JunctorOverlay.tsx'],
  { query: '?raw', import: 'default', eager: true }
);

describe('junctor geometry constants', () => {
  it('JUNCTOR_EDGE_TERMINAL_OFFSET_Y equals offset + radius', () => {
    expect(JUNCTOR_EDGE_TERMINAL_OFFSET_Y).toBe(JUNCTOR_CENTER_OFFSET_Y + JUNCTOR_RADIUS);
  });

  it('TPEdge.tsx and JunctorOverlay.tsx do not redeclare the constants locally', () => {
    // A local re-declaration looks like `const JUNCTOR_CENTER_OFFSET_Y = 35;`
    // or `const JUNCTOR_RADIUS = 14;` — both rejected. `import { ... }
    // from '@/domain/constants'` is fine; `typeof import(...)` is fine.
    const localDeclPattern =
      /(^|\n)\s*(const|let|var)\s+(JUNCTOR_CENTER_OFFSET_Y|JUNCTOR_RADIUS|JUNCTOR_EDGE_TERMINAL_OFFSET_Y)\s*=/;
    const offenders: string[] = [];
    for (const [path, content] of Object.entries(CONSUMER_FILES)) {
      if (localDeclPattern.test(content)) offenders.push(path);
    }
    expect(offenders).toEqual([]);
  });

  it('both files reference the constants by import (not magic number 35 / 14)', () => {
    for (const [path, content] of Object.entries(CONSUMER_FILES)) {
      // The file should reference at least one of the names — if
      // someone deletes the import, they probably hard-coded the
      // value, which we want to catch.
      expect(content).toMatch(/JUNCTOR_(CENTER_OFFSET_Y|RADIUS|EDGE_TERMINAL_OFFSET_Y)/);
      // Use path in the failure message so a future failure points
      // to the right file. (The `match` doesn't include path; this
      // ensures the assertion's `actual` shows up usefully.)
      if (!/JUNCTOR_(CENTER_OFFSET_Y|RADIUS|EDGE_TERMINAL_OFFSET_Y)/.test(content)) {
        throw new Error(`${path} no longer references the named junctor constants`);
      }
    }
  });
});
