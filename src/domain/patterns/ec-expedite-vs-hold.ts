import type { TPDocument } from '../types';
import { buildECPattern } from './ec-shared';

/**
 * Pattern: Expedite now vs hold the setup (Evaporating Cloud).
 *
 * The canonical day-to-day shop-floor conflict Cohen uses to teach the
 * Day-to-Day Conflict Cloud in the *TOC Handbook* (Ch. 24, "Daily Management
 * with TOC"), drawn from the opening scene of Goldratt's *The Goal* (1984) and
 * abstracted to any plant floor: a manager wants the line reset to expedite one
 * important customer's rush order right now, while the operator wants to hold
 * the current setup and finish the planned run. Both are trying to keep the
 * same plant profitable. It is the archetypal "me vs the other side" cloud —
 * an open, one-off conflict where each side is defending a legitimate need.
 * Node text is original; no scene retelling, no character names.
 */
export const buildPatternECExpediteVsHold = (): TPDocument =>
  buildECPattern({
    title: 'Expedite now vs hold the setup (plant-floor cloud)',
    objective: 'Run a profitable plant now and in the future',
    need1: 'Secure the business of an important customer',
    need2: 'Be recognized for keeping every order flowing',
    want1: 'Break into the schedule and reset the line for the rush order now',
    want2: 'Hold the current setup and finish the planned run',
    assumptions: [
      {
        arrow: 'd-b',
        text: 'Resetting the line now is the only way to get the rush order out in time for the important customer.',
      },
      {
        arrow: 'dPrime-c',
        text: 'Breaking into the schedule to expedite wrecks the flow the operator is judged on.',
      },
      {
        arrow: 'b-a',
        text: "Keeping a marquee customer is worth more to the plant than any single run's efficiency.",
      },
      {
        arrow: 'c-a',
        text: 'A plant runs profitably only when its people are trusted to keep the whole order book moving.',
      },
    ],
  });
