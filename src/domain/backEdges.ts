/**
 * Back-edge (feedback-loop closer) identification.
 *
 * A back-edge is the edge that closes a cycle — the reinforcing/vicious loop in a
 * CRT, the positive loop in an FRT. Until now it was a purely MANUAL tag
 * (`Edge.isBackEdge`, set via right-click "Tag as back-edge"). This module adds
 * AUTO-detection so a cycle's loop-closer renders + routes as a back-edge without
 * the user tagging it by hand, while keeping the manual tag as an always-included
 * override.
 *
 * It is DERIVED only — it never mutates the doc or the persisted `isBackEdge` flag,
 * so the manual tag and the cycle CLR warning (`validators/cycle.ts`, which reads
 * the persisted flag for its exemption) are unaffected.
 */

import { findCycles, outgoingEdges } from './graph';
import type { TPDocument } from './types';

/**
 * The edge that closes a cycle — from the LAST entity in the canonicalized cycle
 * back to the FIRST. This is the exact loop-closer convention the cycle CLR rule
 * (`validators/cycle.ts`) targets, shared here so an auto-detected back-edge lines
 * up with the edge that rule points at. `undefined` if the edge isn't in the doc
 * (shouldn't happen — `findCycles` derived the cycle from the same edge set).
 */
export const cycleClosingEdgeId = (
  doc: TPDocument,
  cycle: readonly string[]
): string | undefined => {
  const closing = cycle[cycle.length - 1];
  const first = cycle[0];
  if (!closing || !first) return undefined;
  return outgoingEdges(doc, closing).find((e) => e.targetId === first)?.id;
};

/** Every edge id forming a cycle — each consecutive entity pair, incl. last→first. */
const cycleEdgeIds = (doc: TPDocument, cycle: readonly string[]): string[] => {
  const ids: string[] = [];
  for (let i = 0; i < cycle.length; i++) {
    const from = cycle[i];
    const to = cycle[(i + 1) % cycle.length];
    if (!from || !to) continue;
    const e = outgoingEdges(doc, from).find((ed) => ed.targetId === to);
    if (e) ids.push(e.id);
  }
  return ids;
};

/**
 * Auto-detected back-edges: each cycle's closing edge. Deterministic — `findCycles`
 * canonicalizes each cycle to start at its smallest entity id.
 *
 * Manual tag wins: if the user has tagged ANY edge in a cycle, that edge IS the
 * designated back-edge for that loop — so we don't auto-mark a different (often
 * forward) edge of the same cycle. Without this, tagging the real back-edge can
 * light up an unrelated forward edge of the loop (Dann's report: tagging the
 * `effect → cause` closer spuriously styled the forward `root cause → effect`).
 */
const autoBackEdgeIds = (doc: TPDocument, manual: ReadonlySet<string>): Set<string> => {
  const out = new Set<string>();
  for (const cycle of findCycles(doc)) {
    if (cycleEdgeIds(doc, cycle).some((id) => manual.has(id))) continue;
    const id = cycleClosingEdgeId(doc, cycle);
    if (id) out.add(id);
  }
  return out;
};

// WeakMap-cached on `doc.edges` (mirrors `findCycles`): any add / remove / re-point /
// tag toggle gives a new edge-map ref and recomputes; otherwise the lookup is O(1).
const cache = new WeakMap<TPDocument['edges'], Set<string>>();

/**
 * The effective set of back-edge ids = manually tagged (`edge.isBackEdge === true`)
 * UNION the auto-detected cycle loop-closers. The single source the canvas reads so a
 * cycle's closing edge renders (distinct colour + dash) and — Wave 3 — routes (looped)
 * as a back-edge without a manual tag.
 */
export const effectiveBackEdgeIds = (doc: TPDocument): Set<string> => {
  const memo = cache.get(doc.edges);
  if (memo) return memo;
  // Manual tags first — `autoBackEdgeIds` needs them to apply the manual-tag-wins
  // rule per cycle; they're then unioned in as always-included overrides.
  const manual = new Set<string>();
  for (const e of Object.values(doc.edges)) {
    if (e.isBackEdge === true) manual.add(e.id);
  }
  const ids = autoBackEdgeIds(doc, manual);
  for (const id of manual) ids.add(id);
  cache.set(doc.edges, ids);
  return ids;
};
