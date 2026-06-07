import { entitiesOfType } from '../graph';
import type { TPDocument } from '../types';
import { makeWarning, type UntieredWarning } from './shared';

/**
 * Session 179 (Theme B) — a UDE phrased as the absence of a solution.
 *
 * The most common CRT wording trap (Mabin / Fedurko): writing a UDE as "we lack
 * X" / "no Y" smuggles in the solution ("get X") instead of stating an
 * observable negative effect. We flag it as a gentle clarity nudge so the user
 * restates it as a concrete, present-tense fact.
 *
 * Heuristic, not NLP: a tight keyword scan scoped to CRT `ude` titles. Tuned to
 * keep false positives low — phrases like "missing deadlines" that legitimately
 * describe an effect are deliberately NOT matched (only solution-absence
 * phrasings are). It's a soft, resolvable hint, so the occasional miss is fine.
 */
const ABSENCE_PATTERN =
  /\b(lack of|lacks|lacking|absence of|not enough|insufficient|inadequate|haven'?t|hasn'?t|don'?t have|doesn'?t have)\b/i;
/** A leading "No …" ("No documented process") is a strong absence signal;
 *  the word boundary keeps "Nobody"/"Nothing" from matching. */
const LEADING_NO = /^\s*no\b/i;

export const crtUdeWordingRule = (doc: TPDocument): UntieredWarning[] => {
  if (doc.diagramType !== 'crt') return [];
  const out: UntieredWarning[] = [];
  for (const ude of entitiesOfType(doc, 'ude')) {
    if (ABSENCE_PATTERN.test(ude.title) || LEADING_NO.test(ude.title)) {
      out.push(
        makeWarning(
          doc,
          'crt-ude-wording',
          { kind: 'entity', id: ude.id },
          `UDE "${ude.title}" may describe the absence of a solution rather than an observable effect — try restating it as a concrete, present-tense fact.`
        )
      );
    }
  }
  return out;
};
