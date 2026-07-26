import { structuralEntities } from '../graph';
import type { TPDocument } from '../types';
import { makeWarning, type UntieredWarning } from './shared';

/**
 * Session 199 (backlog A1) — the "not a complete statement" half of the
 * entity-existence reservation (Scheinkopf, Handbook App. B Fig 25-B2). A cause
 * or effect on a causal / necessity tree should read as a full statement of what
 * is happening ("Backlog grows"), not a bare label ("Backlog"). A single-word
 * title is the sharpest, lowest-false-positive fragment signal, so that's all we
 * flag — a soft, dismissible clarity nudge.
 *
 * Deliberately NOT registered as a blanket structural rule: it self-excludes the
 * diagram types whose entities are legitimately terse — an Evaporating Cloud box
 * ("Survive"), a Strategy & Tactics label, and Freeform (no TOC grammar). It
 * stays on the causal / necessity trees (CRT, FRT, NBR, PRT, TT, Goal Tree)
 * where a one-word node almost always means an unfinished statement.
 *
 * Exemptions mirror entity-existence: `note` entities never join the causal
 * grammar, `unspecified` placeholders exist deliberately, and an empty title is
 * entity-existence's job, not this rule's.
 */
const TERSE_BY_DESIGN = new Set(['ec', 'st', 'freeform']);

export const entityFragmentRule = (doc: TPDocument): UntieredWarning[] => {
  if (TERSE_BY_DESIGN.has(doc.diagramType)) return [];
  const out: UntieredWarning[] = [];
  for (const e of structuralEntities(doc)) {
    if (e.unspecified === true) continue;
    const title = e.title.trim();
    // Empty is entity-existence's reservation; only a single non-empty token
    // (no internal whitespace) reads as a fragment here.
    if (title === '' || /\s/.test(title)) continue;
    out.push(
      makeWarning(doc, 'entity-fragment', { kind: 'entity', id: e.id }, 'entity-fragment', {
        title,
      })
    );
  }
  return out;
};
