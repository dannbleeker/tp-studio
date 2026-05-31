import type { TPDocument } from '../types';
import { buildECPattern } from './ec-shared';

/**
 * Pattern: Profit — spend vs save (Evaporating Cloud).
 *
 * The simplest teaching cloud. To increase profit a business must both grow
 * value (improve the product, which means spending) and reduce cost (cut
 * expenses). The everyday tension every budget round re-enacts — and a clean
 * first cloud for someone learning to read the necessity logic, because both
 * needs are obviously legitimate and the conflict is purely over the action.
 */
export const buildPatternECProfitSpendVsSave = (): TPDocument =>
  buildECPattern({
    title: 'Profit: spend vs save Evaporating Cloud',
    objective: 'Increase profit',
    need1: 'Grow value',
    need2: 'Reduce cost',
    want1: 'Improve the product, which means spending',
    want2: 'Cut expenses',
  });
