import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { isDiagramType } from '@/domain/guards';
import { exportToJSON, importFromJSON } from '@/domain/persistence';
import type { DiagramType, EdgeKind, EntityType } from '@/domain/types';

/**
 * Guards the `tp-studio-import` skill (`.claude/skills/tp-studio-import/`) so it
 * can never silently drift from the app. Three guarantees:
 *   1. Every bundled example imports cleanly through the REAL `importFromJSON`
 *      validator and round-trips (export → import → export) byte-stably.
 *   2. The runtime `isDiagramType` guard accepts every `DiagramType` — the gap
 *      that silently dropped user-created NBR docs on reload / import.
 *   3. Doc + coverage sync: every entity type, diagram type and edge kind in the
 *      domain model is documented in the skill, AND every diagram type has a
 *      validated example. Add a new type to a union and this fails until the
 *      skill's `SKILL.md` / `reference/format.md` / `examples/` are updated.
 *
 * Ad-hoc — validate a single generated file WITHOUT adding it to the repo:
 *   TP_VALIDATE_FILE=path/to/file.json \
 *     node ./node_modules/vitest/vitest.mjs run tests/skills/tpStudioImport.test.ts
 */
const SKILL_DIR = resolve(process.cwd(), '.claude/skills/tp-studio-import');
const EXAMPLES_DIR = resolve(SKILL_DIR, 'examples');
const SKILL_MD = readFileSync(resolve(SKILL_DIR, 'SKILL.md'), 'utf8');
const FORMAT_MD = readFileSync(resolve(SKILL_DIR, 'reference/format.md'), 'utf8');
const EXAMPLE_FILES = readdirSync(EXAMPLES_DIR).filter((f) => f.endsWith('.json'));

const readExample = (file: string): string => readFileSync(resolve(EXAMPLES_DIR, file), 'utf8');

describe('tp-studio-import skill — bundled examples', () => {
  it('ships an example for every diagram type', () => {
    expect(EXAMPLE_FILES.length).toBeGreaterThanOrEqual(9);
  });

  for (const file of EXAMPLE_FILES) {
    it(`${file} imports cleanly and round-trips`, () => {
      // `importFromJSON` throws with a precise, field-level reason on anything
      // invalid — so a failure here reads like "edges[\"e1\"] has invalid kind".
      const doc = importFromJSON(readExample(file));
      expect(Object.keys(doc.entities).length).toBeGreaterThan(0);
      const once = exportToJSON(doc);
      expect(exportToJSON(importFromJSON(once))).toEqual(once);
    });
  }
});

/**
 * Exhaustive maps — TypeScript forces a key for every union member, so adding a
 * new type to `DiagramType` / `EntityType` / `EdgeKind` fails to COMPILE here
 * until it's listed, and the runtime + doc assertions below then fail until the
 * guard, the skill docs, and (for diagram types) an example are all updated.
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

const ALL_ENTITY_TYPES: Record<EntityType, true> = {
  ude: true,
  effect: true,
  rootCause: true,
  injection: true,
  desiredEffect: true,
  assumption: true,
  goal: true,
  criticalSuccessFactor: true,
  necessaryCondition: true,
  obstacle: true,
  intermediateObjective: true,
  action: true,
  need: true,
  want: true,
  note: true,
};

const ALL_EDGE_KINDS: Record<EdgeKind, true> = { sufficiency: true, necessity: true };

describe('tp-studio-import skill — stays in sync with the domain model', () => {
  it('the runtime guard accepts every DiagramType (the NBR-drop regression)', () => {
    const rejected = Object.keys(ALL_DIAGRAM_TYPES).filter((t) => !isDiagramType(t));
    expect(rejected).toEqual([]);
  });

  it('SKILL.md cheat-sheet covers every diagram type', () => {
    const missing = Object.keys(ALL_DIAGRAM_TYPES).filter((t) => !SKILL_MD.includes(`\`${t}\``));
    expect(missing).toEqual([]);
  });

  it('reference/format.md documents every entity type', () => {
    const missing = Object.keys(ALL_ENTITY_TYPES).filter((t) => !FORMAT_MD.includes(`\`${t}\``));
    expect(missing).toEqual([]);
  });

  it('SKILL.md documents every edge kind', () => {
    const missing = Object.keys(ALL_EDGE_KINDS).filter((k) => !SKILL_MD.includes(k));
    expect(missing).toEqual([]);
  });

  it('ships a validated example for every diagram type', () => {
    const covered = new Set(EXAMPLE_FILES.map((f) => importFromJSON(readExample(f)).diagramType));
    const missing = Object.keys(ALL_DIAGRAM_TYPES).filter((t) => !covered.has(t as DiagramType));
    expect(missing).toEqual([]);
  });
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
