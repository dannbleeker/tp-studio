import { beforeEach, describe, expect, it } from 'vitest';
import { ecCompletenessRule } from '@/domain/validators/ecCompleteness';
import { makeDoc, makeEdge, makeEntity, resetIds } from './helpers';

/**
 * Session 134 coverage push — `ec-completeness` validator was at 54%
 * (the lowest-coverage of the 18 validators). This file targets the
 * five sub-rules in `ecCompleteness.ts` directly:
 *
 *   1. A (Objective) non-empty
 *   2. B and C distinct + each connected only to A
 *   3. D supports only B; D′ supports only C
 *   4. ≥1 assumption on each of the 5 canonical arrows
 *   5. ≥1 injection exists
 *
 * Each rule gets a positive + negative case so the test surface mirrors
 * the validator's branching shape.
 */

beforeEach(resetIds);

const makeECDoc = (
  entities: ReturnType<typeof makeEntity>[],
  edges: ReturnType<typeof makeEdge>[]
) => makeDoc(entities, edges, 'ec');

const fullECDoc = (overrides?: {
  aTitle?: string;
  bIsSameAsC?: boolean;
  extraEdge?: { from: string; to: string };
  swapWantTargets?: boolean;
  withAssumptionOn?: string[];
  withInjection?: boolean;
}) => {
  const a = makeEntity({
    title: overrides?.aTitle ?? 'Be present + deliver',
    ecSlot: 'a',
    type: 'goal',
  });
  const b = makeEntity({ title: 'Family time', ecSlot: 'b', type: 'need' });
  const c = overrides?.bIsSameAsC
    ? b
    : makeEntity({ title: 'Quarterly target', ecSlot: 'c', type: 'need' });
  const d = makeEntity({ title: 'Leave at 5', ecSlot: 'd', type: 'want' });
  const dPrime = makeEntity({ title: 'Stay late', ecSlot: 'dPrime', type: 'want' });

  // Build the 5 canonical edges. The `assumptionIds` arrays mark
  // which arrows have ≥1 assumption (rule 4).
  const eBA = makeEdge(b.id, a.id, {
    kind: 'necessity',
    assumptionIds: overrides?.withAssumptionOn?.includes('B → A') ? (['x'] as never) : [],
  });
  const eCA = makeEdge(c.id, a.id, {
    kind: 'necessity',
    assumptionIds: overrides?.withAssumptionOn?.includes('C → A') ? (['x'] as never) : [],
  });
  // Rule 3 — swap the want targets to surface the "supports unexpected
  // target" warning.
  const dTarget = overrides?.swapWantTargets ? c.id : b.id;
  const dPrimeTarget = overrides?.swapWantTargets ? b.id : c.id;
  const eDB = makeEdge(d.id, dTarget, {
    kind: 'necessity',
    assumptionIds: overrides?.withAssumptionOn?.includes('D → B') ? (['x'] as never) : [],
  });
  const eDpC = makeEdge(dPrime.id, dPrimeTarget, {
    kind: 'necessity',
    assumptionIds: overrides?.withAssumptionOn?.includes('D′ → C') ? (['x'] as never) : [],
  });
  const eDDp = makeEdge(d.id, dPrime.id, {
    isMutualExclusion: true,
    assumptionIds: overrides?.withAssumptionOn?.includes('D ↔ D′') ? (['x'] as never) : [],
  });

  const entities = overrides?.bIsSameAsC ? [a, b, d, dPrime] : [a, b, c, d, dPrime];
  if (overrides?.withInjection) {
    entities.push(makeEntity({ title: 'Fix the schedule', type: 'injection' }));
  }
  const edges = [eBA, eCA, eDB, eDpC, eDDp];
  if (overrides?.extraEdge) {
    edges.push(makeEdge(overrides.extraEdge.from as never, overrides.extraEdge.to as never));
  }
  return { doc: makeECDoc(entities, edges), a, b, c, d, dPrime };
};

describe('ecCompletenessRule — Rule 1 (A non-empty)', () => {
  it('warns when Objective A is empty', () => {
    const { doc, a } = fullECDoc({ aTitle: '   ' });
    const warnings = ecCompletenessRule(doc);
    const aWarning = warnings.find(
      (w) =>
        w.target.kind === 'entity' &&
        w.target.id === a.id &&
        /Objective \(A\) is empty/.test(w.message)
    );
    expect(aWarning).toBeDefined();
  });

  it('does not warn when A has content', () => {
    const { doc, a } = fullECDoc();
    const warnings = ecCompletenessRule(doc);
    expect(
      warnings.some(
        (w) => w.target.kind === 'entity' && w.target.id === a.id && /A\) is empty/.test(w.message)
      )
    ).toBe(false);
  });
});

describe('ecCompletenessRule — Rule 2 (B and C distinct)', () => {
  // The "B and C reference the same entity" branch is defensive code:
  // a single entity can only have one `ecSlot` value, and the entities
  // map is keyed by id, so under the normal schema two distinct slots
  // can't share an entity. We assert the negative case (no warning on
  // a healthy doc); the branch lives on to guard against future schema
  // drift.
  it('does not warn when B and C are distinct', () => {
    const { doc } = fullECDoc();
    const warnings = ecCompletenessRule(doc);
    expect(warnings.some((w) => /same entity/.test(w.message))).toBe(false);
  });
});

describe('ecCompletenessRule — Rule 3 (Want supports only its own Need)', () => {
  it('warns when D supports the wrong Need (C instead of B)', () => {
    const { doc } = fullECDoc({ swapWantTargets: true });
    const warnings = ecCompletenessRule(doc);
    expect(warnings.some((w) => /unexpected target/.test(w.message))).toBe(true);
  });

  it('does not warn when wants are correctly aligned', () => {
    const { doc } = fullECDoc();
    const warnings = ecCompletenessRule(doc);
    expect(warnings.some((w) => /unexpected target/.test(w.message))).toBe(false);
  });
});

describe('ecCompletenessRule — Rule 4 (≥1 assumption per arrow)', () => {
  it('warns on every arrow when none has an assumption', () => {
    const { doc } = fullECDoc();
    const warnings = ecCompletenessRule(doc);
    const noAssumption = warnings.filter((w) => /No assumption recorded/.test(w.message));
    expect(noAssumption.length).toBe(5);
  });

  it('does not warn on arrows that have assumptions', () => {
    const { doc } = fullECDoc({
      withAssumptionOn: ['B → A', 'C → A', 'D → B', 'D′ → C', 'D ↔ D′'],
    });
    const warnings = ecCompletenessRule(doc);
    expect(warnings.some((w) => /No assumption recorded/.test(w.message))).toBe(false);
  });
});

describe('ecCompletenessRule — Rule 5 (≥1 injection)', () => {
  it('warns when no injection entity exists', () => {
    const { doc } = fullECDoc();
    const warnings = ecCompletenessRule(doc);
    expect(warnings.some((w) => /No injection yet/.test(w.message))).toBe(true);
  });

  it('does not warn when an injection entity is present', () => {
    const { doc } = fullECDoc({ withInjection: true });
    const warnings = ecCompletenessRule(doc);
    expect(warnings.some((w) => /No injection yet/.test(w.message))).toBe(false);
  });
});

describe('ecCompletenessRule — non-EC diagrams', () => {
  it('returns no warnings for non-EC diagram types', () => {
    const e = makeEntity({ title: 'x', ecSlot: 'a' });
    const doc = makeDoc([e], [], 'crt');
    expect(ecCompletenessRule(doc)).toEqual([]);
  });
});
