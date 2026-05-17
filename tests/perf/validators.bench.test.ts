import type { Edge, Entity, TPDocument } from '@/domain/types';
/**
 * Session 113 — Per-rule validator microbenchmarks.
 *
 * Companion to `tier1.bench.test.ts` (which measures the shared graph
 * helpers). This file times every individual CLR rule against a
 * realistic 100-entity / 99-edge CRT so a future PR that adds an
 * accidentally-O(n²) check shows up as a measurable regression rather
 * than a silent slowdown.
 *
 * Per-rule timing also informs which rules (if any) are worth
 * promoting to their own memoization layer (item #22). The existing
 * doc-level `validate()` cache handles the common path; per-rule
 * memo would only pay off for rules whose result depends on a strict
 * subset of doc state — i.e. they could legitimately cache across
 * edits that change only title text, polarity, etc.
 *
 * Run via: `node ./node_modules/vitest/vitest.mjs run tests/perf/validators.bench.test.ts`
 */
import { additionalCauseRuleFor } from '@/domain/validators/additionalCause';
import { causalityExistenceRule } from '@/domain/validators/causalityExistence';
import { causeEffectReversalRule } from '@/domain/validators/causeEffectReversal';
import { causeSufficiencyRule } from '@/domain/validators/causeSufficiency';
import { clarityRule } from '@/domain/validators/clarity';
import { cycleRule } from '@/domain/validators/cycle';
import { entityExistenceRule } from '@/domain/validators/entityExistence';
import { externalRootCauseRule } from '@/domain/validators/externalRootCause';
import { indirectEffectRule } from '@/domain/validators/indirectEffect';
import { tautologyRule } from '@/domain/validators/tautology';
import { describe, it } from 'vitest';
import { makeDoc, makeEdge, makeEntity, resetIds } from '../domain/helpers';

const buildDoc = (entityCount: number): TPDocument => {
  resetIds();
  const entities: Entity[] = [];
  for (let i = 0; i < entityCount; i++) {
    entities.push(makeEntity({ title: `Entity ${i}`, type: i === 0 ? 'ude' : 'effect' }));
  }
  const edges: Edge[] = [];
  for (let i = 0; i < entityCount - 1; i++) {
    const src = entities[i + 1];
    const tgt = entities[i];
    if (src && tgt) edges.push(makeEdge(src.id, tgt.id));
  }
  return makeDoc(entities, edges, 'crt');
};

type Row = {
  rule: string;
  iters: number;
  totalMs: number;
  opsPerSec: number;
  nsPerOp: number;
};

const measure = (rule: string, iterations: number, fn: () => void): Row => {
  for (let i = 0; i < 100; i++) fn();
  const t0 = performance.now();
  for (let i = 0; i < iterations; i++) fn();
  const t1 = performance.now();
  const totalMs = t1 - t0;
  const opsPerSec = (iterations / totalMs) * 1000;
  const nsPerOp = (totalMs * 1_000_000) / iterations;
  return { rule, iters: iterations, totalMs, opsPerSec, nsPerOp };
};

const printTable = (title: string, rows: Row[]): void => {
  console.log(`\n### ${title}\n`);
  console.log('| Rule | Iters | Total (ms) | ops/sec | µs/op |');
  console.log('| --- | ---: | ---: | ---: | ---: |');
  for (const r of rows) {
    console.log(
      `| ${r.rule} | ${r.iters.toLocaleString()} | ${r.totalMs.toFixed(2)} | ${Math.round(r.opsPerSec).toLocaleString()} | ${(r.nsPerOp / 1000).toFixed(2)} |`
    );
  }
};

describe('Per-rule validator perf — 100-entity CRT', () => {
  it('times every rule individually', () => {
    const doc = buildDoc(100);
    const iters = 10_000;
    const rows: Row[] = [
      measure('clarity', iters, () => clarityRule(doc)),
      measure('entity-existence', iters, () => entityExistenceRule(doc)),
      measure('causality-existence', iters, () => causalityExistenceRule(doc)),
      measure('tautology', iters, () => tautologyRule(doc)),
      measure('cycle', iters, () => cycleRule(doc)),
      measure('indirect-effect', iters, () => indirectEffectRule(doc)),
      measure('cause-sufficiency', iters, () => causeSufficiencyRule(doc)),
      measure('additional-cause (ude)', iters, () => additionalCauseRuleFor('ude')(doc)),
      measure('cause-effect-reversal', iters, () => causeEffectReversalRule(doc)),
      measure('external-root-cause', iters, () => externalRootCauseRule(doc)),
    ];
    rows.sort((a, b) => b.nsPerOp - a.nsPerOp);
    printTable('CRT 100-entity, 10k iterations per rule', rows);
  });
});
