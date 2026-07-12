import type { TPDocument } from '../types';
import { buildECPattern } from './ec-shared';

/**
 * Pattern: Survival vs conscience (Evaporating Cloud).
 *
 * A "cloud in literature" example from the *TOC Handbook* (Ch. 26, "TOC for
 * Education", Suerken) — young students mapped the internal conflict of a
 * classic novel's orphan boy pressured into pickpocketing: get money to survive
 * vs keep a clear conscience, both in service of simply surviving. The teaching
 * move the chapter highlights is surfacing the hidden assumption ("to get
 * money I must steal") and then brainstorming honest alternatives that meet the
 * same need — captured here as a note. Node text is original; no character
 * names or scene retelling.
 */
export const buildPatternECSurvivalVsConscience = (): TPDocument =>
  buildECPattern({
    title: 'Survival vs conscience (a literature cloud)',
    objective: 'Survive',
    need1: 'Get money to live on',
    need2: 'Keep a clear conscience — do nothing wrong',
    want1: 'Steal to get by',
    want2: 'Refuse to steal',
    assumptions: [
      {
        arrow: 'd-b',
        text: 'With no other way to earn, stealing looks like the only way to get money.',
      },
    ],
    notes: [
      {
        text: 'Break the assumption: honest work meets the same need — run errands, wash windows, take a job.',
        anchor: 'b',
        position: { x: 430, y: -70 },
      },
    ],
  });
