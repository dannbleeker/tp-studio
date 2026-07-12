import { edgesArray, entitiesOfType, incomingEdges } from '../graph';
import type { TPDocument } from '../types';
import { makeWarning, type UntieredWarning } from './shared';

/**
 * Goal-Tree structural rules (improvement review — Goal Tree previously had no
 * connectivity/count validators beyond the single-apex nudge). A Goal Tree
 * decomposes **Goal → Critical Success Factors → Necessary Conditions**; edges
 * read `NC → CSF → goal` (a child points *into* its parent — see the
 * `add-nc-child` command, `connect(nc.id, parent.id)`). Both rules are pure
 * graph queries mirroring the shipped CRT rules (`crt-ude-count`, the
 * rollup/no-upstream shape).
 */

/**
 * A Critical Success Factor with no Necessary Conditions beneath it — a CSF is
 * "make-or-break" and should decompose into the conditions that satisfy it.
 * Fires on CSFs with no incoming edge from a `necessaryCondition`.
 */
export const goalTreeCsfNoNcsRule = (doc: TPDocument): UntieredWarning[] => {
  if (doc.diagramType !== 'goalTree') return [];
  const out: UntieredWarning[] = [];
  for (const csf of entitiesOfType(doc, 'criticalSuccessFactor')) {
    const hasNc = incomingEdges(doc, csf.id).some(
      (e) => doc.entities[e.sourceId]?.type === 'necessaryCondition'
    );
    if (!hasNc) {
      out.push(
        makeWarning(
          doc,
          'goalTree-csf-no-ncs',
          { kind: 'entity', id: csf.id },
          'This Critical Success Factor has no Necessary Conditions beneath it — add the conditions that must hold for it.'
        )
      );
    }
  }
  return out;
};

const MIN_CSF = 3;
const MAX_CSF = 5;

/**
 * Goal-Tree CSF-count scope guard (analogue of `crt-ude-count`). Dettmer's
 * pattern is typically 3–5 Critical Success Factors — the small set of
 * make-or-break conditions between the Goal and its Necessary Conditions.
 * Targets the document (the count is a property of the tree). Silent below one
 * CSF so a brand-new Goal Tree isn't nagged.
 */
export const goalTreeCsfCountRule = (doc: TPDocument): UntieredWarning[] => {
  if (doc.diagramType !== 'goalTree') return [];
  const count = entitiesOfType(doc, 'criticalSuccessFactor').length;
  if (count === 0) return [];
  if (count < MIN_CSF) {
    return [
      makeWarning(
        doc,
        'goalTree-csf-count',
        { kind: 'document' },
        `This Goal Tree has ${count} Critical Success Factor${count === 1 ? '' : 's'} — Dettmer's pattern is typically ${MIN_CSF}–${MAX_CSF}; you may be missing some make-or-break conditions.`
      ),
    ];
  }
  if (count > MAX_CSF) {
    return [
      makeWarning(
        doc,
        'goalTree-csf-count',
        { kind: 'document' },
        `This Goal Tree has ${count} Critical Success Factors — more than ${MAX_CSF} usually means some are really Necessary Conditions a tier down.`
      ),
    ];
  }
  return [];
};

/**
 * Session 195 — three build-discipline nudges from Dettmer's abbreviated
 * IO-Map construction checklist (*The Logical Thinking Process* 2007,
 * Fig 3.14, step 4 + step 6). All tier `clarity`: each is a scope /
 * convention nudge the user can dismiss, not a structural defect.
 */

const MAX_NCS_PER_CSF = 5;

/**
 * Step 4's per-CSF bound: "no more than 3–5 NCs per CSF." Only the upper
 * bound is enforced — one or two NCs under a CSF is common and fine (both
 * shipped two-arm Goal Tree patterns have two), so a lower-bound nag would
 * be noise. Fires on the CSF, counting direct `necessaryCondition` children.
 */
