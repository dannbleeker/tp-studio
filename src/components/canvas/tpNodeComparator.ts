import type { NodeProps } from '@xyflow/react';
import type { TPNode as TPNodeType } from './flow-types';

/**
 * Session 113 — extracted from `TPNode.tsx` (sibling of the same-session
 * extraction in `TPEdge.tsx`). The memo comparator is a pure function;
 * pulling it into its own module lets unit tests target it without
 * dragging the full TPNode render path through ts-server / jsdom, and
 * keeps the component file focused on render.
 *
 * No behavior change vs. the inline version. The exports are the same
 * symbols (`tpNodePropsEqual` + `shallowEqualNodeData`); the existing
 * memo-comparator test file imports from this module after the
 * extraction.
 */

/**
 * Shallow-equality check on two objects' enumerable own keys.
 * Exported for direct test coverage of the comparator below.
 */
export const shallowEqualNodeData = (a: unknown, b: unknown): boolean => {
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
 * The custom comparator for `React.memo(TPNode)`. Returns `true`
 * when the memo should bail (skip re-render); `false` when the
 * component must re-render.
 *
 * Session 105's win was discovering that React's default shallow
 * comparator was always missing here: `useGraphNodeEmission` rebuilds
 * each node's `data` literal every emission run (fresh object spread),
 * so referential equality always fails on `data`. This comparator
 * does shallow-equality *on* `data`'s enumerable keys instead.
 */
export const tpNodePropsEqual = (
  prev: NodeProps<TPNodeType>,
  next: NodeProps<TPNodeType>
): boolean => {
  if (prev.id !== next.id) return false;
  if (prev.selected !== next.selected) return false;
  if (prev.dragging !== next.dragging) return false;
  if (prev.positionAbsoluteX !== next.positionAbsoluteX) return false;
  if (prev.positionAbsoluteY !== next.positionAbsoluteY) return false;
  return shallowEqualNodeData(prev.data, next.data);
};
