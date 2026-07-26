import { beforeEach, describe, expect, it } from 'vitest';
import { ST_FACET_KEYS } from '@/domain/graph';
import type { AttrValue } from '@/domain/types';
import { validate } from '@/domain/validators';
import { makeDoc, makeEdge, makeEntity, resetIds } from '../helpers';

const RULE = 'st-tactic-assumptions';
const FILLED: AttrValue = { kind: 'string', value: 'because…' };

/** Build an S&T injection (tactic) with the listed facet attributes filled. */
const tactic = (title: string, facetKeys: string[] = []) =>
  makeEntity({
    type: 'injection',
    title,
    attributes: Object.fromEntries(facetKeys.map((k) => [k, FILLED])),
  });

const facetsFor = (warnings: ReturnType<typeof validate>, entityId: string) =>
  warnings.filter(
    (w) => w.ruleId === RULE && w.target.kind === 'entity' && w.target.id === entityId
  );

const allForRule = (warnings: ReturnType<typeof validate>) =>
  warnings.filter((w) => w.ruleId === RULE);

/**
 * The missing-assumption names from the warning message.
 *
 * The rule now builds this list with `Intl.ListFormat` instead of
 * `join(', ')`, so English gains a conjunction on the final item
 * ("necessary, parallel and sufficiency"). Stripping it here keeps these
 * assertions about WHICH facets are missing, which is what they are actually
 * pinning — the list punctuation is the catalogue's business and varies by
 * locale.
 */
const missingList = (msg?: string): string[] => {
  const list = msg?.match(/missing its (.+?) assumptions?\./)?.[1];
  if (!list) return [];
  // `Intl.ListFormat` uses the Oxford comma for en, so the final element
  // arrives as ", and sufficiency" — split on either separator, then shed a
  // leftover leading conjunction.
  return list
    .split(/,\s*|\s+and\s+/)
    .map((s) => s.replace(/^and\s+/, '').trim())
    .filter((s) => s !== '');
};

beforeEach(() => {
  resetIds();
});

// Edge convention: an edge runs child → parent. So an entity's OUTGOING edge
// points at its parent; an INCOMING edge comes from a child.
describe('CLR: st-tactic-assumptions (position-aware, backlog B)', () => {
  it('an apex leaf (no parent, no children) is asked only for the parallel assumption', () => {
    const t = tactic('Adopt new pricing tactic');
    const hits = facetsFor(validate(makeDoc([t], [], 'st')), t.id);
    expect(hits.length).toBe(1);
    expect(hits[0]!.target).toEqual({ kind: 'entity', id: t.id });
    expect(missingList(hits[0]!.message)).toEqual(['parallel']);
  });

  it('a middle step (parent + children) is asked for all three — exact message', () => {
    const parent = makeEntity({ type: 'goal', title: 'Parent strategy' });
    const step = tactic('Middle step');
    const child = tactic('Child', [ST_FACET_KEYS.parallelAssumption]); // filled so we isolate `step`
    const doc = makeDoc(
      [parent, step, child],
      [makeEdge(step.id, parent.id), makeEdge(child.id, step.id)],
      'st'
    );
    const hits = facetsFor(validate(doc), step.id);
    expect(hits.length).toBe(1);
    expect(hits[0]!.message).toBe(
      'Step is missing its necessary, parallel, and sufficiency assumptions. A Strategy & Tactics step declares why it is needed (necessary — points up to its parent), why this tactic fits the strategy (parallel), and, when it has sub-steps, why those are needed (sufficiency — points down to its children).'
    );
  });

  it('the apex (no parent) is NOT nagged for a necessary assumption', () => {
    const apex = tactic('Apex'); // has a child below, no parent above
    const child = tactic('Child', [ST_FACET_KEYS.parallelAssumption]);
    const doc = makeDoc([apex, child], [makeEdge(child.id, apex.id)], 'st');
    expect(missingList(facetsFor(validate(doc), apex.id)[0]!.message)).toEqual([
      'parallel',
      'sufficiency',
    ]);
  });

  it('a leaf (no children) is NOT nagged for a sufficiency assumption', () => {
    const parent = makeEntity({ type: 'goal', title: 'Parent' });
    const leaf = tactic('Leaf tactic');
    const doc = makeDoc([parent, leaf], [makeEdge(leaf.id, parent.id)], 'st');
    expect(missingList(facetsFor(validate(doc), leaf.id)[0]!.message)).toEqual([
      'necessary',
      'parallel',
    ]);
  });

  it('uses singular "assumption" when exactly one is missing (plural killer)', () => {
    const parent = makeEntity({ type: 'goal', title: 'Parent' });
    const leaf = tactic('Leaf', [ST_FACET_KEYS.necessaryAssumption]); // needs necessary+parallel; has necessary
    const doc = makeDoc([parent, leaf], [makeEdge(leaf.id, parent.id)], 'st');
    const msg = facetsFor(validate(doc), leaf.id)[0]!.message;
    expect(msg).toContain('missing its parallel assumption.');
    expect(msg).not.toContain('parallel assumptions.');
  });

  it('does NOT fire when all position-required facets are filled', () => {
    const parent = makeEntity({ type: 'goal', title: 'Parent' });
    // A leaf with a parent needs necessary + parallel (no children → no sufficiency).
    const leaf = tactic('Leaf', [
      ST_FACET_KEYS.necessaryAssumption,
      ST_FACET_KEYS.parallelAssumption,
    ]);
    const doc = makeDoc([parent, leaf], [makeEdge(leaf.id, parent.id)], 'st');
    expect(facetsFor(validate(doc), leaf.id).length).toBe(0);
  });

  it('does NOT count necessaryCondition child entities toward the facets', () => {
    const parent = makeEntity({ type: 'goal', title: 'Parent' });
    const step = tactic('Step');
    const nc = makeEntity({ type: 'necessaryCondition', title: 'NA' });
    const doc = makeDoc(
      [parent, step, nc],
      [makeEdge(step.id, parent.id), makeEdge(nc.id, step.id)],
      'st'
    );
    // step has a parent (→parent) and a child (nc→step) ⇒ all three required.
    expect(missingList(facetsFor(validate(doc), step.id)[0]!.message)).toEqual([
      'necessary',
      'parallel',
      'sufficiency',
    ]);
  });

  it('only flags injection entities, not necessaryCondition or other types', () => {
    const t = tactic('Tactic');
    const nc = makeEntity({ type: 'necessaryCondition', title: 'A lone facet node' });
    const effect = makeEntity({ type: 'effect', title: 'An effect node' });
    const ruleHits = allForRule(validate(makeDoc([t, nc, effect], [], 'st')));
    expect(ruleHits.length).toBe(1);
    expect(ruleHits[0]!.target).toEqual({ kind: 'entity', id: t.id });
  });

  it('does NOT fire on a non-st diagram even with an injection lacking facets', () => {
    const t = tactic('Tactic');
    expect(allForRule(validate(makeDoc([t], [], 'frt'))).length).toBe(0);
  });

  it('respects a user-resolved warning (resolved flag flows through)', () => {
    const t = tactic('Tactic');
    const warningId = `${RULE}:entity:${t.id}`;
    const hits = facetsFor(validate(makeDoc([t], [], 'st', { [warningId]: true })), t.id);
    expect(hits.length).toBe(1);
    expect(hits[0]!.resolved).toBe(true);
  });

  it('stamps the clarity tier on the warning', () => {
    const t = tactic('Tactic');
    const hits = facetsFor(validate(makeDoc([t], [], 'st')), t.id);
    expect(hits.length).toBe(1);
    expect(hits[0]!.tier).toBe('clarity');
  });
});
