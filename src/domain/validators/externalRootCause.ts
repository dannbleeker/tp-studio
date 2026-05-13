import type { TPDocument } from '../types';
import { type UntieredWarning, makeWarning } from './shared';

/**
 * Mental-model CLR nudge (TOC-reading): a root cause flagged
 * `spanOfControl: 'external'` is almost never the real root. CRT Step 7
 * tells the user to "build down to causes you actually control or
 * influence" — an external cause means "this thing is hitting us from
 * outside the system" and the chain should usually go deeper into
 * something we can actually act on.
 *
 * Fires on `rootCause`-typed entities (FRT injections and other types are
 * exempt — being external is sometimes the *point* there). Tier: clarity
 * because the question is "have you stated this in a way you can act on?"
 * rather than "does this entity exist?"
 *
 * The user resolves the warning by either:
 *   - Pushing the chain deeper to a controllable cause, OR
 *   - Acknowledging the warning explicitly (existing `resolvedWarnings`
 *     mechanism), which records "yes, the external framing is intentional."
 */
export const externalRootCauseRule = (doc: TPDocument): UntieredWarning[] => {
  const out: UntieredWarning[] = [];
  for (const e of Object.values(doc.entities)) {
    if (e.type !== 'rootCause') continue;
    if (e.spanOfControl !== 'external') continue;
    out.push(
      makeWarning(
        doc,
        'external-root-cause',
        { kind: 'entity', id: e.id },
        'Root cause flagged as external — is it really the root? Keep digging toward something you control or influence.'
      )
    );
  }
  return out;
};
