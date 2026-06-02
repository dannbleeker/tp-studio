import type { TPDocument } from '../types';
import { buildECPattern } from './ec-shared';

/**
 * Pattern: Resistance to change — Efrat's cloud (Evaporating Cloud).
 *
 * The universal "why we both want change and fear it" conflict, after Efrat
 * Goldratt-Ashlag's 1995 model (*Embracing Change vs. Resistance to Change*).
 * Being happy at work rests on two different needs: satisfaction — a sense of
 * achievement, which only comes from taking on something new — and security,
 * which she redefines as confidence in the reliability of one's own predictions.
 * Satisfaction pulls you to embrace the change; security pulls you to resist it,
 * and the same person feels both at once. The most-reached-for cloud in buy-in
 * and facilitation work: it locates the two injections (protect prediction
 * reliability; give an owning role in the change) by naming the need each side
 * is defending. D (embrace) serves B (satisfaction); D′ (resist) serves C
 * (security) — the same wiring `buildECPattern` applies to every cloud.
 *
 * The two breaking channels ship as non-causal **notes** pinned to the need
 * each one protects — dotted on the canvas and excluded from the CLR rules, so
 * they read as facilitation hints, not cloud structure. (Injections proper
 * aren't EC-canvas citizens — they emerge from scrutiny and develop across
 * linked docs via the Injection Flower; a note is the right primitive here.)
 */
export const buildPatternECEfratsChangeCloud = (): TPDocument =>
  buildECPattern({
    title: "Resistance to change (Efrat's cloud)",
    objective: 'Be happy and engaged at work',
    need1: 'Get satisfaction — a sense of achievement',
    need2: 'Feel secure — trust that my predictions hold',
    want1: 'Embrace the change',
    want2: 'Resist the change',
    notes: [
      // Channel 1 hangs off C (security); Channel 2 hangs off B (satisfaction).
      {
        text: 'Channel 1 — protect security: supply the information + training people need to forecast through the change.',
        anchor: 'c',
        position: { x: 380, y: 560 },
      },
      {
        text: 'Channel 2 — offer satisfaction: give an owning role in the change so it becomes an achievement.',
        anchor: 'b',
        position: { x: 380, y: -90 },
      },
    ],
  });
