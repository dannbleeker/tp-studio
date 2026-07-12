import { beforeEach, describe, expect, it } from 'vitest';
import { exportToJSON, importFromJSON } from '@/domain/persistenceJson';
import { spawnCRTFromGoalTree } from '@/domain/spawnCRT';
import { spawnFRTFromCrt } from '@/domain/spawnFRT';
import { makeDoc, makeEdge, makeEntity, resetIds } from './helpers';

/**
 * Session 198 (backlog C) — cross-tree spawn bridges. Both are UNLINKED: they
 * mint a fresh document and never touch the source, so a single diagram stays
 * usable standalone.
 */
beforeEach(resetIds);

const typed = (doc: ReturnType<typeof makeDoc>, type: string) =>
  Object.values(doc.entities).filter((e) => e.type === type);

/**
 * The other half of the "unlinked" invariant: a spawned entity must carry NO
 * cross-doc back-reference to the source (an `importedFrom` or `links` ref would
 * couple the two documents and break the standalone guarantee). The source-is-
 * untouched checks below cover mutation; this covers coupling.
 */
const expectNoCrossDocLink = (doc: ReturnType<typeof makeDoc>) => {
  for (const e of Object.values(doc.entities)) {
    expect(e.importedFrom).toBeUndefined();
    expect(e.links).toBeUndefined();
  }
};

describe('spawnFRTFromCrt (CRT → FRT invert)', () => {
  it('seeds a desired effect per UDE plus a starter injection, and leaves the CRT untouched', () => {
    const ude1 = makeEntity({ type: 'ude', title: 'Orders ship late' });
    const ude2 = makeEntity({ type: 'ude', title: 'Quality slips' });
    const rc = makeEntity({ type: 'rootCause', title: 'Batches too big' });
    const crt = makeDoc([ude1, ude2, rc], [makeEdge(rc.id, ude1.id)], 'crt');
    const before = JSON.stringify(crt);

    const frt = spawnFRTFromCrt(crt);
    expect(frt.diagramType).toBe('frt');
    expect(frt.id).not.toBe(crt.id);
    expect(typed(frt, 'desiredEffect').map((d) => d.title)).toEqual([
      'Reverse: Orders ship late',
      'Reverse: Quality slips',
    ]);
    expect(typed(frt, 'injection')).toHaveLength(1);
    // Standalone guarantee: the source CRT is byte-for-byte unchanged, and the
    // spawned entities hold no cross-doc link back to it.
    expect(JSON.stringify(crt)).toBe(before);
    expectNoCrossDocLink(frt);
    // The spawned doc is valid and round-trips.
    expect(importFromJSON(exportToJSON(frt)).diagramType).toBe('frt');
  });
});

describe('spawnCRTFromGoalTree (Goal Tree → CRT benchmark)', () => {
  it('turns each CSF / NC into a candidate UDE and leaves the Goal Tree untouched', () => {
    const goal = makeEntity({ type: 'goal', title: 'Win the market' });
    const csf = makeEntity({ type: 'criticalSuccessFactor', title: 'Reliable delivery' });
    const nc = makeEntity({ type: 'necessaryCondition', title: 'Buffers managed' });
    const gt = makeDoc(
      [goal, csf, nc],
      [makeEdge(csf.id, goal.id), makeEdge(nc.id, csf.id)],
      'goalTree'
    );
    const before = JSON.stringify(gt);

    const crt = spawnCRTFromGoalTree(gt);
    expect(crt.diagramType).toBe('crt');
    expect(crt.id).not.toBe(gt.id);
    expect(typed(crt, 'ude').map((u) => u.title)).toEqual([
      'Reliable delivery is not met',
      'Buffers managed is not met',
    ]);
    // The apex goal is NOT benchmarked (only CSF/NC standards become UDEs).
    expect(typed(crt, 'ude')).toHaveLength(2);
    expect(JSON.stringify(gt)).toBe(before);
    expectNoCrossDocLink(crt);
    expect(importFromJSON(exportToJSON(crt)).diagramType).toBe('crt');
  });
});
