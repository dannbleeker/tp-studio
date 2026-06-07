import { loopsWithPolarity } from '../loopAnalysis';
import type { TPDocument } from '../types';
import { makeWarning, type UntieredWarning } from './shared';

/**
 * Theme A / A4 (Session 180) — reinforcing-loop-with-no-delay nudge.
 *
 * A reinforcing feedback loop (R) is self-amplifying. With NO delay on any of its
 * edges it would, taken literally, escalate instantaneously — which is almost
 * never how a real system behaves; the lag is usually just un-modelled. This soft
 * clarity nudge asks the author whether a time delay is missing (mark the lagged
 * edge via the inspector / "Mark as delayed"). It goes silent as soon as any edge
 * in the loop carries a delay.
 *
 * Reuses the cached `loopsWithPolarity`; anchors the warning on the loop's closing
 * back-edge, where the R/B badge already sits.
 */
export const reinforcingNoDelayRule = (doc: TPDocument): UntieredWarning[] => {
  const out: UntieredWarning[] = [];
  for (const loop of loopsWithPolarity(doc)) {
    if (loop.polarity !== 'reinforcing') continue;
    if (loop.edgeIds.some((id) => doc.edges[id]?.delay === true)) continue;
    const target = loop.closingEdgeId ?? loop.edgeIds[0];
    if (!target) continue;
    out.push(
      makeWarning(
        doc,
        'reinforcing-no-delay',
        { kind: 'edge', id: target },
        'This reinforcing loop has no delay — taken literally it escalates instantly. Is a time lag missing? Mark the lagged edge as delayed.'
      )
    );
  }
  return out;
};
