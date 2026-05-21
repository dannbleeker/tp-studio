/**
 * Session 106 — Microbenchmarks for the Tier 1 perf items.
 *
 * Plain test (not vitest `bench`) so output is deterministic via
 * `console.log` rather than vitest's interactive bench reporter.
 *
 * Run: `node ./node_modules/vitest/vitest.mjs run tests/perf/tier1.bench.ts`
 *
 * Each measurement runs the target function `iterations` times,
 * times the whole loop with `performance.now()`, computes ops/sec
 * and per-op nanoseconds. Output is a Markdown table per group
 * so it copies cleanly into a CHANGELOG entry.
 */

import { describe, it } from 'vitest';
import { edgesArray, entitiesArray, incomingEdges, outgoingEdges } from '@/domain/graph';
import { computeDetailedRevisionDiff } from '@/domain/revisions';
import type { Edge, Entity, TPDocument } from '@/domain/types';
import { buildRiskRegisterCsv } from '@/services/exporters/riskRegister';
import { makeDoc, makeEdge, makeEntity, resetIds } from '../domain/helpers';

const buildDoc = (entityCount: number): TPDocument => {
  resetIds();
  const entities: Entity[] = [];
  for (let i = 0; i < entityCount; i++) {
    entities.push(makeEntity({ title: `Entity ${i}` }));
  }
  const edges: Edge[] = [];
  for (let i = 0; i < entityCount - 1; i++) {
    const src = entities[i + 1];
    const tgt = entities[i];
    if (src && tgt) edges.push(makeEdge(src.id, tgt.id));
  }
  return makeDoc(entities, edges, 'crt');
};

const mutateOneEntity = (doc: TPDocument): TPDocument => {
  const ids = Object.keys(doc.entities);
  const firstId = ids[0];
  if (!firstId) return doc;
  const first = doc.entities[firstId];
  if (!first) return doc;
  return {
    ...doc,
    entities: {
      ...doc.entities,
      [firstId]: { ...first, title: `${first.title} (edited)` },
    },
  };
};

type Row = {
  label: string;
  iters: number;
  totalMs: number;
  opsPerSec: number;
  nsPerOp: number;
};

const measure = (label: string, iterations: number, fn: () => void): Row => {
  // Warm-up: a few calls to let V8 JIT settle before timing.
  for (let i = 0; i < 100; i++) fn();
  const t0 = performance.now();
  for (let i = 0; i < iterations; i++) fn();
  const t1 = performance.now();
  const totalMs = t1 - t0;
  const opsPerSec = (iterations / totalMs) * 1000;
  const nsPerOp = (totalMs * 1_000_000) / iterations;
  return { label, iters: iterations, totalMs, opsPerSec, nsPerOp };
};

const printTable = (title: string, rows: Row[]): void => {
  console.log(`\n### ${title}\n`);
  console.log('| Variant | Iters | Total (ms) | ops/sec | ns/op |');
  console.log('| --- | ---: | ---: | ---: | ---: |');
  for (const r of rows) {
    console.log(
      `| ${r.label} | ${r.iters.toLocaleString()} | ${r.totalMs.toFixed(2)} | ${Math.round(r.opsPerSec).toLocaleString()} | ${r.nsPerOp.toFixed(1)} |`
    );
  }
};

