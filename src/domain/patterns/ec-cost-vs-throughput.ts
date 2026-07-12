import type { TPDocument } from '../types';
import { buildECPattern } from './ec-shared';

/**
 * Pattern: Cost world vs throughput world (Evaporating Cloud).
 *
 * The foundational TOC cloud — the "idle worker" conflict from Goldratt's
 * *The Goal*. To run a profitable operation a plant must both drive down unit
 * cost (which pushes toward keeping every resource busy) and protect flow /
 * throughput (which means letting non-constraints sit idle and subordinate to
 * the drum). Assumption to break: that a resource not producing is waste —
 * i.e. that local efficiency equals global efficiency. Injection: manage to
 * throughput; idle time at a non-constraint is free.
 *
 * Session 196 — enriched with the erroneous assumption and injection Barnard
 * names for this exact conflict in the *TOC Handbook* (Ch. 15, "Continuous
 * Improvement and Auditing"): the belief that "an idle resource is a major
 * waste" (tagged challengeable — it is what the injection breaks), and the
 * Drum-Buffer-Rope + buffer-management injection that releases work to the
 * constraint's drumbeat. Node text is original.
 */
export const buildPatternECCostVsThroughput = (): TPDocument =>
  buildECPattern({
    title: 'Cost world vs throughput world Evaporating Cloud',
    objective: 'Run a profitable operation',
    need1: 'Achieve high local efficiency and low unit cost',
    need2: 'Maximise throughput and protect flow',
    want1: 'Keep every resource busy',
    want2: 'Let non-constraints sit idle and subordinate to the constraint',
    assumptions: [
      {
        arrow: 'd-b',
        text: "An idle resource is a major waste — every hour a resource isn't producing is money lost.",
        status: 'challengeable',
      },
    ],
    notes: [
      {
        text: 'Injection: Drum-Buffer-Rope + buffer management — release work to the constraint’s drumbeat; idle time at a non-constraint is free.',
        anchor: 'a',
        position: { x: 60, y: 440 },
      },
    ],
  });
