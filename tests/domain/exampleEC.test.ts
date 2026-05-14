import type { ECSlot } from '@/domain/ecGuiding';
import { buildExampleEC } from '@/domain/examples/ec';
import { verbaliseEC } from '@/domain/verbalisation';
import { describe, expect, it } from 'vitest';

/**
 * Session 87 hotfix regression guard. Before this fix the EC example
 * loader produced a doc with no `ecSlot` bindings, sufficiency-typed
 * edges, and no D↔D′ mutex arrow. The Session 87 EC PPT comparison
 * features (verbalisation slot interpolation, per-slot guiding
 * questions, `ec-missing-conflict` / `ec-completeness` CLR rules) all
 * depend on those v6 → v7 fields being present.
 *
 * The tests below pin the structural shape so a future contributor
 * who touches the example loader knows immediately when they've
 * regressed it.
 */

describe('buildExampleEC — Session 87 schema regression guard', () => {
  it('binds all 5 EC slot tags on the canonical entities', () => {
    const doc = buildExampleEC();
    const slots = new Set<ECSlot>();
    for (const ent of Object.values(doc.entities)) {
      if (ent.ecSlot) slots.add(ent.ecSlot);
    }
    expect(slots).toEqual(new Set(['a', 'b', 'c', 'd', 'dPrime']));
  });

  it('emits 5 edges including the D↔D′ mutex arrow', () => {
    const doc = buildExampleEC();
    const edges = Object.values(doc.edges);
    expect(edges).toHaveLength(5);
    const mutexEdges = edges.filter((e) => e.isMutualExclusion === true);
    expect(mutexEdges).toHaveLength(1);
    // Mutex arrow must sit between the D-slot and D′-slot entities.
    const slotById: Record<string, ECSlot | undefined> = Object.fromEntries(
      Object.values(doc.entities).map((e) => [e.id, e.ecSlot])
    );
    const mutex = mutexEdges[0]!;
    const endpoints = new Set([slotById[mutex.sourceId], slotById[mutex.targetId]]);
    expect(endpoints).toEqual(new Set(['d', 'dPrime']));
  });

  it('marks every edge as necessity-typed (the v7 EC convention)', () => {
    const doc = buildExampleEC();
    for (const edge of Object.values(doc.edges)) {
      expect(edge.kind).toBe('necessity');
    }
  });

  it('verbaliseEC interpolates real entity titles, not placeholders', () => {
    const doc = buildExampleEC();
    const tokens = verbaliseEC(doc);
    const slotTexts = tokens.filter((t) => t.kind === 'slot').map((t) => t.text);
    // Each canonical slot string from the example doc must appear at
    // least once — that's the signal that the verbalisation pipeline
    // resolved each slot to its real entity rather than the neutral
    // placeholder fallback ("the common objective", "the first need",
    // etc.).
    expect(slotTexts).toContain('Be present for my family AND deliver at work');
    expect(slotTexts).toContain('Spend evening time with my family');
    expect(slotTexts).toContain('Hit my quarterly performance targets');
    expect(slotTexts).toContain('Leave the office at 5pm every day');
    expect(slotTexts).toContain('Stay late to finish the feature on time');
    // And no placeholder leaked through.
    for (const placeholder of [
      'the common objective',
      'the first need',
      'the second need',
      'the first want',
      'the conflicting want',
    ]) {
      expect(slotTexts).not.toContain(placeholder);
    }
  });
});
