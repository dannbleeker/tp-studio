import { describe, expect, it } from 'vitest';
import type { EntityId, TPDocument } from '@/domain/types';
import { verbalisedECText, verbaliseEC } from '@/domain/verbalisation';
import { makeDoc, makeEdge, makeEntity, resetIds } from './helpers';

/**
 * Session 77 / brief §6 — Verbalisation generator.
 *
 * The tests use the EC doc helper to build minimal 5-slot setups and
 * assert that:
 *
 *   - Empty / unfilled slots render the placeholder copy.
 *   - Filled slots render the entity title.
 *   - The 5 canonical arrows each emit an `assumptionAnchor` token
 *     with the right edgeId + assumption count.
 *   - The plain-text flattener reproduces the verbal form.
 *   - Non-EC docs produce an empty token list.
 */

const buildEC = (
  opts: {
    titles?: Partial<Record<'a' | 'b' | 'c' | 'd' | 'dPrime', string>>;
    /** Optional list of assumption ids to attach to a given arrow (as
     *  `doc.assumptions` records keyed to that arrow's edge via `edgeId`). */
    assumptionsOn?: Partial<Record<'bToA' | 'cToA' | 'dToB' | 'dPrimeToC' | 'dToDPrime', string[]>>;
    /** Add a mutex flag to the D↔D' edge. */
    mutexDtoDPrime?: boolean;
  } = {}
) => {
  resetIds();
  const t = opts.titles ?? {};
  const a = makeEntity({
    type: 'goal',
    title: t.a ?? 'Shared objective',
    ecSlot: 'a',
  });
  const b = makeEntity({
    type: 'need',
    title: t.b ?? 'Need one',
    ecSlot: 'b',
  });
  const c = makeEntity({
    type: 'need',
    title: t.c ?? 'Need two',
    ecSlot: 'c',
  });
  const d = makeEntity({
    type: 'want',
    title: t.d ?? 'Want one',
    ecSlot: 'd',
  });
  const dPrime = makeEntity({
    type: 'want',
    title: t.dPrime ?? 'Want two',
    ecSlot: 'dPrime',
  });

  const ed = opts.assumptionsOn ?? {};
  const necessityEdge = (sourceId: EntityId, targetId: EntityId) => ({
    ...makeEdge(sourceId, targetId),
    kind: 'necessity' as const,
  });
  const bToA = necessityEdge(b.id, a.id);
  const cToA = necessityEdge(c.id, a.id);
  const dToB = necessityEdge(d.id, b.id);
  const dPrimeToC = necessityEdge(dPrime.id, c.id);
  const conflict = {
    ...necessityEdge(d.id, dPrime.id),
    ...(opts.mutexDtoDPrime ? { isMutualExclusion: true as const } : {}),
  };

  const doc = makeDoc([a, b, c, d, dPrime], [bToA, cToA, dToB, dPrimeToC, conflict], 'ec');

  // Record-canonical (v10): assumptions attach to an arrow via the
  // `doc.assumptions` record's `edgeId`. Turn each `assumptionsOn` list
  // into records keyed to the matching arrow's edge id (the verbaliser
  // counts them via `assumptionsForEdge`).
  const arrowEdgeIds: Record<keyof typeof ed, string> = {
    bToA: bToA.id,
    cToA: cToA.id,
    dToB: dToB.id,
    dPrimeToC: dPrimeToC.id,
    dToDPrime: conflict.id,
  };
  const assumptions: TPDocument['assumptions'] = {};
  for (const [arrow, ids] of Object.entries(ed) as [keyof typeof ed, string[]][]) {
    const edgeId = arrowEdgeIds[arrow];
    for (const id of ids) {
      assumptions![id] = {
        id,
        edgeId,
        text: id,
        status: 'unexamined',
        createdAt: 1,
        updatedAt: 1,
      };
    }
  }
  doc.assumptions = assumptions;

  return { doc, ids: { a: a.id, b: b.id, c: c.id, d: d.id, dPrime: dPrime.id } };
};

