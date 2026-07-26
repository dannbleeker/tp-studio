import type { ClrActionId, ClrMessageKey, ClrParams, Messages } from './types';

/**
 * Render a CLR warning's copy from its `(messageKey, params)` pair.
 *
 * This is the seam that keeps `validate()` locale-free. `validate()` is
 * memoized twice — a `WeakMap<TPDocument, Warning[]>` plus a fingerprint LRU
 * in `src/domain/validators/index.ts` — so threading a catalogue into it would
 * mean keying both caches on the locale as well as the document. Emitting a
 * serializable key and resolving it here costs nothing and leaves both caches
 * keyed on the document alone.
 */
export const resolveClrMessage = (
  messages: Messages,
  key: ClrMessageKey,
  params?: ClrParams
): string => {
  const entry = messages.clr[key];
  // Static entries are plain strings; interpolated ones are arrows. No cast
  // is needed — every function in the CLR section takes `ClrParams`, so the
  // narrowed union is directly callable.
  return typeof entry === 'function' ? entry(params ?? {}) : entry;
};

/** Render a one-click remedy label from its `WarningAction.actionId`. */
export const resolveClrActionLabel = (messages: Messages, actionId: ClrActionId): string =>
  messages.clrAction[actionId];
