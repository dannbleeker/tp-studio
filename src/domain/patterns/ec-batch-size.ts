import type { TPDocument } from '../types';
import { buildECPattern } from './ec-shared';

/**
 * Pattern: Batch size — Economic Batch Quantity (Evaporating Cloud).
 *
 * The classic operations cloud. To cut cost per unit you must both reduce
 * setup cost per unit (amortise the changeover over a large batch) and reduce
 * carrying cost per unit (run small batches). Assumption to break (need →
 * large batch): that setup cost is fixed, so it must be amortised over a large
 * batch. Injection: collapse setup time with quick-changeover so small batches
 * no longer carry a high setup penalty, and the conflict evaporates.
 */
export const buildPatternECBatchSize = (): TPDocument =>
  buildECPattern({
    title: 'Batch size Evaporating Cloud',
    objective: 'Reduce cost per unit',
    need1: 'Reduce setup cost per unit',
    need2: 'Reduce carrying cost per unit',
    want1: 'Run large batches',
    want2: 'Run small batches',
  });
