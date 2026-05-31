import type { TPDocument } from '../types';
import { buildECPattern } from './ec-shared';

/**
 * Pattern: Back the transformation vs protect this quarter (Evaporating Cloud).
 *
 * The short-term-security-vs-long-term-growth instance of Efrat's generic change
 * cloud, at the org / portfolio level: leadership needs to hit this quarter's
 * numbers AND needs to build the capability the future depends on — and the two
 * compete for the same scarce resources. The classic reason a sound
 * transformation keeps getting deferred "until after this quarter".
 */
export const buildPatternECTransformationVsQuarter = (): TPDocument =>
  buildECPattern({
    title: 'Transformation vs this quarter Evaporating Cloud',
    objective: 'The business is strong this year and next',
    need1: "Hit this quarter's numbers",
    need2: 'Build the capability the future needs',
    want1: "Pour every resource into this quarter's results",
    want2: 'Divert resources into the transformation now',
  });
