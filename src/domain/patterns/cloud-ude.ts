import type { TPDocument } from '../types';
import { buildECPattern } from './ec-shared';

/**
 * UDE Cloud — the conflict hiding behind a single Undesirable Effect (here,
 * "we keep missing delivery dates"). Cohen's first escalation step in the cloud
 * progression: name the dilemma under one symptom before consolidating across
 * many. Original illustrative content (no canonical-source titles).
 */
export const buildPatternCloudUDE = (): TPDocument =>
  buildECPattern({
    title: 'UDE cloud — missed delivery dates',
    cloudType: 'ude',
    objective: 'Run a delivery operation customers can rely on',
    need1: 'Keep the promises we make to customers',
    need2: 'Avoid overloading the floor beyond what it can finish',
    want1: 'Promise the date the customer asks for',
    want2: 'Promise only dates the floor can realistically hit',
  });
