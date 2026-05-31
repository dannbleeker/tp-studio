import type { TPDocument } from '../types';
import { buildECPattern } from './ec-shared';

/**
 * Pattern: Centralize vs federate (Evaporating Cloud).
 *
 * An org-design EC for the perennial conflict between a central team that owns a
 * shared capability and the operating teams that want autonomy over it (here a
 * design system). The Wants are concrete structural decisions, not abstract
 * principles — Scheinkopf's point that the EC stops being useful once the Wants
 * drift to "be more agile" / "have better governance".
 */
export const buildPatternECCentralizeVsFederate = (): TPDocument =>
  buildECPattern({
    title: 'Centralize vs federate the design system EC',
    objective: 'Run the company with a healthy, well-supported design system',
    need1: 'Keep design coherence across the product surface',
    need2: 'Let product teams move at their own pace on UI changes',
    want1: 'Form a central design-system team that owns the library',
    want2: 'Embed a design-system maintainer inside each product team',
  });
