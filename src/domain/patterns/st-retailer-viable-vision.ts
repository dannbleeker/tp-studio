import type { TPDocument } from '../types';
import { buildSTFacetDoc } from './st-shared';

/**
 * Pattern: Retailer Viable Vision (3-level Strategy & Tactics Tree, facet model).
 *
 * A multi-level Viable-Vision tree after Ferguson's retail templates (Handbook
 * Ch. 34; Ch. 18) — abstracted, original wording. Reaches an ambitious retail
 * profit vision on the existing store base by fixing the availability-vs-inventory
 * flow. Three levels deep, so it shows a **middle step** carrying all four facets
 * (a necessary assumption up to the apex AND a sufficiency assumption down to its
 * own children) — the fullest illustration of the corrected directional model
 * (backlog B): the apex has no necessary assumption, leaves have no sufficiency
 * assumption, and the one intermediate step has both.
 */
export const buildPatternSTRetailerViableVision = (): TPDocument =>
  buildSTFacetDoc('Retailer Viable Vision S&T', {
    tactic:
      'Make the shelf never-empty and never-overstocked — reliable availability at low inventory',
    strategy: 'The retailer reaches its ambitious profit vision on its current stores and capital',
    parallel:
      "The retailer's constraint is availability-vs-inventory, not store count — fixing the flow beats opening more stores",
    sufficiency: 'It needs a replenishment engine AND aligned incentives — hence the two sub-steps',
    children: [
      {
        // Middle step — has a parent (apex) AND children, so it carries all four
        // facets: necessary (up) and sufficiency (down).
        tactic: 'Stand up central-warehouse pull replenishment to daily consumption',
        strategy:
          'Stock is held centrally and pulled to each store from what actually sold yesterday',
        necessary:
          'Forecast-pushed store stock is what creates the stockout-and-overstock the vision must remove',
        parallel:
          'Central holding with daily pull beats bigger store back-rooms — aggregation cuts the inventory the flow needs',
        sufficiency:
          'The engine alone isn’t enough — it has to be proven in one region and then rolled out — hence the two sub-steps',
        children: [
          {
            tactic: 'Pilot the pull engine in one region and tune the buffers to real demand',
            strategy: 'One region runs on daily pull with availability up and inventory down',
            necessary:
              'Rolling out an untuned engine chain-wide multiplies a hidden flaw across every store',
            parallel:
              'Proving it in one region first beats a big-bang rollout — you learn the buffer sizing cheaply',
          },
          {
            tactic: 'Roll the proven engine out region by region on the tuned buffers',
            strategy: 'Every region runs the same daily-pull replenishment',
            necessary:
              'A partial rollout leaves the old push system fighting the new pull one at the seams',
            parallel:
              'Region-by-region on proven buffers beats all-at-once — it keeps the risk bounded',
          },
        ],
      },
      {
        // Leaf step — has a parent, no children, so no sufficiency assumption.
        tactic:
          'Re-point store and regional bonuses to availability and inventory turns, not local sales pushes',
        strategy:
          'Store teams are rewarded for the flow the vision needs, not for local stock-piling',
        necessary:
          'If bonuses still reward local sales, managers over-order and the pull engine is fought on the floor',
        parallel:
          'Re-pointing the measures beats mandating behaviour — people follow the bonus, not the memo',
      },
    ],
  });