export const goalTreeNcsPerCsfRule = (doc: TPDocument): UntieredWarning[] => {
  if (doc.diagramType !== 'goalTree') return [];
  const out: UntieredWarning[] = [];
  for (const csf of entitiesOfType(doc, 'criticalSuccessFactor')) {
    const ncCount = incomingEdges(doc, csf.id).filter(
      (e) => doc.entities[e.sourceId]?.type === 'necessaryCondition'
    ).length;
    if (ncCount > MAX_NCS_PER_CSF) {
      out.push(
        makeWarning(
          doc,
          'goalTree-ncs-per-csf',
          { kind: 'entity', id: csf.id },
          `This Critical Success Factor has ${ncCount} direct Necessary Conditions — Dettmer's checklist caps it at ${MAX_NCS_PER_CSF}; group some under an intermediate condition or trim the low-level ones.`
        )
      );
    }
  }
  return out;
};

const MAX_NC_DEPTH = 2;
// Session 199 (backlog A4) — a stand-alone conflict-resolution Goal Tree (not
// feeding a CRT) legitimately runs deeper; the opt-in mode relaxes the cap.
const MAX_NC_DEPTH_RELAXED = 5;

/**
 * Step 4's depth bound: "limit your NCs to no more than two layers," with
 * step 8's companion advice to trim low-level NCs into execution planning.
 * An NC directly under a CSF is layer 1; an NC under that is layer 2;
 * anything deeper gets flagged — that detail belongs in a Prerequisite /
 * Transition Tree, not the destination-defining IO Map. Depth is the
 * minimum over every CSF the NC supports (the charitable reading when a
 * shared NC feeds two parents at different depths).
 *
 * The cap relaxes to {@link MAX_NC_DEPTH_RELAXED} when the doc opts into
 * `ncDepthMode: 'conflict-resolution'` (Session 199 A4) — a stand-alone Goal
 * Tree isn't bound by the "feeding a CRT" depth discipline.
 */
export const goalTreeNcDepthRule = (doc: TPDocument): UntieredWarning[] => {
  if (doc.diagramType !== 'goalTree') return [];
  const maxDepth = doc.ncDepthMode === 'conflict-resolution' ? MAX_NC_DEPTH_RELAXED : MAX_NC_DEPTH;
  // BFS down from every CSF. Children point INTO their parent (NC → CSF,
  // deeper NC → NC), so descending means walking incoming edges.
  const minDepth = new Map<string, number>();
  const queue: Array<{ id: string; depth: number }> = entitiesOfType(
    doc,
    'criticalSuccessFactor'
  ).map((csf) => ({ id: csf.id, depth: 0 }));
  while (queue.length > 0) {
    // Non-null is safe: guarded by queue.length above.
    const { id, depth } = queue.shift()!;
    for (const edge of incomingEdges(doc, id)) {
      const child = doc.entities[edge.sourceId];
      if (child?.type !== 'necessaryCondition') continue;
      const childDepth = depth + 1;
      const known = minDepth.get(child.id);
      if (known !== undefined && known <= childDepth) continue; // also breaks cycles
      minDepth.set(child.id, childDepth);
      queue.push({ id: child.id, depth: childDepth });
    }
  }
  const out: UntieredWarning[] = [];
  for (const [id, depth] of minDepth) {
    if (depth > maxDepth) {
      out.push(
        makeWarning(
          doc,
          'goalTree-nc-depth',
          { kind: 'entity', id },
          `This Necessary Condition sits ${depth} layers below a CSF — the limit here is ${maxDepth}. Deeper detail is execution planning: consider trimming it here and developing it in a Prerequisite Tree.`
        )
      );
    }
  }
  return out;
};

/**
 * Step 6's connection convention: "single arrows (no ellipses or
 * magnitudinal AND symbols)." In necessity logic every child of a parent is
 * already required — an explicit AND junctor is redundant, and OR / XOR
 * contradict the reading outright. Fires once per grouped edge.
 */
export const goalTreeJunctorRule = (doc: TPDocument): UntieredWarning[] => {
  if (doc.diagramType !== 'goalTree') return [];
  const out: UntieredWarning[] = [];
  for (const edge of edgesArray(doc)) {
    if (edge.andGroupId || edge.orGroupId || edge.xorGroupId) {
      out.push(
        makeWarning(
          doc,
          'goalTree-junctor',
          { kind: 'edge', id: edge.id },
          'A Goal Tree uses single arrows only — necessity children are implicitly conjoined, so an AND junctor is redundant and OR / XOR contradict the "in order to… we must…" reading. Ungroup this edge.'
        )
      );
    }
  }
  return out;
};
