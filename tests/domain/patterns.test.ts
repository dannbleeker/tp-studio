import { describe, expect, it } from 'vitest';
import { CURRENT_SCHEMA_VERSION } from '@/domain/migrations';
import { PATTERNS, patternById, patternsForDiagram } from '@/domain/patterns';
import type { DiagramType } from '@/domain/types';

/**
 * Session 134 — pattern library registry guard.
 *
 * Pins the registry shape (every pattern builds; ids are unique; each
 * pattern's `build()` produces a doc whose `diagramType` matches the
 * registry entry) so future additions can't silently drift. Doesn't
 * test individual pattern contents — that's the `exampleEC` test's
 * job for the EC pattern, and growing per-pattern guards as patterns
 * accumulate would be brittle.
 */

describe('pattern registry', () => {
  it('has at least one pattern per built-in TOC diagram type (except freeform)', () => {
    // Freeform is intentionally skipped — a "freeform pattern" is an
    // oxymoron; users start a freeform doc from scratch. Other types
    // each have at least one curated pattern.
    const required: DiagramType[] = ['crt', 'frt', 'prt', 'tt', 'ec', 'goalTree', 'st'];
    for (const t of required) {
      const matched = patternsForDiagram(t);
      expect(matched.length, `expected at least one pattern for ${t}`).toBeGreaterThanOrEqual(1);
    }
  });

  it('has ≥5 patterns per non-freeform diagram type (Session 137 library expansion)', () => {
    // Session 137 — the curated pattern library reached the "5 per
    // type" milestone called out in `NEXT_STEPS.md`. Pinning the
    // floor here so a future removal that drops a type below 5 fires
    // red and the contributor has to either add a replacement or
    // make the call to lower the target deliberately. NBR included
    // even though the registry tests originally listed only the
    // seven primary types — the library now covers it too.
    const required: DiagramType[] = ['crt', 'frt', 'prt', 'tt', 'ec', 'goalTree', 'st', 'nbr'];
    for (const t of required) {
      const matched = patternsForDiagram(t);
      expect(
        matched.length,
        `expected ≥5 patterns for ${t}, got ${matched.length}`
      ).toBeGreaterThanOrEqual(5);
    }
  });

  it('uses unique stable ids', () => {
    const ids = PATTERNS.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('every pattern builds without throwing and emits the declared diagram type', () => {
    for (const pattern of PATTERNS) {
      let doc: ReturnType<typeof pattern.build> | null = null;
      expect(() => {
        doc = pattern.build();
      }, `pattern ${pattern.id} threw during build`).not.toThrow();
      // The non-null assertion is safe because the previous expect
      // would have failed if build threw.
      expect(
        doc!.diagramType,
        `pattern ${pattern.id} declared ${pattern.diagramType} but produced ${doc!.diagramType}`
      ).toBe(pattern.diagramType);
    }
  });

  it('every built doc has at least one entity and a non-empty title', () => {
    for (const pattern of PATTERNS) {
      const doc = pattern.build();
      expect(
        Object.keys(doc.entities).length,
        `pattern ${pattern.id} has no entities`
      ).toBeGreaterThan(0);
      expect(doc.title.trim().length, `pattern ${pattern.id} has an empty title`).toBeGreaterThan(
        0
      );
    }
  });

  it('every built doc carries the current schemaVersion', () => {
    for (const pattern of PATTERNS) {
      const doc = pattern.build();
      expect(doc.schemaVersion, `pattern ${pattern.id} ships an outdated schemaVersion`).toBe(
        CURRENT_SCHEMA_VERSION
      );
    }
  });
});

describe('patternsForDiagram', () => {
  it('returns only patterns matching the given diagram type', () => {
    const crts = patternsForDiagram('crt');
    expect(crts.length).toBeGreaterThan(0);
    for (const p of crts) {
      expect(p.diagramType).toBe('crt');
    }
  });

  it('preserves registry order across the filtered subset', () => {
    const all = PATTERNS.map((p) => p.id);
    const crts = patternsForDiagram('crt');
    const crtIdsInRegistryOrder = all.filter((id) => crts.some((p) => p.id === id));
    expect(crts.map((p) => p.id)).toEqual(crtIdsInRegistryOrder);
  });
});

describe('patternById', () => {
  it('returns the pattern for a known id', () => {
    const p = patternById('crt-customer-satisfaction');
    expect(p).toBeDefined();
    expect(p?.diagramType).toBe('crt');
  });

  it('returns undefined for an unknown id', () => {
    expect(patternById('does-not-exist')).toBeUndefined();
  });
});

describe("goalTree-it-function (Dann's 2020 IT-function article)", () => {
  it('builds the 1 Goal · 2 CSFs · 6 NCs (8 necessity edges) + a boundary note', () => {
    const p = patternById('goalTree-it-function');
    expect(p).toBeDefined();
    const doc = p!.build();
    const entities = Object.values(doc.entities);
    const edges = Object.values(doc.edges);

    expect(entities).toHaveLength(10);
    expect(edges).toHaveLength(9);
    expect(entities.filter((e) => e.type === 'goal')).toHaveLength(1);
    expect(entities.filter((e) => e.type === 'criticalSuccessFactor')).toHaveLength(2);
    expect(entities.filter((e) => e.type === 'necessaryCondition')).toHaveLength(6);
    // The financial-restriction boundary rides as a non-causal note.
    expect(entities.filter((e) => e.type === 'note')).toHaveLength(1);
    // The 8 goal/CSF/NC links are necessity; the boundary note-edge is the 9th.
    expect(edges.filter((e) => e.kind === 'necessity')).toHaveLength(8);
    expect(doc.diagramType).toBe('goalTree');
  });
});

describe("goalTree-new-technology-outcome (Dann's technology-value map)", () => {
  it('builds the 1 Goal · 2 CSFs · 9 NCs shape with two nested-NC layers (11 necessity edges)', () => {
    const p = patternById('goalTree-new-technology-outcome');
    expect(p).toBeDefined();
    const doc = p!.build();
    const entities = Object.values(doc.entities);
    const edges = Object.values(doc.edges);

    expect(doc.diagramType).toBe('goalTree');
    expect(entities).toHaveLength(12);
    expect(entities.filter((e) => e.type === 'goal')).toHaveLength(1);
    expect(entities.filter((e) => e.type === 'criticalSuccessFactor')).toHaveLength(2);
    expect(entities.filter((e) => e.type === 'necessaryCondition')).toHaveLength(9);
    expect(edges).toHaveLength(11);
    expect(edges.every((e) => e.kind === 'necessity')).toBe(true);
    // The arms decompose through nested NCs — 5 of the 11 edges run NC → NC
    // (see/break/re-rule under "able to use", functions/adapt under "works").
    const ncToNc = edges.filter(
      (e) =>
        doc.entities[e.sourceId]?.type === 'necessaryCondition' &&
        doc.entities[e.targetId]?.type === 'necessaryCondition'
    );
    expect(ncToNc).toHaveLength(5);
    // The Goldratt dictum rides as a description on the limitation CSF.
    const csfLimitation = entities.find(
      (e) => e.type === 'criticalSuccessFactor' && e.title.includes('diminishes a limitation')
    );
    expect(csfLimitation?.description).toContain('Necessary But Not Sufficient');
  });
});

describe('Goldratt canon + published-case set (Session 193)', () => {
  it('registers all 21 patterns of the set', () => {
    const ids = [
      // It's Not Luck (+ Isn't It Obvious? for pull replenishment)
      'ec-divest-or-grow',
      'crt-commodity-price-trap',
      'frt-market-offer',
      'nbr-market-offer',
      'ec-teenager-trip',
      'prt-market-offer-rollout',
      'frt-pull-replenishment',
      // The Goal (retrospective reconstructions)
      'crt-failing-plant',
      'frt-plant-turnaround',
      'nbr-robot-efficiencies',
      'goalTree-money-now-and-future',
      // Critical Chain
      'crt-why-projects-slip',
      'frt-critical-chain',
      // The Choice
      'crt-forecast-committed-fashion',
      'ec-forecast-vs-react',
      // Mabin & Cavana 2024 public-policy suite
      'crt-alcohol-availability',
      'ec-alcohol-policy',
      'goalTree-alcohol-policy',
      'nbr-alcohol-ban',
      'frt-alcohol-policy-mix',
      'prt-alcohol-ban-rollout',
    ];
    for (const id of ids) {
      expect(patternById(id), `missing pattern ${id}`).toBeDefined();
    }
  });

  it('prt-alcohol-ban-rollout builds the condensed 5-obstacle PRT (11 entities, 10 necessity edges)', () => {
    const doc = patternById('prt-alcohol-ban-rollout')!.build();
    const entities = Object.values(doc.entities);
    const edges = Object.values(doc.edges);
    expect(entities).toHaveLength(11);
    expect(entities.filter((e) => e.type === 'goal')).toHaveLength(1);
    expect(entities.filter((e) => e.type === 'obstacle')).toHaveLength(5);
    expect(entities.filter((e) => e.type === 'intermediateObjective')).toHaveLength(5);
    expect(edges).toHaveLength(10);
    expect(edges.every((e) => e.kind === 'necessity')).toBe(true);
  });

  it('nbr-alcohol-ban carries the published branch shape (2 injections, 3 UDEs, mitigation into the DE)', () => {
    const doc = patternById('nbr-alcohol-ban')!.build();
    const entities = Object.values(doc.entities);
    expect(entities.filter((e) => e.type === 'injection')).toHaveLength(2);
    expect(entities.filter((e) => e.type === 'ude')).toHaveLength(3);
    expect(entities.filter((e) => e.type === 'desiredEffect')).toHaveLength(1);
  });

  it('crt-failing-plant chains two AND groups (WIP confluence + closure)', () => {
    const doc = patternById('crt-failing-plant')!.build();
    const groups = new Set(
      Object.values(doc.edges)
        .map((e) => e.andGroupId)
        .filter(Boolean)
    );
    expect(groups.size).toBe(2);
  });
});

describe("ec-efrats-change-cloud (Efrat's change cloud + breaking channels)", () => {
  it('builds the 5-box cloud + 2 non-causal channel notes, with a D↔D′ mutex', () => {
    const p = patternById('ec-efrats-change-cloud');
    expect(p).toBeDefined();
    const doc = p!.build();
    const entities = Object.values(doc.entities);
    const edges = Object.values(doc.edges);

    expect(doc.diagramType).toBe('ec');
    // The 5 cloud boxes plus the two breaking-channel annotation notes.
    expect(entities).toHaveLength(7);
    expect(entities.filter((e) => e.type === 'goal')).toHaveLength(1);
    expect(entities.filter((e) => e.type === 'need')).toHaveLength(2);
    expect(entities.filter((e) => e.type === 'want')).toHaveLength(2);
    // The two channels ride as non-causal notes (protect security / offer satisfaction).
    expect(entities.filter((e) => e.type === 'note')).toHaveLength(2);
    // The 5 cloud boxes are slotted (a / b / c / d / dPrime) for the hand-positioned
    // layout; the notes are free-positioned annotations, so they carry no slot.
    expect(entities.filter((e) => e.type !== 'note').every((e) => e.ecSlot)).toBe(true);
    expect(entities.filter((e) => e.type === 'note').every((e) => !e.ecSlot)).toBe(true);
    // Four structural necessity links (D→B, D′→C, B→A, C→A); the conflict edge
    // carries the canonical `{ kind: 'necessity', isMutualExclusion }` form, so
    // exclude it from the structural count. Exactly one mutex (D↔D′).
    expect(edges.filter((e) => e.kind === 'necessity' && !e.isMutualExclusion)).toHaveLength(4);
    expect(edges.filter((e) => e.isMutualExclusion)).toHaveLength(1);
    // Two non-causal note-edges (default sufficiency kind), one per channel.
    expect(edges.filter((e) => e.kind !== 'necessity')).toHaveLength(2);
  });

  it('ships the 14 published assumptions (Dettmer Fig 8.3, paraphrased) behind the four arrows', () => {
    const doc = patternById('ec-efrats-change-cloud')!.build();
    const assumptions = Object.values(doc.assumptions ?? {});
    expect(assumptions).toHaveLength(14);

    // Every record attaches to a real structural (non-mutex, non-note) edge.
    const perEdge = new Map<string, number>();
    for (const a of assumptions) {
      const edge = doc.edges[a.edgeId];
      expect(edge, `assumption "${a.text}" attaches to a missing edge`).toBeDefined();
      expect(edge!.kind).toBe('necessity');
      expect(edge!.isMutualExclusion).toBeUndefined();
      perEdge.set(a.edgeId, (perEdge.get(a.edgeId) ?? 0) + 1);
    }
    // The figure's split: 3 on B→A, 4 on D→B, 4 on C→A, 3 on D′→C.
    expect([...perEdge.values()].sort((x, y) => x - y)).toEqual([3, 3, 4, 4]);

    // The D′→C three are what breaking channel 1 attacks — 'challengeable';
    // the rest arrive unexamined.
    const challengeable = assumptions.filter((a) => a.status === 'challengeable');
    expect(challengeable).toHaveLength(3);
    const wantIds = new Set(
      Object.values(doc.entities)
        .filter((e) => e.type === 'want')
        .map((e) => e.id)
    );
    for (const a of challengeable) {
      // Each challengeable assumption sits on a want→need arrow (D′→C).
      expect(wantIds.has(doc.edges[a.edgeId]!.sourceId)).toBe(true);
    }
    expect(assumptions.filter((a) => a.status === 'unexamined')).toHaveLength(11);

    // Badges number contiguously after the 5 boxes + 2 notes (#8–#21), and the
    // channel notes cross-reference that numbering.
    const numbers = assumptions.map((a) => a.annotationNumber).sort((x, y) => x! - y!);
    expect(numbers).toEqual(Array.from({ length: 14 }, (_, i) => 8 + i));
    expect(doc.nextAnnotationNumber).toBe(22);
    const noteTexts = Object.values(doc.entities)
      .filter((e) => e.type === 'note')
      .map((e) => e.title)
      .join(' ');
    expect(noteTexts).toContain('#19–#21');
    expect(noteTexts).toContain('#11–#14');
  });
});