describe('Tier 1 perf — microbenchmarks', () => {
  it('edgesArray (cached) vs Object.values(doc.edges)', () => {
    const rows: Row[] = [];
    for (const N of [100, 500, 1000]) {
      const doc = buildDoc(N);
      edgesArray(doc); // prime cache
      rows.push(measure(`edgesArray cached    — ${N} edges`, 1_000_000, () => edgesArray(doc)));
      rows.push(
        measure(`Object.values uncached — ${N} edges`, 100_000, () => Object.values(doc.edges))
      );
    }
    printTable('edgesArray vs Object.values(doc.edges)', rows);
  });

  it('entitiesArray (cached) vs Object.values(doc.entities)', () => {
    const rows: Row[] = [];
    for (const N of [100, 500, 1000]) {
      const doc = buildDoc(N);
      entitiesArray(doc);
      rows.push(
        measure(`entitiesArray cached  — ${N} entities`, 1_000_000, () => entitiesArray(doc))
      );
      rows.push(
        measure(`Object.values uncached — ${N} entities`, 100_000, () =>
          Object.values(doc.entities)
        )
      );
    }
    printTable('entitiesArray vs Object.values(doc.entities)', rows);
  });

  it('incomingEdges / outgoingEdges (Session 135 edge index)', () => {
    const rows: Row[] = [];
    for (const N of [100, 500, 1000]) {
      const doc = buildDoc(N);
      // Prime the edge-index cache.
      incomingEdges(
        doc,
        doc.entities[Object.keys(doc.entities)[0] ?? ''] ? Object.keys(doc.entities)[0]! : ''
      );
      const ids = Object.keys(doc.entities);
      const sampleId = ids[Math.floor(ids.length / 2)] ?? '';
      rows.push(
        measure(`incomingEdges indexed — ${N} entities`, 1_000_000, () =>
          incomingEdges(doc, sampleId)
        )
      );
      rows.push(
        measure(`outgoingEdges indexed — ${N} entities`, 1_000_000, () =>
          outgoingEdges(doc, sampleId)
        )
      );
    }
    printTable('Edge-index lookups (Perf #1)', rows);
  });

  it('buildRiskRegisterCsv (Session 135 single-pass mitigation walk)', () => {
    // Build a synthetic doc with 50 UDEs + 10 mitigations (injection /
    // desiredEffect) each connected to ~half the UDEs through 2-step
    // chains. Worst case for the prior per-UDE BFS implementation.
    const rows: Row[] = [];
    for (const U of [10, 50, 100]) {
      resetIds();
      const udes: Entity[] = [];
      for (let i = 0; i < U; i++) udes.push(makeEntity({ title: `UDE ${i}`, type: 'ude' }));
      const intermediates: Entity[] = [];
      for (let i = 0; i < U; i++)
        intermediates.push(makeEntity({ title: `Intermediate ${i}`, type: 'effect' }));
      const injections: Entity[] = [];
      const M = Math.max(3, Math.floor(U / 5));
      for (let i = 0; i < M; i++)
        injections.push(makeEntity({ title: `Injection ${i}`, type: 'injection' }));
      const edges: Edge[] = [];
      // intermediate[i] → ude[i]
      for (let i = 0; i < U; i++) {
        const src = intermediates[i];
        const tgt = udes[i];
        if (src && tgt) edges.push(makeEdge(src.id, tgt.id));
      }
      // injection[m] → intermediate[i] for every (m, i) where i % M === m
      // — gives shared mitigation ancestors across UDEs, which was the
      // pathological case for the prior implementation.
      for (let i = 0; i < U; i++) {
        const inj = injections[i % M];
        const intm = intermediates[i];
        if (inj && intm) edges.push(makeEdge(inj.id, intm.id));
      }
      const doc = makeDoc([...udes, ...intermediates, ...injections], edges, 'crt');
      rows.push(
        measure(`risk register CSV     — ${U} UDEs`, 1000, () => buildRiskRegisterCsv(doc))
      );
    }
    printTable('Risk-register CSV export (Perf #4)', rows);
  });

  it('computeDetailedRevisionDiff (cached) vs uncached', () => {
    const rows: Row[] = [];
    for (const N of [100, 500, 1000]) {
      const prev = buildDoc(N);
      const next = mutateOneEntity(prev);
      computeDetailedRevisionDiff(prev, next); // prime cache
      rows.push(
        measure(`diff cached           — ${N} entities`, 100_000, () =>
          computeDetailedRevisionDiff(prev, next)
        )
      );
      // Uncached path: build new docs each call so the cache misses.
      rows.push(
        measure(`diff uncached         — ${N} entities`, 100, () => {
          const p = buildDoc(N);
          const n = mutateOneEntity(p);
          computeDetailedRevisionDiff(p, n);
        })
      );
    }
    printTable('computeDetailedRevisionDiff', rows);
  });
});
