import type { TPDocument } from '../types';
import { buildSTFacetDoc } from './st-shared';

/**
 * Pattern: Vendor-Managed Inventory (Strategy & Tactics Tree, facet model).
 *
 * A second "Decisive Competitive Edge" S&T from Lang's template family (Handbook
 * Ch. 22) — abstracted, original wording. The bet: taking the stockout-vs-
 * overstock risk off the customer's shelf is worth more to them than a lower unit
 * price. Built on the corrected directional-facet model (backlog B): apex carries
 * strategy + parallel + sufficiency (no necessary); the two leaf sub-steps carry
 * strategy + necessary + parallel.
 */
export const buildPatternSTVendorManagedInventory = (): TPDocument =>
  buildSTFacetDoc('Vendor-Managed Inventory S&T', {
    tactic:
      "Take over the customer's stock — replenish to their actual consumption and bill on usage",
    strategy: 'We become the shelf the customer never has to think about',
    parallel:
      "Removing the buyer's stockout-vs-overstock risk is worth more to them than a lower unit price",
    sufficiency:
      'It only works if we can see consumption AND replenish fast — hence the two sub-steps',
    children: [
      {
        tactic:
          "Instrument the customer's usage so we replenish from real draw, not their forecast",
        strategy: "We reorder from what's consumed, before the customer notices a gap",
        necessary: "Without live consumption data we're guessing, and the shelf goes empty",
        parallel:
          "Reading real draw beats trusting the customer's forecast — the forecast is what failed them",
      },
      {
        tactic: 'Hold stock centrally and ship frequent small replenishments',
        strategy: 'High availability at the customer with low total inventory in the chain',
        necessary: 'Large infrequent drops re-create the overstock the offer is meant to remove',
        parallel:
          'Central pooling with fast small shipments protects availability at less inventory than local stockpiles',
      },
    ],
  });
