import { beforeEach, describe, expect, it } from 'vitest';
import { validate } from '@/domain/validators';
import { makeDoc, makeEdge, makeEntity, resetIds } from '../helpers';

beforeEach(resetIds);

const longArrowWarnings = (
  entities: Parameters<typeof makeDoc>[0],
  edges: Parameters<typeof makeDoc>[1],
  diagram: Parameters<typeof makeDoc>[2] = 'crt'
) => validate(makeDoc(entities, edges, diagram)).filter((w) => w.ruleId === 'long-arrow');

/**
 * `longArrowRule` (Session 180 E5) — flags a sufficiency edge whose endpoints
 * differ by ≥ LEVEL_SPAN (3) causal levels, i.e. it leaps past ≥ 2 intermediate
 * steps. Level = longest forward-sufficiency chain ending at the node, with
 * back-edges excluded. Conservative: never fires on a single skipped step.
 */
describe('CLR: long-arrow', () => {
  // A→B→C→D chain (levels 0/1/2/3) plus a direct A→D arrow that spans all 3.
  const spanningChain = (titleA = 'A', titleD = 'D') => {
    const a = makeEntity({ title: titleA });
    const b = makeEntity({ title: 'B' });
    const c = makeEntity({ title: 'C' });
    const d = makeEntity({ title: titleD });
    const edges = [
      makeEdge(a.id, b.id),
      makeEdge(b.id, c.id),
      makeEdge(c.id, d.id),
      makeEdge(a.id, d.id), // the long arrow — spans level 3 - level 0 = 3
    ];
    return { entities: [a, b, c, d], a, d, longEdge: edges[3]!, edges };
  };

  it('fires on an arrow that spans 3 causal levels (skips ≥ 2 steps)', () => {
    const { entities, edges, longEdge } = spanningChain();
    const warns = longArrowWarnings(entities, edges);
    expect(warns).toHaveLength(1);
    expect(warns[0]?.target).toEqual({ kind: 'edge', id: longEdge.id });
    expect(warns[0]?.message).toContain('spans 3 causal levels');
  });

  it('does NOT fire on a 2-level span (the off-by-one boundary, LEVEL_SPAN = 3)', () => {
    // A→B→C chain (levels 0/1/2) plus a direct A→C arrow spanning only 2.
    const a = makeEntity({ title: 'A' });
    const b = makeEntity({ title: 'B' });
    const c = makeEntity({ title: 'C' });
    const edges = [makeEdge(a.id, b.id), makeEdge(b.id, c.id), makeEdge(a.id, c.id)];
    expect(longArrowWarnings([a, b, c], edges)).toHaveLength(0);
  });

  it('does NOT fire on a plain chain with no leaping arrow', () => {
    const a = makeEntity({ title: 'A' });
    const b = makeEntity({ title: 'B' });
    const c = makeEntity({ title: 'C' });
    const d = makeEntity({ title: 'D' });
    const edges = [makeEdge(a.id, b.id), makeEdge(b.id, c.id), makeEdge(c.id, d.id)];
    expect(longArrowWarnings([a, b, c, d], edges)).toHaveLength(0);
  });

  it('attaches the one-click insert-step action', () => {
    const { entities, edges } = spanningChain();
    const warn = longArrowWarnings(entities, edges)[0];
    expect(warn?.action).toEqual({ actionId: 'insert-step', label: 'Insert a step' });
  });

  it('truncates a long endpoint title in the message with an ellipsis', () => {
    // A 41-char title — over the 32-char truncate cap, so the message shows a
    // trimmed prefix + "…" rather than the whole title.
    const longTitle = 'This is a very long undesirable effect xx'; // 41 chars
    const { entities, edges } = spanningChain(longTitle, 'D');
    const warn = longArrowWarnings(entities, edges)[0];
    expect(warn?.message).toContain('…');
    expect(warn?.message).toContain('This is a very long undesirable'); // 31-char prefix kept
    expect(warn?.message).not.toContain(longTitle); // the full title was cut
  });

  it('trims whitespace around a short title (no ellipsis when it fits)', () => {
    const { entities, edges } = spanningChain('   Padded   ', 'D');
    const warn = longArrowWarnings(entities, edges)[0];
    expect(warn?.message).toContain('“Padded”');
    expect(warn?.message).not.toContain('…');
  });

  it('excludes back-edges so a feedback loop does not inflate levels', () => {
    // A→B→C with a back-edge C→A. The back-edge must be dropped from the level
    // walk, so no node reaches level 3 and nothing fires.
    const a = makeEntity({ title: 'A' });
    const b = makeEntity({ title: 'B' });
    const c = makeEntity({ title: 'C' });
    const edges = [
      makeEdge(a.id, b.id),
      makeEdge(b.id, c.id),
      makeEdge(c.id, a.id, { isBackEdge: true }),
    ];
    expect(longArrowWarnings([a, b, c], edges)).toHaveLength(0);
  });

  it('also applies on FRT, TT and NBR (the sufficiency diagrams)', () => {
    const { entities, edges } = spanningChain();
    for (const d of ['frt', 'tt', 'nbr'] as const) {
      expect(longArrowWarnings(entities, edges, d)).toHaveLength(1);
    }
  });

  it('does NOT apply on EC (not a sufficiency diagram)', () => {
    const { entities, edges } = spanningChain();
    expect(longArrowWarnings(entities, edges, 'ec')).toHaveLength(0);
  });
});
