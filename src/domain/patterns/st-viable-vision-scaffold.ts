import type { TPDocument } from '../types';
import { buildSTFacetDoc } from './st-shared';

/**
 * Pattern: Viable Vision — Build / Capitalize / Sustain scaffold (Strategy &
 * Tactics Tree, facet model).
 *
 * The generic three-phase Viable-Vision skeleton from Ferguson's templates
 * (Handbook Ch. 34; Ch. 18) — abstracted, original wording. A reusable starting
 * shape: reach an ambitious financial vision on existing resources by first
 * building the capability, then capitalising on it in the market, then sustaining
 * the edge. Built on the corrected directional-facet model (backlog B): the apex
 * carries strategy + parallel + sufficiency (no necessary); the three leaf phases
 * carry strategy + necessary + parallel.
 */
export const buildPatternSTViableVisionScaffold = (): TPDocument =>
  buildSTFacetDoc('Viable Vision — Build / Capitalize / Sustain', {
    tactic: "Turn today's operational edge into a decisive market position within the horizon",
    strategy: 'The organisation reaches its ambitious financial vision on its existing resources',
    parallel:
      'The vision is reachable without new capacity — the constraint is how we use what we have, not how much we have',
    sufficiency:
      'Reaching it needs three phases in order — build the capability, capitalise on it, then sustain it — hence the three sub-steps',
    children: [
      {
        tactic: "Build the internal capability that removes the customers' biggest limitation",
        strategy: "Operations can reliably deliver the thing the market can't get elsewhere",
        necessary: "Without the capability in place first, a promise we can't keep destroys trust",
        parallel: 'Building the capability before selling it beats selling first and scrambling',
      },
      {
        tactic: "Convert the capability into an offer the market can't refuse and sell it hard",
        strategy: 'The capability shows up as decisive, growing sales',
        necessary: 'A capability the market never feels is invisible — it has to become an offer',
        parallel:
          'Packaging the edge into a distinctive offer beats competing on everyone else’s terms',
      },
      {
        tactic: 'Protect the edge — keep widening it and lock in the ways it compounds',
        strategy: 'The advantage grows over time instead of being copied away',
        necessary: 'An edge that stands still is copied; without renewal the gain erodes',
        parallel: 'Continuously widening the edge beats defending a fixed one',
      },
    ],
  });
