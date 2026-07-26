import { describe, expect, it } from 'vitest';
import { ST_FACET_KEYS } from '@/domain/graph';
import type { AttrValue } from '@/domain/types';
import { stTacticAssumptionsRule } from '@/domain/validators/stTacticAssumptions';
import { makeDoc, makeEdge, makeEntity, resetIds } from './helpers';

/**
 * Session 76 / FL-DT4 + Session 198 backlog B — position-aware. A Strategy &
 * Tactics step declares the assumptions its POSITION calls for: the necessary
 * assumption only when it has a parent, the sufficiency assumption only when it
 * has children, the parallel assumption always. Edge convention: child → parent,
 * so an OUTGOING edge points at a parent and an INCOMING edge comes from a child.
 */

const filled: AttrValue = { kind: 'string', value: 'because…' };
const tacticWith = (facetKeys: string[]) =>
  makeEntity({
    type: 'injection',
    title: 'Tactic',
    attributes: Object.fromEntries(facetKeys.map((k) => [k, filled])),
  });

const messageFor = (doc: ReturnType<typeof makeDoc>, id: string): string | undefined =>
  stTacticAssumptionsRule(doc).find((w) => w.target.kind === 'entity' && w.target.id === id)
    ?.message;

const missingList = (msg?: string): string[] => {
  const list = msg?.match(/missing its (.+?) assumptions?\./)?.[1];
  if (!list) return [];
  // The rule builds this list with `Intl.ListFormat` now, which uses the
  // Oxford comma for en (", and sufficiency"). These assertions are about
  // WHICH facets are missing; list punctuation belongs to the catalogue.
  return list
    .split(/,\s*|\s+and\s+/)
    .map((s) => s.replace(/^and\s+/, '').trim())
    .filter((s) => s !== '');
};

describe('st-tactic-assumptions rule (position-aware)', () => {
  it('does not fire on non-S&T diagrams', () => {
    resetIds();
    const tactic = makeEntity({ type: 'injection', title: 'Tactic with no facets' });
    const ude = makeEntity({ type: 'ude' });
    const doc = makeDoc([tactic, ude], [makeEdge(tactic.id, ude.id)], 'crt');
    expect(stTacticAssumptionsRule(doc)).toHaveLength(0);
  });

  it('an apex leaf (no parent, no children) needs only the parallel assumption', () => {
    resetIds();
    const apex = makeEntity({ type: 'injection', title: 'Apex tactic' });
    const doc = makeDoc([apex], [], 'st');
    expect(missingList(messageFor(doc, apex.id))).toEqual(['parallel']);
  });

  it('a middle step (parent + children) needs all three', () => {
    resetIds();
    const parent = makeEntity({ type: 'goal', title: 'Parent strategy' });
    const step = makeEntity({ type: 'injection', title: 'Middle step' });
    const child = tacticWith([ST_FACET_KEYS.parallelAssumption]);
    const doc = makeDoc(
      [parent, step, child],
      [makeEdge(step.id, parent.id), makeEdge(child.id, step.id)],
      'st'
    );
    expect(missingList(messageFor(doc, step.id))).toEqual(['necessary', 'parallel', 'sufficiency']);
  });

  it('the apex (no parent) is not asked for a necessary assumption', () => {
    resetIds();
    const apex = makeEntity({ type: 'injection', title: 'Apex' });
    const child = tacticWith([ST_FACET_KEYS.parallelAssumption]);
    const doc = makeDoc([apex, child], [makeEdge(child.id, apex.id)], 'st');
    expect(missingList(messageFor(doc, apex.id))).toEqual(['parallel', 'sufficiency']);
  });

  it('a leaf (no children) is not asked for a sufficiency assumption', () => {
    resetIds();
    const parent = makeEntity({ type: 'goal', title: 'Parent' });
    const leaf = makeEntity({ type: 'injection', title: 'Leaf tactic' });
    const doc = makeDoc([parent, leaf], [makeEdge(leaf.id, parent.id)], 'st');
    expect(missingList(messageFor(doc, leaf.id))).toEqual(['necessary', 'parallel']);
  });

  it('does not fire when all position-required facets are filled', () => {
    resetIds();
    const parent = makeEntity({ type: 'goal', title: 'Parent' });
    const leaf = tacticWith([ST_FACET_KEYS.necessaryAssumption, ST_FACET_KEYS.parallelAssumption]);
    const doc = makeDoc([parent, leaf], [makeEdge(leaf.id, parent.id)], 'st');
    expect(messageFor(doc, leaf.id)).toBeUndefined();
  });

  it('treats a whitespace-only facet as empty', () => {
    resetIds();
    const parent = makeEntity({ type: 'goal', title: 'Parent' });
    const leaf = makeEntity({
      type: 'injection',
      title: 'Leaf',
      attributes: {
        [ST_FACET_KEYS.necessaryAssumption]: { kind: 'string', value: '   ' },
        [ST_FACET_KEYS.parallelAssumption]: filled,
      },
    });
    const doc = makeDoc([parent, leaf], [makeEdge(leaf.id, parent.id)], 'st');
    expect(missingList(messageFor(doc, leaf.id))).toEqual(['necessary']);
  });
});
