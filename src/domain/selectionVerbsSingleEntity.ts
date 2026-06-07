/**
 * Session 135 — extracted from `selectionVerbs.ts` (file split). The
 * single-entity branch carries ~200 lines of diagram-type-conditional
 * verb assembly (CRT/FRT marking, Goal Tree promotion, EC/TT/PRT slot
 * verbs) — by far the largest case in `verbsForBranch`. Pulling it
 * here keeps the registry's branch dispatcher readable; the other
 * branches (edge / group / multi) stay inline in `selectionVerbs.ts`
 * since they're short.
 *
 * `Verb` is imported type-only to avoid a runtime import cycle
 * (`selectionVerbs.ts` runtime-imports this builder back).
 */

import { MessageSquarePlus } from 'lucide-react';
import { reachableBackward, reachableForward } from '@/domain/graph';
import type { EntityId } from '@/domain/types';
import type { DocumentStore } from '@/store';
import { currentDoc } from '@/store/selectors';
import type { Verb } from './selectionVerbs';

/**
 * Ordered verb list for a single selected entity. The `add-successor`
 * / `add-predecessor` pair always leads; per-diagram-type verbs slot
 * in next; `Delete` always closes. See `verbsForBranch` for the
 * branch-dispatch context.
 */
export const verbsForSingleEntity = (id: string, state: DocumentStore): Verb[] => {
  const doc = currentDoc(state);
  const entity = doc.entities[id];
  const diagramType = doc.diagramType;
  const verbs: Verb[] = [
    {
      id: 'add-successor',
      label: 'Add child',
      shortLabel: 'Child',
      writes: true,
      paletteCommandId: 'add-successor',
    },
    {
      id: 'add-predecessor',
      label: 'Add parent',
      shortLabel: 'Parent',
      writes: true,
      paletteCommandId: 'add-predecessor',
    },
  ];
  // Session 96 — per-diagramType verbs.
  // **CRT** practitioners spend most of their time tagging entities
  // as UDEs (at the top) or root causes (at the bottom). Surface
  // both directly so the toolbar replaces a 2-click trip into the
  // Inspector's Type picker. Skipped on diagrams where the
  // distinction doesn't apply (Goal Tree, EC, S&T).
  if (diagramType === 'crt' || diagramType === 'frt') {
    if (entity && entity.type !== 'ude') {
      verbs.push({
        id: 'mark-as-ude',
        label: 'Mark as UDE',
        shortLabel: 'UDE',
        writes: true,
        paletteCommandId: 'mark-as-ude',
      });
    }
    if (entity && entity.type !== 'rootCause') {
      verbs.push({
        id: 'mark-as-rootcause',
        label: 'Mark as root cause',
        shortLabel: 'Root',
        writes: true,
        paletteCommandId: 'mark-as-rootcause',
      });
    }
    // Session 127 — practitioner workflows on a fleshed-out CRT
    // converge on two next steps. From a root cause or a UDE,
    // spawning an Evaporating Cloud lets the practitioner reason
    // through the conflict driving the root cause; from any FRT
    // entity, capturing a Negative Branch reservation walks the
    // "what could go wrong?" scenario. Both are existing palette
    // commands — surfacing them as toolbar verbs collapses a
    // palette-search step that's high-traffic for CRT/FRT work.
    if (diagramType === 'crt' && entity && (entity.type === 'rootCause' || entity.type === 'ude')) {
      verbs.push({
        id: 'spawn-ec-from-selection',
        label: 'Spawn Evaporating Cloud from this entity',
        shortLabel: 'Spawn EC',
        writes: true,
        paletteCommandId: 'spawn-ec-from-selection',
      });
    }
    if (diagramType === 'frt' && entity) {
      verbs.push({
        id: 'start-negative-branch',
        label: 'Start Negative Branch from this entity',
        shortLabel: 'Neg branch',
        writes: true,
        paletteCommandId: 'start-negative-branch',
      });
    }
  }
  // **Goal Tree** — "Add NC" creates a necessaryCondition child
  // connected via a necessity edge (the canonical Goal Tree
  // build step). "Promote to Goal" only when the selected entity
  // isn't already a goal.
  if (diagramType === 'goalTree') {
    verbs.push({
      id: 'add-nc-child',
      label: 'Add necessary condition',
      shortLabel: 'Add NC',
      writes: true,
      paletteCommandId: 'add-nc-child',
    });
    if (entity && entity.type !== 'goal') {
      verbs.push({
        id: 'promote-to-goal',
        label: 'Promote to Goal',
        shortLabel: 'Promote',
        writes: true,
        paletteCommandId: 'promote-to-goal',
      });
    }
    // Session 127 — symmetric with `promote-to-goal`. CSFs are
    // the mid-tier "make-or-break" conditions in a Goal Tree; an
    // entity created via the wizard arrives as `criticalSuccess
    // Factor` by default but Quick-Capture / drag-create starts
    // them as `effect`, so the practitioner needs a one-click
    // re-type to put them in the right tier.
    if (entity && entity.type !== 'criticalSuccessFactor' && entity.type !== 'goal') {
      verbs.push({
        id: 'mark-as-csf',
        label: 'Mark as Critical Success Factor',
        shortLabel: 'Mark CSF',
        writes: true,
        paletteCommandId: 'mark-as-csf',
      });
    }
  }
  // Session 97 — **EC slot Want** entities surface "Add
  // prerequisite": creates a `need` upstream of the selected
  // want with a necessity edge, matching the canonical EC
  // reading "to obtain Want we must satisfy Need". Skipped
  // when the entity isn't a want.
  if (diagramType === 'ec' && entity && entity.type === 'want') {
    verbs.push({
      id: 'add-prerequisite-need',
      label: 'Add prerequisite need',
      shortLabel: 'Add need',
      writes: true,
      paletteCommandId: 'add-prerequisite-need',
    });
  }
  // Session 128 — **Transition Tree slot verbs.** TT entities split
  // into Action steps and the (effect / desiredEffect) outcome
  // they produce; surface `Mark as Action` and `Mark as Outcome`
  // for one-click slot assignment, plus `Add precondition` (the
  // canonical TT step-completion gesture that pairs an Action
  // with a non-Action sibling cause).
  if (diagramType === 'tt' && entity) {
    if (entity.type !== 'action') {
      verbs.push({
        id: 'mark-as-action',
        label: 'Mark as Action',
        shortLabel: 'Action',
        writes: true,
        paletteCommandId: 'mark-as-action',
      });
    }
    if (entity.type !== 'desiredEffect') {
      verbs.push({
        id: 'mark-as-outcome',
        label: 'Mark as Outcome',
        shortLabel: 'Outcome',
        writes: true,
        paletteCommandId: 'mark-as-outcome',
      });
    }
    if (entity.type === 'action') {
      verbs.push({
        id: 'add-precondition',
        label: 'Add precondition',
        shortLabel: 'Add precond',
        writes: true,
        paletteCommandId: 'add-precondition',
      });
    }
  }
  // Session 128 — **Prerequisite Tree slot verbs.** PRT pairs each
  // Obstacle with an Intermediate Objective that removes it.
  // Surface `Mark as Obstacle` / `Mark as IO` for slot assignment
  // and `Add IO for this Obstacle` on a selected Obstacle (mints
  // a paired IO with the canonical IO → Obstacle edge).
  if (diagramType === 'prt' && entity) {
    if (entity.type !== 'obstacle') {
      verbs.push({
        id: 'mark-as-obstacle',
        label: 'Mark as Obstacle',
        shortLabel: 'Obstacle',
        writes: true,
        paletteCommandId: 'mark-as-obstacle',
      });
    }
    if (entity.type !== 'intermediateObjective') {
      verbs.push({
        id: 'mark-as-io',
        label: 'Mark as IO',
        shortLabel: 'IO',
        writes: true,
        paletteCommandId: 'mark-as-io',
      });
    }
    if (entity.type === 'obstacle') {
      verbs.push({
        id: 'add-io-for-obstacle',
        label: 'Add IO for this Obstacle',
        shortLabel: 'Add IO',
        writes: true,
        paletteCommandId: 'add-io-for-obstacle',
      });
    }
  }
  // Session 179 (Theme D) — surface the existing select-successors /
  // -predecessors actions (already palette + keyboard commands) on the
  // right-click menu + toolbar too. Inline `run` rather than `paletteCommandId`
  // because those live in the palette-only `navigate` module, which
  // `verbCommandRuns` deliberately keeps off the eager path; the reach + select
  // is trivial to inline. `writes: true` governs toolbar VISIBILITY only (the
  // `add-comment-on-selection` precedent): the locked toolbar stays quiet, but
  // the actions remain reachable under Browse Lock via the palette + keyboard —
  // they're pure navigation and never write-guarded.
  verbs.push({
    id: 'select-successors',
    label: 'Select all successors',
    shortLabel: 'Successors',
    writes: true,
    run: (s) => {
      const reached = reachableForward(currentDoc(s), [id as EntityId]);
      s.selectEntities([...new Set<string>([id, ...reached])]);
    },
  });
  verbs.push({
    id: 'select-predecessors',
    label: 'Select all predecessors',
    shortLabel: 'Predecessors',
    writes: true,
    run: (s) => {
      const reached = reachableBackward(currentDoc(s), [id as EntityId]);
      s.selectEntities([...new Set<string>([id, ...reached])]);
    },
  });
  // Comments — annotate the selected entity. `writes: true` is for toolbar
  // VISIBILITY only (not authorization, per the `Verb.writes` contract):
  // under Browse Lock the selection toolbar goes quiet like every other
  // verb, keeping the read-only canvas clean. Commenting itself is NOT
  // write-guarded — it stays reachable under lock via the Comments panel,
  // the TopBar button, and the `add-comment-on-selection` palette command.
  // Inline `run` opens the panel, which anchors the composer to the selection.
  verbs.push({
    id: 'add-comment-on-selection',
    label: 'Add comment',
    shortLabel: 'Comment',
    icon: MessageSquarePlus,
    writes: true,
    run: (s) => s.openCommentsPanel(),
  });
  verbs.push({
    id: 'confirm-delete-selection',
    label: 'Delete',
    destructive: true,
    writes: true,
    paletteCommandId: 'confirm-delete-selection',
  });
  return verbs;
};
