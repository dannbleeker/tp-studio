import type { TPDocument } from '../types';
import { buildECPattern } from './ec-shared';

/**
 * Pattern: Alcohol policy (Evaporating Cloud).
 *
 * The policy conflict from Mabin & Cavana's New Zealand supermarket-alcohol
 * case study (System Dynamics Review 40(4), 2024), paraphrased: harm
 * reduction pulls toward a supermarket ban while retail viability pulls
 * against it, both serving national wellbeing. The paper's injection — move
 * the sales to a separate store the retailer may run nearby — rides as a
 * note on D. Node text is an original paraphrase.
 */
export const buildPatternECAlcoholPolicy = (): TPDocument =>
  buildECPattern({
    title: 'Alcohol-policy cloud',
    objective: "Lift the nation's overall wellbeing, now and long-term",
    need1: 'Cut the harm alcohol causes across society',
    need2: 'Keep the grocery retailers economically healthy',
    want1: 'Remove alcohol from supermarket shelves',
    want2: 'Keep letting supermarkets sell alcohol',
    notes: [
      // The case's published injection hangs off D (the ban side).
      {
        text: "The case's published injection: take alcohol out of the aisles but let the retailer run a separate store nearby — harm reduction is served and most of the revenue survives.",
        anchor: 'd',
        position: { x: 1150, y: -90 },
      },
    ],
  });
