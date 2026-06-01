/**
 * Whether to paint the two visible "re-target" knobs on a selected edge's
 * endpoints. The knobs are a discoverability cue for React Flow's reconnect
 * gesture (grab an endpoint, drop it on another entity); they appear only when
 * that gesture is actually available:
 *   - the edge is SELECTED (keeps the canvas clean — knobs only on focus),
 *   - it's genuinely RECONNECTABLE (a real, non-aggregated edge with real
 *     endpoints — `data.reconnectable`, stamped by `useGraphEdgeEmission`),
 *   - it's not a junctor or mutex edge (those terminate at the junctor circle /
 *     run centre-to-centre, so an endpoint knob wouldn't sit on the line),
 *   - no connection drag is in flight (the drop-target glow owns the visual),
 *   - and the document isn't Browse-Locked (Canvas omits `onReconnect` then, so
 *     reconnection is disabled — no dangling affordance).
 *
 * Pure boolean — no React, no store. Unit-tested in `reconnectHandles.test.ts`.
 */
export type ReconnectHandlesInput = {
  readonly selected: boolean;
  readonly reconnectable: boolean;
  readonly isJunctorEdge: boolean;
  readonly isMutex: boolean;
  readonly isConnecting: boolean;
  readonly locked: boolean;
};

export const reconnectHandlesVisible = (a: ReconnectHandlesInput): boolean =>
  a.selected && a.reconnectable && !a.isJunctorEdge && !a.isMutex && !a.isConnecting && !a.locked;
