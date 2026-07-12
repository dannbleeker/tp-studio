import type { TPDocument } from '../types';
import { buildSTFacetDoc } from './st-shared';

/**
 * Pattern: Reliable Rapid Response (Strategy & Tactics Tree, facet model).
 *
 * A "Decisive Competitive Edge" S&T after Lang's un-refusable-offer family
 * (Handbook Ch. 22) — abstracted, original wording. The strategic bet: for buyers
 * where a delivery miss is expensive, an ironclad delivery guarantee out-sells a
 * lower unit price. Built on the corrected directional-facet model (backlog B):
 * the apex carries strategy + parallel + sufficiency (no necessary — nothing sits
 * above it); the two leaf sub-steps carry strategy + necessary + parallel.
 */
export const buildPatternSTReliableRapidResponse = (): TPDocument =>
  buildSTFacetDoc('Reliable Rapid Response S&T', {
    tactic: "Sell a delivery guarantee — hit the customer's window or the order is on us",
    strategy: 'We are the supplier chosen whenever on-time delivery cannot be missed',
    parallel:
      'For these buyers a late delivery costs more than our premium, so reliability out-sells price',
    sufficiency:
      'The guarantee only holds if operations create slack AND sales lead with it — hence the two sub-steps',
    children: [
      {
        tactic: 'Compress internal lead time so every promise ships with buffer',
        strategy: 'Orders leave with time to spare against the promised date',
        necessary: 'Without buffer, a single upstream delay breaks the guarantee we sell',
        parallel: 'Cutting lead time beats padding the promise — padded dates lose the deals',
      },
      {
        tactic: 'Price the guarantee into the offer and coach sales to lead with reliability',
        strategy: 'Sales presents reliability as the reason to switch, at a premium',
        necessary: 'If reps open on price, the reliability edge is invisible and unpaid-for',
        parallel: 'Leading with the guarantee reframes the decision better than discounting does',
      },
    ],
  });
