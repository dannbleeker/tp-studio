import { udeReachCounts } from '../coreDriver';
import { displayTitle } from '../entityPalettes';
import { structuralEntities } from '../graph';
import type { TPDocument } from '../types';
import { makeWarning, type UntieredWarning } from './shared';

/**
 * Session 179 (Theme B) — CRT "dead branch" nudge.
 *
 * Dettmer's CRT method prescribes trimming entities that don't lead to any UDE
 * — they're scaffolding, not part of the causal explanation. `udeReachCounts`
 * already computes, for every structural entity, how many UDEs it transitively
 * reaches (entities reaching zero are omitted from the map), so a non-UDE
 * structural entity absent from that map is a dead branch.
 *
 * Scoped to CRT and skipped while the tree has no UDEs yet (every entity would
 * read as "dead" — pure noise on a half-built tree). `structuralEntities`
 * already excludes notes + assumptions, so we only skip the UDEs themselves
 * (they're the sinks; they needn't reach another UDE).
 */
export const crtDeadBranchRule = (doc: TPDocument): UntieredWarning[] => {
  if (doc.diagramType !== 'crt') return [];
  const hasUdes = Object.values(doc.entities).some((e) => e.type === 'ude');
  if (!hasUdes) return [];
  const reach = udeReachCounts(doc);
  const out: UntieredWarning[] = [];
  for (const e of structuralEntities(doc)) {
    if (e.type === 'ude') continue;
    if (reach.has(e.id)) continue;
    out.push(
      makeWarning(
        doc,
        'crt-dead-branch',
        { kind: 'entity', id: e.id },
        `"${displayTitle(e)}" doesn't lead to any UDE — prune or archive it, or connect it into the causal chain.`
      )
    );
  }
  return out;
};
