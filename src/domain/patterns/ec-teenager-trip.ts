import type { TPDocument } from '../types';
import { buildECPattern } from './ec-shared';

/**
 * Pattern: Parent vs teenager — the everyday cloud (Evaporating Cloud).
 *
 * *It's Not Luck* (1994) repeatedly takes the Evaporating Cloud home: the
 * same five boxes that settle boardroom conflicts settle a teenager's trip.
 * Independence and safety both serve one family objective, so neither side
 * is wrong — and the cloud breaks on the assumptions under the safety arrow
 * (what would make it safe enough?), not by winning the argument. Node text
 * is original; the family scenario is generic, not a scene from the novel.
 */
export const buildPatternECTeenagerTrip = (): TPDocument =>
  buildECPattern({
    title: 'Parent-vs-teenager everyday cloud',
    objective: 'A family that trusts each other and grows capable kids',
    need1: 'The teenager gains real independence and responsibility',
    need2: 'The parents stay confident their child is safe',
    want1: 'Say yes to the unsupervised trip',
    want2: "Say no until they're older",
    notes: [
      // The breaking hint hangs off C (safety) — the C→D' arrow is where
      // most family clouds evaporate.
      {
        text: "Scrutinise the C→D' arrow: what would make the trip safe enough — a route plan, check-ins, a budget, a backup? Most family clouds evaporate there.",
        anchor: 'c',
        position: { x: 380, y: 560 },
      },
    ],
  });
