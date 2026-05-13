import { CLARITY_WORD_LIMIT } from '../constants';
import { isNote } from '../graph';
import type { TPDocument } from '../types';
import { type UntieredWarning, countWords, makeWarning } from './shared';

/**
 * Clarity CLR rule — flags titles that violate "one short declarative
 * statement per entity":
 *
 *   - Titles longer than 25 words (`CLARITY_WORD_LIMIT`) are too verbose
 *     to read at a glance; tighten them.
 *   - Titles ending in `?` are questions rather than statements; rephrase
 *     to a declarative.
 *
 * FL-ET7: `note` entities are deliberately prose (sticky-note text often
 * runs multiple sentences and may end on a question) so they skip both
 * checks. Assumptions stay in scope — they really should be one tight
 * declarative statement, the same as any causal entity.
 */
export const clarityRule = (doc: TPDocument): UntieredWarning[] => {
  const out: UntieredWarning[] = [];
  for (const e of Object.values(doc.entities)) {
    if (isNote(e)) continue;
    if (countWords(e.title) > CLARITY_WORD_LIMIT) {
      out.push(
        makeWarning(
          doc,
          'clarity',
          { kind: 'entity', id: e.id },
          'Title is over 25 words — tighten to one statement.'
        )
      );
    } else if (e.title.trim().endsWith('?')) {
      out.push(
        makeWarning(
          doc,
          'clarity',
          { kind: 'entity', id: e.id },
          'Statements should be declarative, not questions.'
        )
      );
    }
  }
  return out;
};
