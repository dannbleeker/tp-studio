import type { TPDocument } from '../types';
import { buildECPattern } from './ec-shared';

/**
 * Pattern: Pricing — discount vs hold (Evaporating Cloud).
 *
 * A commercial cloud. To win profitable business a seller must both win the
 * deal (which pulls toward dropping the price) and stay profitable (which pulls
 * toward holding it). Assumption to break: that price is the reason this deal
 * is won or lost. Injection: compete on quantified value and differentiated
 * terms so the discount lever stops being the only way to close.
 */
export const buildPatternECPricing = (): TPDocument =>
  buildECPattern({
    title: 'Pricing Evaporating Cloud',
    objective: 'Win profitable business',
    need1: 'Win the deal',
    need2: 'Stay profitable',
    want1: 'Drop the price',
    want2: 'Hold the price',
  });
