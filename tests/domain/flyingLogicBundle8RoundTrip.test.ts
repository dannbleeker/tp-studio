import { importFromFlyingLogic } from '@/domain/flyingLogic/reader';
import { exportToFlyingLogic } from '@/domain/flyingLogic/writer';
import { describe, expect, it } from 'vitest';
import { makeDoc, makeEdge, makeEntity, resetIds } from './helpers';

/**
 * Session 76 — Bundle 8 features (OR junctor, XOR junctor, edge weight)
 * now round-trip through Flying Logic. AND junctors continue to work
 * identically (the writer falls back to the same `tp-studio-and-group-id`
 * attribute key the reader has always recognized).
 */

describe('Flying Logic round-trip — Bundle 8 features', () => {
  it('preserves OR-grouped edges across export → import', () => {
    resetIds();
    const a = makeEntity({ type: 'rootCause', title: 'A' });
    const b = makeEntity({ type: 'rootCause', title: 'B' });
    const c = makeEntity({ type: 'ude', title: 'C' });
    const e1 = { ...makeEdge(a.id, c.id), orGroupId: 'or-test-1' };
    const e2 = { ...makeEdge(b.id, c.id), orGroupId: 'or-test-1' };
    const doc = makeDoc([a, b, c], [e1, e2], 'crt');
    const xml = exportToFlyingLogic(doc);
    expect(xml).toContain('tp-studio-or-group-id');
    const restored = importFromFlyingLogic(xml);
    const restoredEdges = Object.values(restored.edges);
    const orEdges = restoredEdges.filter((e) => e.orGroupId);
    expect(orEdges).toHaveLength(2);
    expect(orEdges[0]?.orGroupId).toBe(orEdges[1]?.orGroupId);
    // No accidental AND / XOR contamination.
    expect(restoredEdges.every((e) => !e.andGroupId)).toBe(true);
    expect(restoredEdges.every((e) => !e.xorGroupId)).toBe(true);
  });

  it('preserves XOR-grouped edges across export → import', () => {
    resetIds();
    const a = makeEntity({ type: 'rootCause', title: 'A' });
    const b = makeEntity({ type: 'rootCause', title: 'B' });
    const c = makeEntity({ type: 'ude', title: 'C' });
    const e1 = { ...makeEdge(a.id, c.id), xorGroupId: 'xor-test-1' };
    const e2 = { ...makeEdge(b.id, c.id), xorGroupId: 'xor-test-1' };
    const doc = makeDoc([a, b, c], [e1, e2], 'crt');
    const xml = exportToFlyingLogic(doc);
    expect(xml).toContain('tp-studio-xor-group-id');
    const restored = importFromFlyingLogic(xml);
    const xorEdges = Object.values(restored.edges).filter((e) => e.xorGroupId);
    expect(xorEdges).toHaveLength(2);
    expect(xorEdges[0]?.xorGroupId).toBe(xorEdges[1]?.xorGroupId);
  });

  it('preserves edge weights (positive / negative / zero) across export → import', () => {
    resetIds();
    const a = makeEntity({ type: 'rootCause', title: 'A' });
    const b = makeEntity({ type: 'rootCause', title: 'B' });
    const c = makeEntity({ type: 'rootCause', title: 'C' });
    const d = makeEntity({ type: 'ude', title: 'D' });
    const ePos = { ...makeEdge(a.id, d.id), weight: 'positive' as const };
    const eNeg = { ...makeEdge(b.id, d.id), weight: 'negative' as const };
    const eZero = { ...makeEdge(c.id, d.id), weight: 'zero' as const };
    const doc = makeDoc([a, b, c, d], [ePos, eNeg, eZero], 'crt');
    const xml = exportToFlyingLogic(doc);
    expect(xml).toContain('tp-studio-weight');
    const restored = importFromFlyingLogic(xml);
    const weights = Object.values(restored.edges)
      .map((e) => e.weight)
      .filter(Boolean)
      .sort();
    expect(weights).toEqual(['negative', 'positive', 'zero']);
  });

  it('preserves a weight tag on an AND-grouped source-to-junctor edge', () => {
    resetIds();
    const a = makeEntity({ type: 'rootCause', title: 'A' });
    const b = makeEntity({ type: 'rootCause', title: 'B' });
    const c = makeEntity({ type: 'ude', title: 'C' });
    const e1 = { ...makeEdge(a.id, c.id), andGroupId: 'and-1', weight: 'negative' as const };
    const e2 = { ...makeEdge(b.id, c.id), andGroupId: 'and-1' };
    const doc = makeDoc([a, b, c], [e1, e2], 'crt');
    const xml = exportToFlyingLogic(doc);
    const restored = importFromFlyingLogic(xml);
    const negEdge = Object.values(restored.edges).find((e) => e.weight === 'negative');
    expect(negEdge).toBeDefined();
    expect(negEdge?.andGroupId).toBeDefined();
  });
});
