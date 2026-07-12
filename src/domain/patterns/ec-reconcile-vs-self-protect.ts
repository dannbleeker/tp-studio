import type { TPDocument } from '../types';
import { buildECPattern } from './ec-shared';

/**
 * Pattern: Reconcile vs protect myself (Evaporating Cloud).
 *
 * A family-reconciliation conflict from the *TOC Handbook* (Ch. 27, "TOC in
 * Prisons", Cheng), abstracted from an inmate's estrangement from a parent: one
 * side reaches out to rebuild the relationship, the other keeps their distance
 * to avoid being hurt again, and both, underneath, want to be happy together.
 * The chapter's insight is that the guarded party's silence often reads as
 * rejection when it is really self-protection — reframing the other side's need
 * opens the way to reconcile. Node text is original; no personal identifiers or
 * story retelling.
 */
export const buildPatternECReconcileVsSelfProtect = (): TPDocument =>
  buildECPattern({
    title: 'Reconcile vs protect myself (family cloud)',
    objective: 'Be happy together again',
    need1: 'Settle things and be close again',
    need2: 'Protect myself from being hurt again',
    want1: 'Reach out and try to win back their affection',
    want2: "Keep my distance until I'm sure it's safe",
    assumptions: [
      {
        arrow: 'd-b',
        text: 'No one can replace this relationship — I have to show I really mean it and won’t disappoint again.',
      },
      {
        arrow: 'dPrime-c',
        text: 'Giving them room to prove themselves is how they learn the lesson and how I avoid being hurt again.',
      },
    ],
  });
