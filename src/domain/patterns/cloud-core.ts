import type { TPDocument } from '../types';
import { buildECPattern } from './ec-shared';

/**
 * Core Cloud — the recurring conflict sitting under many UDEs at once, at the
 * base of the CRT. The generic "produce now vs. protect the future" tension a
 * consolidation exercise tends to surface. Original illustrative content.
 */
export const buildPatternCloudCore = (): TPDocument =>
  buildECPattern({
    title: 'Core cloud — produce now vs. protect the future',
    cloudType: 'core',
    objective: 'Grow the organisation sustainably',
    need1: 'Maximise the results we get this period',
    need2: 'Protect the capacity we will need next period',
    want1: 'Push every resource to produce as much as possible now',
    want2: 'Hold resources back to invest, maintain, and recover',
  });
