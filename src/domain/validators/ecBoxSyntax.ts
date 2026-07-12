import type { TPDocument } from '../types';
import { makeWarning, type UntieredWarning } from './shared';

/**
 * Session 198 (backlog D3) — Evaporating Cloud box-syntax lint.
 *
 * Cohen's syntax guidelines (Handbook Ch. 24) require that each cloud box be a
 * clean statement, NOT a cause-and-effect sentence: "Entities do not contain
 * causality statements. Causality statements include words like *if, because,
 * sure to, in order to*." The reasoning belongs on the arrows (as assumptions),
 * not inside a box. We flag a box whose title carries one of those causal
 * connectors as a gentle clarity nudge.
 *
 * Heuristic, not NLP: a tight keyword scan scoped to the five EC slot entities
 * (`entity.ecSlot` set). Soft + resolvable, so the occasional miss is fine.
 * (The complementary "D/D′ are actions, B/C are positive needs" and the
 * diagonal-jeopardy checks are human judgments — they live in the EC method
 * checklist rather than as automated rules.)
 */
const CAUSAL_PATTERN = /\b(if|because|therefore|in order to|sure to)\b/i;

export const ecBoxCausalWordsRule = (doc: TPDocument): UntieredWarning[] => {
  if (doc.diagramType !== 'ec') return [];
  const out: UntieredWarning[] = [];
  for (const entity of Object.values(doc.entities)) {
    if (!entity.ecSlot) continue;
    if (CAUSAL_PATTERN.test(entity.title)) {
      out.push(
        makeWarning(
          doc,
          'ec-box-causal-words',
          { kind: 'entity', id: entity.id },
          `EC box "${entity.title}" reads as a cause-and-effect sentence (if / because / in order to …) — a cloud box should be a clean statement. Move the reasoning onto the arrow as an assumption.`
        )
      );
    }
  }
  return out;
};
