/**
 * Deterministic visual reading order for canvas nodes.
 *
 * React Flow renders nodes to the DOM in array order, and browser Tab / screen-
 * reader traversal follows DOM order. Left unsorted, the emitted entity nodes
 * carry their insertion order (roughly creation / annotation order), so a
 * keyboard or AT user Tabs through the diagram in the order nodes happened to be
 * created — not the order the eye reads them. This sorts entity ids into
 * top-to-bottom, left-to-right reading order using the post-layout positions.
 *
 * The vertical coordinate is QUANTIZED into rank bands before comparing so the
 * comparator is a true total order (transitive): a raw `abs(dy) < band` tie-
 * break is non-transitive and yields an unstable/incorrect sort. Nodes whose
 * centres fall in the same band read left-to-right; earlier bands (smaller y,
 * i.e. higher on screen) come first. This "what the eye does" ordering is
 * layout-direction-agnostic — it gives a sensible Tab path for BT / TB / LR / RL
 * alike without per-direction special-casing.
 */

/** Vertical span (px) within which two nodes count as the same visual row. */
export const RANK_BAND_PX = 40;

type Pos = { readonly x: number; readonly y: number };

export const readingOrder = (
  ids: readonly string[],
  positions: Readonly<Record<string, Pos | undefined>>
): string[] => {
  const rankOf = (p: Pos): number => Math.round(p.y / RANK_BAND_PX);
  return [...ids].sort((a, b) => {
    const pa = positions[a];
    const pb = positions[b];
    // Nodes without a resolved position keep their relative order (stable sort)
    // and sink below positioned ones so they don't scramble the reading path.
    if (!pa && !pb) return 0;
    if (!pa) return 1;
    if (!pb) return -1;
    const ra = rankOf(pa);
    const rb = rankOf(pb);
    if (ra !== rb) return ra - rb;
    if (pa.x !== pb.x) return pa.x - pb.x;
    return 0;
  });
};
