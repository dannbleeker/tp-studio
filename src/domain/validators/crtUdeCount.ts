import { entitiesOfType } from '../graph';
import type { TPDocument } from '../types';
import { makeWarning, type UntieredWarning } from './shared';

/**
 * Session 179 (Theme B) — CRT UDE-count scope guard.
 *
 * Dettmer's heuristic: scope a CRT to roughly 3–10 UDEs (we allow up to 15
 * before nudging). Too few and a system-wide root cause isn't trustworthy; too
 * many and the tree's scope is probably too wide for one diagram. Fires only
 * once there's at least one UDE (an empty / brand-new CRT shouldn't nag).
 * Session 181 — targets the DOCUMENT (the count is a property of the diagram,
 * not of any one UDE); previously it anchored on the earliest UDE as a
 * stand-in, which re-keyed the warning whenever that UDE was deleted.
 */
const MIN_UDES = 3;
const MAX_UDES = 15;

export const crtUdeCountRule = (doc: TPDocument): UntieredWarning[] => {
  if (doc.diagramType !== 'crt') return [];
  const count = entitiesOfType(doc, 'ude').length;
  if (count === 0) return [];
  if (count < MIN_UDES) {
    return [
      makeWarning(
        doc,
        'crt-ude-count',
        { kind: 'document' },
        `This CRT has ${count} UDE${count === 1 ? '' : 's'} — with fewer than ${MIN_UDES}, a system-wide root cause is hard to trust. Add the other effects you're seeing.`
      ),
    ];
  }
  if (count > MAX_UDES) {
    return [
      makeWarning(
        doc,
        'crt-ude-count',
        { kind: 'document' },
        `This CRT has ${count} UDEs — more than ${MAX_UDES} usually means the scope is too wide for one tree; consider splitting it.`
      ),
    ];
  }
  return [];
};
