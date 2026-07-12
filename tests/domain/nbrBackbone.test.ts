import { describe, expect, it } from 'vitest';
import { nbrBackbone } from '@/domain/nbrBackbone';
import { makeDoc, makeEdge, makeEntity } from './helpers';

/**
 * Session 199 (backlog E) — the NBR backbone (injection → … → UDE spine) + its
 * turning point (the first negative-weight edge on the spine).
 */
describe('nbrBackbone', () => {
  it('traces the injection → UDE spine and excludes side branches', () => {
    const inj = makeEntity({ type: 'injection', title: 'Cut approvals' });
    const mid = makeEntity({ type: 'effect', title: 'Deploys speed up' });
    const ude = makeEntity({ type: 'ude', title: 'Bad changes ship faster' });
    const side = makeEntity({ type: 'effect', title: 'Fewer meetings' });
    const spineA = makeEdge(inj.id, mid.id);
    const spineB = makeEdge(mid.id, ude.id, { weight: 'negative' });
    const sideEdge = makeEdge(inj.id, side.id); // off the spine
    const doc = makeDoc([inj, mid, ude, side], [spineA, spineB, sideEdge], 'nbr');

    const bb = nbrBackbone(doc);
    expect(bb).not.toBeNull();
    expect(bb!.backboneEdgeIds.has(spineA.id)).toBe(true);
    expect(bb!.backboneEdgeIds.has(spineB.id)).toBe(true);
    expect(bb!.backboneEdgeIds.has(sideEdge.id)).toBe(false);
    expect(bb!.backboneEntityIds.has(side.id)).toBe(false);
    // Turning point = the negative edge on the spine.
    expect(bb!.turningPointEdgeId).toBe(spineB.id);
  });

  it('prefers the longest injection → UDE path', () => {
    const inj = makeEntity({ type: 'injection', title: 'Injection' });
    const a = makeEntity({ type: 'effect', title: 'A' });
    const b = makeEntity({ type: 'effect', title: 'B' });
    const ude = makeEntity({ type: 'ude', title: 'UDE' });
    // Short path inj→ude, long path inj→a→b→ude.
    const short = makeEdge(inj.id, ude.id);
    const long1 = makeEdge(inj.id, a.id);
    const long2 = makeEdge(a.id, b.id);
    const long3 = makeEdge(b.id, ude.id);
    const doc = makeDoc([inj, a, b, ude], [short, long1, long2, long3], 'nbr');

    const bb = nbrBackbone(doc)!;
    expect(bb.backboneEdgeIds.has(long1.id)).toBe(true);
    expect(bb.backboneEdgeIds.has(long2.id)).toBe(true);
    expect(bb.backboneEdgeIds.has(long3.id)).toBe(true);
    expect(bb.backboneEdgeIds.has(short.id)).toBe(false);
  });

  it('null turning point when the spine never turns negative', () => {
    const inj = makeEntity({ type: 'injection', title: 'Injection' });
    const ude = makeEntity({ type: 'ude', title: 'UDE' });
    const doc = makeDoc([inj, ude], [makeEdge(inj.id, ude.id)], 'nbr');
    expect(nbrBackbone(doc)!.turningPointEdgeId).toBeNull();
  });

  it('returns null off an NBR, with no injection, or with no UDE', () => {
    const inj = makeEntity({ type: 'injection', title: 'Injection' });
    const ude = makeEntity({ type: 'ude', title: 'UDE' });
    const edge = makeEdge(inj.id, ude.id);
    // Not an NBR.
    expect(nbrBackbone(makeDoc([inj, ude], [edge], 'frt'))).toBeNull();
    // NBR with no UDE.
    const eff = makeEntity({ type: 'effect', title: 'Effect' });
    expect(nbrBackbone(makeDoc([inj, eff], [makeEdge(inj.id, eff.id)], 'nbr'))).toBeNull();
  });
});
