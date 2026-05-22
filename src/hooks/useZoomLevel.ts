import { useStore as useRFStore } from '@xyflow/react';

/**
 * Live React Flow viewport zoom level, returned as a primitive number
 * (e.g. `0.5` at half-zoom, `1` at 100 %, `2` at 200 %). Subscribers
 * re-render only when the zoom changes — `useRFStore` does shallow-equal
 * tracking on the selector return value, and a primitive selector by
 * definition has only one path that triggers an update.
 *
 * Extracted out of `ZoomPercent.tsx`'s inline subscription (Session 46
 * Block 0.4) so Block B's zoom-aware UI (B5 zoom-up annotations, TPNode
 * collapse-at-low-zoom) can share one subscription point rather than
 * each component registering its own.
 *
 * Must be called inside a `<ReactFlowProvider>`. The Canvas component
 * mounts the provider around everything that reads viewport state.
 *
 * Session 135 / Perf #18 — optional `enabled` gate. `TPNode` calls this
 * once per visible node, but only *needs* the live zoom while the node is
 * selected or hovered (the zoom-up overlay). When `enabled` is false the
 * selector returns a constant, so React-Flow's per-frame transform
 * notifications never change the value and never re-render the node —
 * only the one or two interacting nodes pay the per-frame cost during a
 * pan / zoom. Default `true` preserves the single-subscriber callers
 * (CanvasNav) unchanged.
 */
export const useZoomLevel = (enabled = true): number =>
  useRFStore((s) => (enabled ? s.transform[2] : 1));
