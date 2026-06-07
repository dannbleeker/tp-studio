import { effectiveBackEdgeIds } from '../backEdges';
import { structuralEntities } from '../graph';
import type { TPDocument } from '../types';
import { makeWarning, type UntieredWarning } from './shared';

/**
 * Session 180 (E5) — long-arrow / missing-step reservation.
 *
 * In a sufficiency tree, a single arrow that leaps across several causal
 * levels usually skips the intermediate steps the reader needs to follow the
 * logic. This is a classic Causality-Existence reservation ("the direct link
 * doesn't exist as drawn — an intermediate is missing"); it's the depth-twin
 * of `indirect-effect`'s breadth check (too many causes converging), so it
 * shares the EXISTENCE tier.
 *
 * Detection (structural, layout-independent): give each entity a causal
 * LEVEL = the longest chain of forward sufficiency edges ending at it
 * (back-edges excluded, via `effectiveBackEdgeIds`, so a feedback loop can't
 * make the longest path infinite). A sufficiency edge whose endpoints differ
 * by >= LEVEL_SPAN levels jumps past >= LEVEL_SPAN - 1 intermediate levels —
 * flag it. With LEVEL_SPAN = 3, a single skipped step never fires; it takes a
 * jump past >= 2 levels.
 *
 * Conservative by design (higher false-positive risk than the structural
 * checks): the threshold keeps it silent on shallow trees and only fires
 * where the tree is deep enough for "skipping" to be meaningful, every
 * warning is dismissible (persists via `resolvedWarnings`), and the message
 * is a question, not an assertion. The `insert-step` action splices a blank
 * intermediate entity into the edge so the fix is one click.
 *
 * Scoped (in `validators/index.ts`) to the sufficiency diagrams — CRT / FRT /
 * TT / NBR — where the missing-step question is unambiguous.
 */

/** Minimum causal-level span (level(target) - level(source)) to flag.
 *  3 ⇒ the arrow jumps past ≥ 2 intermediate levels. */
const LEVEL_SPAN = 3;

const truncate = (s: string, max = 32): string => {
  const t = s.trim();
  return t.length <= max ? t : `${t.slice(0, max - 1)}…`;
};

export const longArrowRule = (doc: TPDocument): UntieredWarning[] => {
  const structuralIds = new Set(structuralEntities(doc).map((e) => e.id));
  const backIds = effectiveBackEdgeIds(doc);

  // The forward DAG: sufficiency edges between two structural entities, with
  // back-edges (loop closers) removed so the longest-path level terminates.
  const forward = Object.values(doc.edges).filter(
    (e) =>
      e.kind === 'sufficiency' &&
      !backIds.has(e.id) &&
      structuralIds.has(e.sourceId) &&
      structuralIds.has(e.targetId)
  );

  // preds[target] = source ids feeding it via a forward edge.
  const preds = new Map<string, string[]>();
  for (const e of forward) {
    const list = preds.get(e.targetId);
    if (list) list.push(e.sourceId);
    else preds.set(e.targetId, [e.sourceId]);
  }

  // Longest chain ending at each node, memoized. The DAG guarantee (back-edges
  // removed) makes the recursion terminate; the `visiting` guard is
  // belt-and-braces against any residual cycle the derivation didn't break.
  const levelMemo = new Map<string, number>();
  const visiting = new Set<string>();
  const level = (id: string): number => {
    const cached = levelMemo.get(id);
    if (cached !== undefined) return cached;
    if (visiting.has(id)) return 0;
    visiting.add(id);
    let best = 0;
    for (const p of preds.get(id) ?? []) best = Math.max(best, level(p) + 1);
    visiting.delete(id);
    levelMemo.set(id, best);
    return best;
  };

  const out: UntieredWarning[] = [];
  for (const e of forward) {
    const span = level(e.targetId) - level(e.sourceId);
    if (span < LEVEL_SPAN) continue;
    const src = doc.entities[e.sourceId];
    const dst = doc.entities[e.targetId];
    if (!src || !dst) continue;
    out.push({
      ...makeWarning(
        doc,
        'long-arrow',
        { kind: 'edge', id: e.id },
        `This arrow spans ${span} causal levels — is a step missing between “${truncate(src.title)}” and “${truncate(dst.title)}”?`
      ),
      action: { actionId: 'insert-step', label: 'Insert a step' },
    });
  }
  return out;
};
