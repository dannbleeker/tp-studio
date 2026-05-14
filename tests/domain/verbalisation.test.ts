import type { EntityId } from '@/domain/types';
import { verbaliseEC, verbalisedECText } from '@/domain/verbalisation';
import { describe, expect, it } from 'vitest';
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
    /** Optional list of assumption-entity ids to attach to a given edge. */
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
  const bToA = {
    ...makeEdge(b.id, a.id),
    kind: 'necessity' as const,
    assumptionIds: ed.bToA as EntityId[] | undefined,
  };
  const cToA = {
    ...makeEdge(c.id, a.id),
    kind: 'necessity' as const,
    assumptionIds: ed.cToA as EntityId[] | undefined,
  };
  const dToB = {
    ...makeEdge(d.id, b.id),
    kind: 'necessity' as const,
    assumptionIds: ed.dToB as EntityId[] | undefined,
  };
  const dPrimeToC = {
    ...makeEdge(dPrime.id, c.id),
    kind: 'necessity' as const,
    assumptionIds: ed.dPrimeToC as EntityId[] | undefined,
  };
  const conflict = {
    ...makeEdge(d.id, dPrime.id),
    kind: 'necessity' as const,
    isMutualExclusion: opts.mutexDtoDPrime ? true : undefined,
    assumptionIds: ed.dToDPrime as EntityId[] | undefined,
  };

  const doc = makeDoc([a, b, c, d, dPrime], [bToA, cToA, dToB, dPrimeToC, conflict], 'ec');
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
});
