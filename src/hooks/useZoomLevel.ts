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
 */
export const useZoomLevel = (): number => useRFStore((s) => s.transform[2]);
