import type { TPDocument } from '../types';
import { buildECPattern } from './ec-shared';

/**
 * Pattern: Life goals vs life's necessities (Evaporating Cloud).
 *
 * The "white-collar burnout" dilemma worked in the *TOC Handbook* (Ch. 38,
 * "TOC for Personal Productivity/Dilemmas", Cox & Schleier), abstracted: a
 * satisfying life needs both the pursuit of one's goals and the upkeep of
 * life's necessary conditions, and both draw on the same finite pool of time,
 * focus, and energy — so devoting that pool to one starves the other. A clean
 * teaching example of the goal-vs-necessary-condition distinction expressed as
 * a conflict, and of a cloud whose two wants are mutually exclusive only
 * because a shared resource is scarce. Assumptions follow the source's tabled
 * set, paraphrased. Node text is original.
 */
export const buildPatternECLifeGoalsVsNecessities = (): TPDocument =>
  buildECPattern({
    title: "Life goals vs life's necessities (burnout cloud)",
    objective: 'Have a satisfying life',
    need1: 'Make progress on my life goals',
    need2: "Keep my life's necessary conditions met",
    want1: 'Pour my time and energy into activities that advance my goals',
    want2: 'Pour my time and energy into activities that sustain my necessities',
    assumptions: [
      {
        arrow: 'b-a',
        text: 'Reaching for my goals is a large part of what makes life feel satisfying.',
      },
      {
        arrow: 'c-a',
        text: 'Neglect the necessary conditions of my life and the whole thing starts to fall apart.',
      },
      {
        arrow: 'd-b',
        text: 'Time, motivation, concentration, effort, and energy are all required to move a goal forward.',
      },
      {
        arrow: 'dPrime-c',
        text: 'Necessary conditions only need sustaining, not maximizing — but sustaining them still consumes the same time and energy.',
      },
    ],
  });
