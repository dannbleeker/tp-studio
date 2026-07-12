import type { TPDocument } from '../types';
import { buildSTFacetDoc } from './st-shared';

/**
 * Pattern: Pay-Per-Use offer (Strategy & Tactics Tree, facet model).
 *
 * A "Decisive Competitive Edge" S&T from Lang's un-refusable-offer family
 * (Handbook Ch. 22) — abstracted, original wording. The bet: replacing a large
 * fixed licence with consumption-based pricing removes the capital risk that
 * blocks buyers who can't commit to an unproven fit. Built on the corrected
 * directional-facet model (backlog B): apex carries strategy + parallel +
 * sufficiency (no necessary); the two leaf sub-steps carry strategy + necessary
 * + parallel.
 */
export const buildPatternSTPayPerUse = (): TPDocument =>
  buildSTFacetDoc('Pay-Per-Use offer S&T', {
    tactic:
      'Replace the upfront licence with pay-per-use — the customer pays only for what they consume',
    strategy: "We win the buyers who can't commit to a big fixed spend",
    parallel:
      'For these buyers the capital risk on an unproven fit blocks the deal more than the per-unit price does',
    sufficiency:
      'Pay-per-use only works if we can meter usage AND absorb the cash-timing gap — hence the two sub-steps',
    children: [
      {
        tactic: 'Meter consumption accurately and bill it automatically',
        strategy: 'Every unit of value delivered is measured and invoiced without dispute',
        necessary:
          'Without trustworthy metering, pay-per-use invites billing disputes that sink the account',
        parallel:
          'Automated metering beats manual reconciliation — disputes, not price, are what churn usage deals',
      },
      {
        tactic: "Fund the working-capital gap between our costs and the customer's usage ramp",
        strategy: 'We stay cash-positive while customers scale their usage',
        necessary:
          'Costs land before usage revenue ramps; without funding the gap, growth starves cash',
        parallel:
          "Pre-funding the ramp beats capping usage — a usage cap defeats the offer's whole appeal",
      },
    ],
  });
