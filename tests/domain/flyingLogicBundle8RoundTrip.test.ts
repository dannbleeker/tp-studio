import { describe, expect, it } from 'vitest';
import { createDocument, createGroup } from '@/domain/factory';
import { importFromFlyingLogic } from '@/domain/flyingLogic/reader';
import { exportToFlyingLogic } from '@/domain/flyingLogic/writer';
import type { TPDocument } from '@/domain/types';
import { makeDoc, makeEdge, makeEntity, resetIds } from './helpers';

const roundTrip = (doc: TPDocument): TPDocument => importFromFlyingLogic(exportToFlyingLogic(doc));
const kindsOf = (doc: TPDocument): string[] => Object.values(doc.edges).map((e) => e.kind);

/**
 * Session 76 — Bundle 8 features (OR junctor, XOR junctor, edge weight)
 * now round-trip through Flying Logic. AND junctors continue to work
 * identically (the writer falls back to the same `tp-studio-and-group-id`
 * attribute key the reader has always recognized).
 */

/**
 * Session 206 (bug hunt) — the writer never emitted `edge.kind`, and the reader
 * rebuilt every edge through `createEdge`, which hardcodes `kind: 'sufficiency'`.
 * A round-trip therefore silently rewrote the necessity logic of an Evaporating
 * Cloud or a Goal Tree — reachable by double-clicking a `.logicx` (the PWA file
 * handler imports straight into a tab). `isMutualExclusion` died to the same gap.
 */
describe('Flying Logic round-trip — edge kind + mutex (Session 206)', () => {
  it('keeps an EC necessity-typed (the reported repro)', () => {
    // A blank EC seeds 4 necessity edges (D→B, D′→C, B→A, C→A).
    const ec = createDocument('ec');
    expect(kindsOf(ec)).toEqual(['necessity', 'necessity', 'necessity', 'necessity']);
    // Pre-fix every one of these came back 'sufficiency'.
    expect(kindsOf(roundTrip(ec))).toEqual(['necessity', 'necessity', 'necessity', 'necessity']);
  });

  it('keeps a Goal Tree necessity-typed', () => {
    resetIds();
    const goal = makeEntity({ type: 'goal', title: 'G' });
    const csf = makeEntity({ type: 'criticalSuccessFactor', title: 'C' });
    const edge = { ...makeEdge(csf.id, goal.id), kind: 'necessity' as const };
    expect(kindsOf(roundTrip(makeDoc([goal, csf], [edge], 'goalTree')))).toEqual(['necessity']);
  });

  it('leaves a CRT sufficiency-typed', () => {
    resetIds();
    const a = makeEntity({ type: 'rootCause', title: 'A' });
    const b = makeEntity({ type: 'ude', title: 'B' });
    expect(kindsOf(roundTrip(makeDoc([a, b], [makeEdge(a.id, b.id)], 'crt')))).toEqual([
      'sufficiency',
    ]);
  });

  it('preserves the EC mutual-exclusion flag', () => {
    resetIds();
    const d = makeEntity({ type: 'want', title: 'D' });
    const dPrime = makeEntity({ type: 'want', title: "D'" });
    const mutex = {
      ...makeEdge(d.id, dPrime.id),
      kind: 'necessity' as const,
      isMutualExclusion: true,
    };
    const back = roundTrip(makeDoc([d, dPrime], [mutex], 'ec'));
    expect(Object.values(back.edges)[0]?.isMutualExclusion).toBe(true);
  });

  it('preserves the kind on a junctor source-to-junctor edge', () => {
    resetIds();
    const a = makeEntity({ type: 'necessaryCondition', title: 'A' });
    const b = makeEntity({ type: 'necessaryCondition', title: 'B' });
    const c = makeEntity({ type: 'goal', title: 'C' });
    const e1 = { ...makeEdge(a.id, c.id), kind: 'necessity' as const, andGroupId: 'g1' };
    const e2 = { ...makeEdge(b.id, c.id), kind: 'necessity' as const, andGroupId: 'g1' };
    expect(kindsOf(roundTrip(makeDoc([a, b, c], [e1, e2], 'goalTree')))).toEqual([
      'necessity',
      'necessity',
    ]);
  });

  // A file authored in Flying Logic itself carries no `tp-studio-kind`; the
  // reader then has to infer from the diagram's primary logic.
  it('falls back to necessity for a native FL file on an EC', () => {
    const xml = exportToFlyingLogic(createDocument('ec')).replace(
      /<attribute key="tp-studio-kind"[^>]*>[^<]*<\/attribute>/g,
      ''
    );
    expect(xml).not.toContain('tp-studio-kind');
    expect(kindsOf(importFromFlyingLogic(xml))).toEqual([
      'necessity',
      'necessity',
      'necessity',
      'necessity',
    ]);
  });

  it('falls back to sufficiency for a native FL file on a CRT', () => {
    resetIds();
    const a = makeEntity({ type: 'rootCause', title: 'A' });
    const b = makeEntity({ type: 'ude', title: 'B' });
    const xml = exportToFlyingLogic(makeDoc([a, b], [makeEdge(a.id, b.id)], 'crt')).replace(
      /<attribute key="tp-studio-kind"[^>]*>[^<]*<\/attribute>/g,
      ''
    );
    expect(kindsOf(importFromFlyingLogic(xml))).toEqual(['sufficiency']);
  });
});

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

/**
 * Session 190 — nested groups must survive a round-trip regardless of vertex
 * order. The writer emits group vertices in `doc.groups` insertion order with no
 * child-before-parent guarantee, so a parent that contains a later-defined child
 * group is emitted FIRST. The reader's single-pass group resolution used to look
 * the child up in a half-built map and silently drop the reference — losing the
 * nesting. The two-pass reader fixes it.
 */
describe('Flying Logic round-trip — nested groups', () => {
  it('preserves a forward-referenced child group (parent emitted before child)', () => {
    resetIds();
    const a = makeEntity({ type: 'rootCause', title: 'A' });
    const b = makeEntity({ type: 'ude', title: 'B' });
    const child = createGroup({ title: 'Child', memberIds: [a.id, b.id] });
    const parent = createGroup({ title: 'Parent', memberIds: [child.id] });
    // Parent inserted BEFORE child → writer emits the parent vertex first, so the
    // parent's child-group reference is a FORWARD reference on import.
    const doc = {
      ...makeDoc([a, b], [makeEdge(a.id, b.id)], 'crt'),
      groups: { [parent.id]: parent, [child.id]: child },
    };
    const restored = importFromFlyingLogic(exportToFlyingLogic(doc));
    const restoredGroups = Object.values(restored.groups);
    const restoredParent = restoredGroups.find((g) => g.title === 'Parent');
    const restoredChild = restoredGroups.find((g) => g.title === 'Child');
    expect(restoredParent).toBeDefined();
    expect(restoredChild).toBeDefined();
    // The nesting survived: the parent still lists the child group as a member.
    expect(restoredParent?.memberIds).toContain(restoredChild?.id);
    // And the child kept its entity members.
    expect(restoredChild?.memberIds).toHaveLength(2);
  });
});
