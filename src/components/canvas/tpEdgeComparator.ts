import type { EdgeProps } from '@xyflow/react';
import type { TPEdge as TPEdgeType } from './flow-types';

/**
 * Session 113 — extracted from `TPEdge.tsx` (Session 105 / Tier 1 #6
 * shipped this comparator inline). The comparator is a pure function
 * with no React dependencies; pulling it into its own module:
 *   - Lets unit tests import it without dragging the full TPEdge
 *     render path through ts-server / jsdom.
 *   - Keeps `TPEdge.tsx` focused on the render + store-subscription
 *     side of the contract; the comparator's correctness is the
 *     other half and lives next to it for grep but in its own file
 *     for navigation.
 *
 * No behavior change vs. the inline version. The exports are the same
 * symbols (`tpEdgePropsEqual` + `shallowEqualObject`); the existing
 * memo-comparator test file imports from this module after the
 * extraction.
 */

/**
 * Shallow-equality check on two objects' enumerable own keys.
 * Exported for direct test coverage of the comparator below.
 */
export const shallowEqualObject = (a: unknown, b: unknown): boolean => {
  if (a === b) return true;
  if (typeof a !== 'object' || a === null || typeof b !== 'object' || b === null) return false;
  const ak = Object.keys(a as Record<string, unknown>);
  const bk = Object.keys(b as Record<string, unknown>);
  if (ak.length !== bk.length) return false;
  for (const k of ak) {
    if ((a as Record<string, unknown>)[k] !== (b as Record<string, unknown>)[k]) return false;
  }
  return true;
};

/**
 * The custom comparator for `React.memo(TPEdge)`. Returns `true`
 * when the memo should bail (skip re-render); `false` when the
 * component must re-render.
 *
 * Session 105's win was discovering that React's default shallow
 * comparator was always missing here: `useGraphEdgeEmission` rebuilds
 * each edge's `data` literal every emission run (fresh object spread),
 * so referential equality always fails on `data`. This comparator
 * does shallow-equality *on* `data`'s enumerable keys instead.
 */
export const tpEdgePropsEqual = (
  prev: EdgeProps<TPEdgeType>,
  next: EdgeProps<TPEdgeType>
): boolean => {
  if (prev.id !== next.id) return false;
  if (prev.source !== next.source || prev.target !== next.target) return false;
  if (prev.sourceX !== next.sourceX || prev.sourceY !== next.sourceY) return false;
  if (prev.targetX !== next.targetX || prev.targetY !== next.targetY) return false;
  if (prev.sourcePosition !== next.sourcePosition) return false;
  if (prev.targetPosition !== next.targetPosition) return false;
  if (prev.selected !== next.selected) return false;
  if (prev.markerEnd !== next.markerEnd) return false;
  if (prev.markerStart !== next.markerStart) return false;
  return shallowEqualObject(prev.data, next.data);
};
