import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { isDiagramType } from '@/domain/guards';
import { exportToJSON, importFromJSON } from '@/domain/persistence';
import type { DiagramType } from '@/domain/types';

/**
 * Guards the `tp-studio-import` skill's bundled example documents. Every JSON
 * template the skill ships MUST import cleanly through the REAL `importFromJSON`
 * validator and round-trip (export → import → export) byte-stably. If the import
 * schema ever changes, this test fails and the skill's examples + docs get
 * fixed in the same breath — the skill can never silently drift from the app.
 *
 * Ad-hoc — validate a single generated file WITHOUT adding it to the repo:
 *   TP_VALIDATE_FILE=path/to/file.json \
 *     node ./node_modules/vitest/vitest.mjs run tests/skills/tpStudioImport.test.ts
 */
const EXAMPLES_DIR = resolve(process.cwd(), '.claude/skills/tp-studio-import/examples');

describe('tp-studio-import skill — bundled examples', () => {
  const files = readdirSync(EXAMPLES_DIR).filter((f) => f.endsWith('.json'));

  it('ships an example for every diagram type', () => {
    // crt, frt, prt, tt, ec, goalTree, st, nbr, freeform = 9.
    expect(files.length).toBeGreaterThanOrEqual(9);
  });

  for (const file of files) {
    it(`${file} imports cleanly and round-trips`, () => {
      const raw = readFileSync(resolve(EXAMPLES_DIR, file), 'utf8');
      // `importFromJSON` throws with a precise, field-level reason on anything
      // invalid — so a failure here reads like "edges[\"e1\"] has invalid kind".
      const doc = importFromJSON(raw);
      expect(Object.keys(doc.entities).length).toBeGreaterThan(0);
      // Re-export → re-import → re-export is byte-stable.
      const once = exportToJSON(doc);
      expect(exportToJSON(importFromJSON(once))).toEqual(once);
    });
  }
});

/**
 * Guard ↔ union sync. The skill promises a template for EVERY diagram type, and
 * `importFromJSON` only accepts a type the `isDiagramType` runtime guard knows.
 * This exhaustive map makes TypeScript force a key for every `DiagramType` — add
 * a 10th to the union and this fails to compile until it's listed here, and the
 * runtime assertion fails until the guard set is taught the new type. (That gap
 * is exactly how a creatable NBR diagram was silently dropped on reload.)
 */
const ALL_DIAGRAM_TYPES: Record<DiagramType, true> = {
  crt: true,
  frt: true,
  prt: true,
  tt: true,
  ec: true,
  st: true,
  freeform: true,
  goalTree: true,
  nbr: true,
};

describe('every DiagramType is importable (guard ↔ union sync)', () => {
  for (const type of Object.keys(ALL_DIAGRAM_TYPES)) {
    it(`isDiagramType accepts "${type}"`, () => {
      expect(isDiagramType(type)).toBe(true);
    });
  }
});

const adHocFile = process.env.TP_VALIDATE_FILE;
if (adHocFile) {
  describe('tp-studio-import skill — ad-hoc file', () => {
    it(`validates ${adHocFile}`, () => {
      const raw = readFileSync(resolve(process.cwd(), adHocFile), 'utf8');
      expect(() => importFromJSON(raw)).not.toThrow();
    });
  });
}
