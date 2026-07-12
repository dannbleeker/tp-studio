import type { TPDocument } from '../types';
import { buildSTFacetDoc } from './st-shared';

/**
 * Pattern: Gain-Sharing offer (Strategy & Tactics Tree, facet model).
 *
 * A "Decisive Competitive Edge" S&T from Lang's un-refusable-offer family
 * (Handbook Ch. 22) — abstracted, original wording. The bet: pricing on the
 * customer's realised gain (a share of the value created, not a fixed fee) wins
 * the buyers who doubt your claims — you put your own fee at risk. Built on the
 * corrected directional-facet model (backlog B): apex carries strategy + parallel
 * + sufficiency (no necessary); the two leaf sub-steps carry strategy + necessary
 * + parallel.
 */
export const buildPatternSTGainSharing = (): TPDocument =>
  buildSTFacetDoc('Gain-Sharing offer S&T', {
    tactic: 'Price on the realised gain — take a share of the value we create, not a fixed fee',
    strategy: 'We are paid in proportion to the results we actually produce',
    parallel:
      'Buyers who doubt our claims accept a shared-gain deal where a fixed fee would stall — we put our fee at risk',
    sufficiency:
      'Gain-sharing only holds if the gain is jointly measurable AND we can influence it — hence the two sub-steps',
    children: [
      {
        tactic: 'Agree a baseline and a measurement the customer trusts before go-live',
        strategy: 'Both sides accept, in advance, how the gain will be counted',
        necessary:
          'Without an agreed baseline, every gain claim becomes an argument and the fee never lands',
        parallel:
          'Agreeing the yardstick up front beats claiming credit after — after-the-fact attribution always disputes',
      },
      {
        tactic: 'Take on the levers that actually move the gain, not just advice',
        strategy: 'We control enough of the outcome to be accountable for the share we take',
        necessary: "If we can't move the number, a share of it is a bet we don't control",
        parallel:
          "Owning the levers beats advising from the side — you can't share a gain you can't influence",
      },
    ],
  });
