import { describe, expect, it } from 'vitest';
import { findCoreDrivers } from '@/domain/coreDriver';
import { entitiesOfType, findCycles } from '@/domain/graph';
import { buildPatternCRTCostAccounting } from '@/domain/patterns/crt-cost-accounting';
import { validate } from '@/domain/validators';

/**
 * Session 179 — the cost-accounting / product-costing CRT pattern (TOC's critique
 * of cost / ABC product costing). Pins the teaching structure: a single
 * core-problem root cause (the costing paradigm) that sprays the whole UDE field
 * through a clean acyclic fan-out — a diagnosis tree, not a feedback loop.
 */
describe('buildPatternCRTCostAccounting', () => {
  const doc = buildPatternCRTCostAccounting();

  it('is a CRT with exactly one core-problem root cause', () => {
    expect(doc.diagramType).toBe('crt');
    const coreProblems = Object.values(doc.entities).filter((e) => e.coreProblem === true);
    expect(coreProblems).toHaveLength(1);
    expect(coreProblems[0]?.type).toBe('rootCause');
  });

  it('the costing-paradigm root cause is the core driver and reaches every UDE', () => {
    const totalUdes = entitiesOfType(doc, 'ude').length;
    expect(totalUdes).toBeGreaterThanOrEqual(6);
    const top = findCoreDrivers(doc)[0];
    expect(top?.entity.coreProblem).toBe(true);
    expect(top?.reachedUdeCount).toBe(totalUdes);
  });

  it('is an acyclic diagnosis tree (no feedback loop)', () => {
    expect(findCycles(doc)).toEqual([]);
  });

  it('is structurally complete — every node reaches a UDE, every UDE has a cause', () => {
    // The CRT-completeness checks must stay clean. (The per-edge scrutiny prompts
    // `causality-existence` / `cause-sufficiency` fire on every link by design —
    // they're "is this cause enough?" nudges, not defects — so they're not asserted.)
    const ruleIds = new Set(validate(doc).map((w) => w.ruleId));
    expect(ruleIds.has('crt-dead-branch')).toBe(false);
    expect(ruleIds.has('crt-ude-no-upstream')).toBe(false);
  });
});
