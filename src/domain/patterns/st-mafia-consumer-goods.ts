import type { TPDocument } from '../types';
import { buildSTFacetDoc } from './st-shared';

/**
 * Pattern: Mafia Offer — Consumer Goods (Strategy & Tactics Tree, facet model).
 *
 * The Decisive-Competitive-Edge / un-refusable-offer family (Handbook Ch. 22,
 * Lang), abstracted with original wording and no company names. A consumer-goods
 * maker who sells through retailers wins the shelf by taking the retailer's two
 * standing fears — running out of a hot item and being stuck with a cold one —
 * off their books at once. Two-leaf offer tree on the corrected directional
 * model: the apex offer carries no necessary assumption; each leaf carries no
 * sufficiency assumption.
 */
export const buildPatternSTMafiaConsumerGoods = (): TPDocument =>
  buildSTFacetDoc('Mafia Offer — Consumer Goods S&T', {
    tactic:
      'Guarantee the retailer full availability with no overstock risk — you keep the shelf full and take back what does not sell',
    strategy:
      'Retailers prefer our line because stocking it carries none of the usual inventory risk',
    parallel:
      'Retailers decide on shelf risk, not just margin — an offer that removes both stockout and overstock is the one they cannot refuse',
    sufficiency:
      'The promise is only credible if we can both keep the shelf full AND absorb the returns — hence the two sub-steps',
    children: [
      {
        tactic: 'Replenish each store to its actual daily sell-through from regional stock',
        strategy: 'Every store stays in stock on fast movers without holding weeks of cover',
        necessary:
          'A promise of full availability we cannot keep destroys the trust the whole offer rests on',
        parallel:
          'Consumption-driven pull from a regional buffer beats forecasting each store — aggregation covers the surprises cheaply',
      },
      {
        tactic: 'Take slow and end-of-season stock back on consignment terms, not on the retailer',
        strategy: 'The retailer never carries the loss on a product that fails to sell',
        necessary:
          'If the retailer still eats the overstock, "no risk" is a slogan and the offer collapses on the first dud',
        parallel:
          'Absorbing returns is cheaper for us than for them — we can redeploy or remanufacture stock a single store cannot',
      },
    ],
  });
