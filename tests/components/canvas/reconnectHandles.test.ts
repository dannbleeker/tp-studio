import { describe, expect, it } from 'vitest';
import { reconnectHandlesVisible } from '@/components/canvas/edges/reconnectHandles';

/** A selected, reconnectable, plain edge — the one case that SHOWS the knobs. */
const base = {
  selected: true,
  reconnectable: true,
  isJunctorEdge: false,
  isMutex: false,
  isConnecting: false,
  locked: false,
} as const;

describe('reconnectHandlesVisible', () => {
  it('shows the knobs on a selected, reconnectable, plain edge', () => {
    expect(reconnectHandlesVisible(base)).toBe(true);
  });

  it('hides them unless the edge is selected', () => {
    expect(reconnectHandlesVisible({ ...base, selected: false })).toBe(false);
  });

  it('hides them on a non-reconnectable (aggregated / synthetic) edge', () => {
    expect(reconnectHandlesVisible({ ...base, reconnectable: false })).toBe(false);
  });

  it('hides them on junctor and mutex edges', () => {
    expect(reconnectHandlesVisible({ ...base, isJunctorEdge: true })).toBe(false);
    expect(reconnectHandlesVisible({ ...base, isMutex: true })).toBe(false);
  });

  it('hides them while a connection drag is in flight', () => {
    expect(reconnectHandlesVisible({ ...base, isConnecting: true })).toBe(false);
  });

  it('hides them under Browse Lock', () => {
    expect(reconnectHandlesVisible({ ...base, locked: true })).toBe(false);
  });
});
