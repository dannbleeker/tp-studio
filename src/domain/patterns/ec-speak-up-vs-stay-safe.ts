import type { TPDocument } from '../types';
import { buildECPattern } from './ec-shared';

/**
 * Pattern: Speak up vs stay safe (Evaporating Cloud).
 *
 * The identity-protection instance of Efrat's generic change cloud: a person on
 * a team needs to protect their own standing AND wants the team to fix the real
 * problems — the first pulls toward keeping quiet, the second toward naming the
 * hard issues. The everyday face of "resistance to change", surfacing wherever
 * psychological safety is thin.
 *
 * Session 196 — enriched with the explicit assumptions and injection from the
 * closely-matching athlete/coach communication dilemma worked in the *TOC
 * Handbook* (Ch. 38, "TOC for Personal Productivity/Dilemmas", Cox & Schleier),
 * paraphrased: staying quiet reads as respect (the D→B assumption), and the
 * injection is to build a relationship open enough that raising concerns reads
 * as commitment rather than disrespect. Node text is original.
 */
export const buildPatternECSpeakUpVsStaySafe = (): TPDocument =>
  buildECPattern({
    title: 'Speak up vs stay safe Evaporating Cloud',
    objective: 'The team does its best work and I belong in it',
    need1: 'Protect my standing on the team',
    need2: 'Get the real problems on the table',
    want1: 'Keep quiet about the hard issues',
    want2: 'Name the hard issues openly',
    assumptions: [
      {
        arrow: 'd-b',
        text: 'Staying quiet reads as respect and keeps me in good standing.',
      },
      {
        arrow: 'dPrime-c',
        text: 'Speaking up will actually change how the work gets done — it won’t just be noted and ignored.',
      },
    ],
    notes: [
      {
        text: 'Injection: build a relationship open enough that raising concerns reads as commitment, not disrespect.',
        anchor: 'a',
        position: { x: 60, y: 440 },
      },
    ],
  });
