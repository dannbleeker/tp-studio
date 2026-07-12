import type { TPDocument } from '../types';
import { buildECPattern } from './ec-shared';

/**
 * Pattern: Tease for fun vs be respected (Evaporating Cloud).
 *
 * A playground name-calling conflict from the *TOC Handbook* (Ch. 26, "TOC for
 * Education", Suerken) — the schools' TOC-for-Education programme teaches
 * children to map a dispute as a cloud: one child teases to have fun, the other
 * needs to be respected, and both want to keep playing together. It ships with
 * the two sides' assumptions and the published injection (find fun that isn't
 * at the other's expense), so it doubles as a complete surface-and-break
 * example for a young or first-time audience. Node text is original; no names.
 */
export const buildPatternECTeaseVsRespect = (): TPDocument =>
  buildECPattern({
    title: 'Tease for fun vs be respected (playground cloud)',
    objective: 'Keep playing together happily',
    need1: 'Have fun',
    need2: 'Be respected',
    want1: 'Tease the other child by calling names',
    want2: 'Stop the name-calling',
    assumptions: [
      {
        arrow: 'd-b',
        text: "It's fun to see the reaction, and teasing feels like the only way to get a rise out of them.",
      },
      {
        arrow: 'dPrime-c',
        text: "Being called names is upsetting; you can't feel respected while it's happening.",
      },
    ],
    notes: [
      {
        text: 'Injection: invite the other child into the game instead — same fun, no one is the target.',
        anchor: 'a',
        position: { x: 60, y: 440 },
      },
    ],
  });
