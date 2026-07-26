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
  params?: ClrParams,
  fallback = ''
): string => {
  // Widened to include `undefined` on purpose. `Messages` makes a missing key
  // a compile error, so this branch is unreachable for a catalogue that went
  // through `tsc` — but `Warning.message` documents a runtime fallback
  // contract, and without this the contract was a comment rather than
  // behaviour: a hand-authored or JSON-loaded locale with a hole would render
  // the literal `undefined`.
  const entry: string | ((p: ClrParams) => string) | undefined = messages.clr[key];
  // Static entries are plain strings; interpolated ones are arrows.
  if (typeof entry === 'function') return entry(params ?? {});
  return entry ?? fallback;
};

/** Render a one-click remedy label from its `WarningAction.actionId`. */
export const resolveClrActionLabel = (
  messages: Messages,
  actionId: ClrActionId,
  fallback = ''
): string => messages.clrAction[actionId] ?? fallback;