describe('verbaliseEC', () => {
  it('returns an empty list for non-EC docs', () => {
    resetIds();
    const a = makeEntity({ type: 'ude' });
    const b = makeEntity({ type: 'rootCause' });
    const doc = makeDoc([a, b], [makeEdge(b.id, a.id)], 'crt');
    expect(verbaliseEC(doc)).toEqual([]);
  });

  it('produces the five-sentence verbal form on a fully-filled EC', () => {
    const { doc } = buildEC({ mutexDtoDPrime: true });
    const tokens = verbaliseEC(doc);
    const text = tokens
      .filter((t) => t.kind === 'text' || t.kind === 'slot')
      .map((t) => (t.kind === 'text' ? t.text : t.text))
      .join('');
    expect(text).toContain('In order to achieve Shared objective, we must Need one');
    expect(text).toContain('In order to Need one, we must Want one');
    expect(text).toContain('In order to achieve Shared objective, we must also Need two');
    expect(text).toContain('In order to Need two, we must Want two');
    expect(text).toContain('But Want one and Want two cannot coexist');
  });

  it('uses placeholder copy when slots are empty', () => {
    const { doc } = buildEC({ titles: { a: '', b: '', c: '', d: '', dPrime: '' } });
    const text = verbalisedECText(doc);
    expect(text).toContain('the common objective');
    expect(text).toContain('the first need');
    expect(text).toContain('the second need');
    expect(text).toContain('the first want');
    expect(text).toContain('the conflicting want');
  });

  it('emits exactly five assumption anchors', () => {
    const { doc } = buildEC({ mutexDtoDPrime: true });
    const anchors = verbaliseEC(doc).filter((t) => t.kind === 'assumptionAnchor');
    expect(anchors).toHaveLength(5);
  });

  it('counts assumptions on each arrow from the legacy assumptionIds list', () => {
    const { doc } = buildEC({
      assumptionsOn: {
        bToA: ['asm-1', 'asm-2'],
        dToDPrime: ['asm-3'],
      },
      mutexDtoDPrime: true,
    });
    const anchors = verbaliseEC(doc).filter(
      (t): t is Extract<typeof t, { kind: 'assumptionAnchor' }> => t.kind === 'assumptionAnchor'
    );
    expect(anchors[0]?.assumptionCount).toBe(2); // bToA
    expect(anchors[4]?.assumptionCount).toBe(1); // dToDPrime mutex
  });

  it('verbalisedECText renders [N assumptions] when arrows are populated and [no assumptions yet] when empty', () => {
    const { doc } = buildEC({
      assumptionsOn: { bToA: ['asm-1', 'asm-2'] },
      mutexDtoDPrime: true,
    });
    const text = verbalisedECText(doc);
    expect(text).toContain('[2 assumptions]');
    expect(text).toContain('[no assumptions yet]');
  });

  it('handles a partially-built EC (only A + B filled)', () => {
    const { doc } = buildEC({ titles: { c: '', d: '', dPrime: '' } });
    const text = verbalisedECText(doc);
    expect(text).toContain('Shared objective');
    expect(text).toContain('Need one');
    expect(text).toContain('the second need');
    expect(text).toContain('the first want');
  });

  // Session 87 / EC PPT comparison item #4 — two-sided verbal style.
  describe('ecVerbalStyle', () => {
    it("renders 'we must' on neutral (default) mode", () => {
      const { doc } = buildEC();
      const text = verbalisedECText(doc);
      expect(text).toContain('we must');
      expect(text).not.toContain('they want to');
      expect(text).not.toContain('I want to');
    });

    it("swaps in 'they want to' / 'I want to' on twoSided mode", () => {
      const { doc } = buildEC();
      const twoSidedDoc = { ...doc, ecVerbalStyle: 'twoSided' as const };
      const text = verbalisedECText(twoSidedDoc);
      expect(text).toContain('they want to');
      expect(text).toContain('I want to');
      // The B↔A and C↔A arrows describe "what each side must do for
      // the shared objective" — they swap to "they must" / "I must
      // also" in twoSided mode.
      expect(text).toContain('they must');
      expect(text).toContain('I must also');
    });

    it('explicit neutral matches the default behaviour token-for-token', () => {
      const { doc } = buildEC();
      const defaultDoc = doc;
      const explicitDoc = { ...doc, ecVerbalStyle: 'neutral' as const };
      expect(verbalisedECText(explicitDoc)).toBe(verbalisedECText(defaultDoc));
    });

    it('preserves assumption-anchor token positions when the style flips', () => {
      const { doc } = buildEC({ mutexDtoDPrime: true });
      const neutralAnchors = verbaliseEC(doc).filter((t) => t.kind === 'assumptionAnchor');
      const twoSidedAnchors = verbaliseEC({
        ...doc,
        ecVerbalStyle: 'twoSided',
      }).filter((t) => t.kind === 'assumptionAnchor');
      expect(twoSidedAnchors).toHaveLength(neutralAnchors.length);
    });
  });
});
