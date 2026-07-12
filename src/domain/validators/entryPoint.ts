import { isOfBuiltin } from '../entityTypeMeta';
import { incomingEdges, outgoingEdges, structuralEntities } from '../graph';
import type { TPDocument } from '../types';
import { makeWarning, type UntieredWarning } from './shared';

/**
 * Session 199 (backlog A2, Scheinkopf — Handbook Ch. 25, the NBR section) — the
 * entry-point rule for Future Reality Trees and Negative Branch Reservations.
 *
 * An *entry point* is a cause with nothing causing it: a node with at least one
 * outgoing effect but no incoming edge. In a solution tree every entry point has
 * to be one of two things — an **injection** you will deliberately introduce, or
 * a condition that is **already true in current reality** — otherwise the branch
 * is resting on an unstated assumption that nobody has committed to or verified.
 *
 * "Already true today" is read from the entity's `state` tag (`'true'` = the user
 * has asserted it holds). Everything else — `unknown` (the default), `false`,
 * `disputed` — leaves the entry point unsupported, so it's flagged. Existence
 * tier; soft and dismissible like any reservation.
 *
 * Scoped to FRT / NBR only: a Current Reality Tree's entry points are its root
 * causes, which are *supposed* to be uncaused, so the rule would be noise there.
 * A fully isolated node (no edges at all) is entity-existence's concern, not
 * this rule's — hence the outgoing-edge requirement.
 *
 * NOTE: this rule reads `Entity.state`, which `validationFingerprint` now encodes
 * (Session 199 A2) — without that, toggling an entry point's state would not
 * clear the warning on a validator cache hit.
 */
export const entryPointRule = (doc: TPDocument): UntieredWarning[] => {
  const out: UntieredWarning[] = [];
  for (const e of structuralEntities(doc)) {
    if (outgoingEdges(doc, e.id).length === 0) continue; // not a cause of anything
    if (incomingEdges(doc, e.id).length > 0) continue; // something causes it — not an entry point
    if (isOfBuiltin(e.type, 'injection', doc.customEntityClasses)) continue; // a deliberate change
    if (e.state === 'true') continue; // asserted to hold in current reality
    out.push(
      makeWarning(
        doc,
        'entry-point',
        { kind: 'entity', id: e.id },
        'This is an entry point — it has effects but nothing causes it — yet it is neither an injection nor marked true in current reality. Make it an injection, mark its state as holding today, or connect the cause that produces it.'
      )
    );
  }
  return out;
};
