import type { TPDocument } from '../types';
import { buildECPattern } from './ec-shared';

/**
 * Pattern: Quality vs speed (Evaporating Cloud).
 *
 * The teaching-classic engineering tradeoff — "do we ship the feature this
 * sprint or hold for a QA gate?" — as the canonical 5-box EC. Wants are concrete
 * actions a person could actually decide on, which is when the assumption hunt
 * on the "must we…?" edges pays off.
 */
export const buildPatternECQualityVsSpeed = (): TPDocument =>
  buildECPattern({
    title: 'Quality vs speed Evaporating Cloud',
    objective: 'Ship features customers love',
    need1: 'Maintain a stable, reliable product',
    need2: 'Ship at pace ahead of competitors',
    want1: 'Add a 1-week QA gate to every release',
    want2: 'Release on a continuous-delivery cadence',
  });
