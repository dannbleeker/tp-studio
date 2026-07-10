import type { TPDocument } from '../types';
import { buildECPattern } from './ec-shared';

/**
 * Pattern: Forecast vs react — fashion supply (Evaporating Cloud).
 *
 * The apparel conflict from Goldratt's *The Choice* (2008): cheap early
 * commitment to long-lead capacity serves cost, producing to real in-season
 * demand serves availability, and both serve one profitable season. The cloud
 * breaks on the assumption that lead times are fixed — shorten the loop for
 * part of the volume and both needs hold. Node text is original.
 */
export const buildPatternECForecastVsReact = (): TPDocument =>
  buildECPattern({
    title: 'Forecast-vs-react fashion cloud',
    objective: 'A fashion business that earns good margins season after season',
    need1: 'Unit costs stay competitive',
    need2: 'Shelf stock matches what shoppers actually buy',
    want1: 'Commit full volume early to long-lead, low-cost capacity',
    want2: 'Hold volume back and produce to in-season demand',
    notes: [
      // Breaking assumption hangs off C (availability).
      {
        text: 'Attack the assumption that lead times are a given — a faster loop for even part of the volume lets both needs hold, and the cloud evaporates.',
        anchor: 'c',
        position: { x: 380, y: 560 },
      },
    ],
  });
