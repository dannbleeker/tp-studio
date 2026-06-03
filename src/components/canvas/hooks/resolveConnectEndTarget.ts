import type { HoveredJunctor } from '@/services/canvasRef';

/**
 * The fields of a flow edge that the junctor-member lookup reads. Kept minimal
 * (rather than importing the full `TPEdge`) so the resolver — and its tests —
 * don't depend on React Flow's edge shape; the live `TPEdge[]` from
 * `getCanvasInstance().getEdges()` is structurally assignable.
 */
export type ConnectEndEdge = {
  readonly id: string;
  readonly data?:
    | {
        readonly andGroupId?: string | undefined;
        readonly orGroupId?: string | undefined;
        readonly xorGroupId?: string | undefined;
      }
    | undefined;
};

/**
 * The resolved outcome of a connection-drag release, as a discriminated union.
 * Adding a new drop-target becomes "add a variant here + a `case` in the caller"
 * rather than threading another branch through the ~90-line imperative handler.
 *
 *   - `noop`           — nothing to do (handle hit already handled by `onConnect`,
 *                        self-loop, or empty space).
 *   - `connect`        — released over a node body → bridge to a normal connect.
 *   - `junctor`        — released over an existing junctor circle → join that
 *                        AND/OR/XOR group via one of its member edges.
 *   - `junctor-missing`— released over a junctor whose group vanished mid-drag
 *                        (e.g. an undo) → fail open with an info toast.
 *   - `edge-andcause`  — released over an edge body → add an AND co-cause.
 */
export type ConnectEndTarget =
  | { readonly kind: 'noop' }
  | { readonly kind: 'connect'; readonly sourceId: string; readonly targetId: string }
  | {
      readonly kind: 'junctor';
      readonly sourceId: string;
      readonly junctorKind: 'and' | 'or' | 'xor';
      readonly label: 'AND' | 'OR' | 'XOR';
      readonly memberEdgeId: string;
    }
  | { readonly kind: 'junctor-missing'; readonly label: 'AND' | 'OR' | 'XOR' }
  | { readonly kind: 'edge-andcause'; readonly sourceId: string; readonly edgeId: string };

/**
 * Pure decision core of `onConnectEnd`: given where a connection drag was
 * released (a node body, a junctor circle, an edge body, or empty space), decide
 * what should happen. All side effects — the Browse-Lock guard, the store
 * mutation, the toast, and clearing the hover channels — stay in the caller; this
 * function only reads its inputs and returns a {@link ConnectEndTarget}.
 *
 * **Priority order** (the comment-documented precedence, now executable + tested):
 *   1. Node body  — a drop on a node wins over any junctor / edge underneath it.
 *                   Same source/target is a self-loop → `noop`.
 *   2. Junctor    — more specific than the edge body beneath the circle.
 *   3. Edge body  — the canonical "add a sufficient cause" gesture (always AND;
 *                   OR / XOR only fire on an explicit junctor drop above).
 *   4. Empty      — `noop` (the bare connection was already dropped by `onConnect`).
 *
 * Callers pass `toNodeId` as `connectionState.toNode?.id ?? null` and the two
 * hover snapshots; `rfEdges` is the live edge list used only to resolve a
 * junctor's group to a concrete member edge.
 */
export const resolveConnectEndTarget = (input: {
  readonly sourceId: string;
  readonly toNodeId: string | null;
  readonly hoveredJunctor: HoveredJunctor | null;
  readonly hoveredEdgeId: string | null;
  readonly rfEdges: readonly ConnectEndEdge[];
}): ConnectEndTarget => {
  const { sourceId, toNodeId, hoveredJunctor, hoveredEdgeId, rfEdges } = input;

  // 1. Released over a node body — connect, unless it's a self-loop.
  if (toNodeId !== null) {
    if (toNodeId === sourceId) return { kind: 'noop' };
    return { kind: 'connect', sourceId, targetId: toNodeId };
  }

  // 2. Released over a junctor circle (checked before the edge body so a hover
  //    that sat on both resolves to the more specific junctor gesture).
  if (hoveredJunctor) {
    const junctorKind =
      hoveredJunctor.kind === 'AND' ? 'and' : hoveredJunctor.kind === 'OR' ? 'or' : 'xor';
    const memberEdge = rfEdges.find((e) =>
      junctorKind === 'and'
        ? e.data?.andGroupId === hoveredJunctor.groupId
        : junctorKind === 'or'
          ? e.data?.orGroupId === hoveredJunctor.groupId
          : e.data?.xorGroupId === hoveredJunctor.groupId
    );
    // Group disappeared mid-drag (rare; e.g. user undid an edge while dragging).
    if (!memberEdge) return { kind: 'junctor-missing', label: hoveredJunctor.kind };
    return {
      kind: 'junctor',
      sourceId,
      junctorKind,
      label: hoveredJunctor.kind,
      memberEdgeId: memberEdge.id,
    };
  }

  // 3. Released over an edge body — always an AND co-cause.
  if (hoveredEdgeId) return { kind: 'edge-andcause', sourceId, edgeId: hoveredEdgeId };

  // 4. Empty space — nothing to do.
  return { kind: 'noop' };
};
