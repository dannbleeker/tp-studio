import type { TPDocument } from '../types';
import { buildECPattern } from './ec-shared';

/**
 * Pattern: Build vs buy (Evaporating Cloud).
 *
 * The teaching-classic procurement EC — build a capability in-house vs adopt a
 * vendor — exposing the two underlying needs (control over how the data flows,
 * and speed to a working solution) and the conflict between the Wants each Need
 * pulls toward. Both camps routinely pretend their Want satisfies both Needs;
 * the EC makes that handwaving visible.
 */
export const buildPatternECBuildVsBuy = (): TPDocument =>
  buildECPattern({
    title: 'Build vs buy customer data platform EC',
    objective: 'Have a working customer data platform inside six months',
    need1: 'Keep tight control of how customer data is modelled and flows',
    need2: 'Free engineering to ship customer-facing features in parallel',
    want1: 'Build the customer data platform in-house',
    want2: 'Adopt a vendor customer data platform with our existing connectors',
  });
