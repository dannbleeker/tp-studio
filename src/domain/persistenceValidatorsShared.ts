/**
 * Shared low-level helpers for the persistence validators. A dependency-free
 * leaf so both the strict member validators (`persistenceValidators.ts`) and the
 * strict field validators (`persistenceFieldValidators.ts`) can use them without
 * a cycle.
 *
 * Split out of `persistenceValidators.ts` (Session 164).
 */

/** Build the canonical "Invalid document: <label> <why>." error. */
export const invalid = (label: string, why: string): Error =>
  new Error(`Invalid document: ${label} ${why}.`);

// A finite number — rejects NaN / ±Infinity, which pass a bare
// `typeof === 'number'` check and then poison sorts (`a - b`) and break
// geometry/bounds math downstream.
export const isFiniteNumber = (v: unknown): v is number =>
  typeof v === 'number' && Number.isFinite(v);
