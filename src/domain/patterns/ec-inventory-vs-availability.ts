import type { TPDocument } from '../types';
import { buildECPattern } from './ec-shared';

/**
 * Pattern: Inventory vs availability (Evaporating Cloud).
 *
 * The distribution / retail cloud — the closest TOC archetype to a
 * fashion-retail operation. A profitable retailer must both protect sales
 * (never lose one to a stockout, which pushes stock toward the point of sale)
 * and protect cash and margin (avoid markdowns and obsolescence, which pushes
 * stock down). Assumption to break: that store/SKU-level forecasts are reliable
 * enough to justify pushing stock forward. Injection: hold at an aggregation
 * point and replenish frequently against actual consumption (pull), sizing
 * buffers dynamically.
 */
export const buildPatternECInventoryVsAvailability = (): TPDocument =>
  buildECPattern({
    title: 'Inventory vs availability Evaporating Cloud',
    objective: 'Run a profitable retail and distribution operation',
    need1: 'Protect sales and never lose a sale to a stockout',
    need2: 'Protect cash and margin and avoid markdowns',
    want1: 'Hold high stock at the point of sale',
    want2: 'Hold low stock at the point of sale',
  });
