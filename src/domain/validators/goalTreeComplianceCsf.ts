import { entitiesOfType } from '../graph';
import type { TPDocument } from '../types';
import { makeWarning, type UntieredWarning } from './shared';

/**
 * Session 199 (backlog A1, Dettmer Ch. 19) — a law / regulation / compliance
 * condition set as a Critical Success Factor on a Goal Tree. Compliance is
 * almost always a *Necessary Condition* — a threshold you must not fall below —
 * rather than a make-or-break Critical Success Factor that the whole goal is
 * optimised around. Putting it at the CSF tier crowds out the handful of real
 * success drivers, so we nudge the user to demote it a few layers down.
 *
 * Heuristic, not NLP: a tight keyword scan scoped to Goal-Tree CSF titles
 * (mirrors `crt-ude-wording`). Tuned to keep false positives low — it's a soft,
 * resolvable clarity hint, so the occasional miss is fine.
 */
// Deliberately excludes the broad words "legal" / "lawful": a CSF like "Legal
// team fully staffed" is a genuine success driver, not a compliance threshold.
// The kept terms are specifically about meeting an external rule / standard.
const COMPLIANCE_PATTERN =
  /\b(compliance|compliant|comply|regulation|regulatory|regulations|statutory|statute|gdpr|hipaa|sarbanes|sox|audit(?:s|ed|ing)?|mandate[ds]?|accreditation|accredited|certification|certified)\b/i;

export const goalTreeComplianceCsfRule = (doc: TPDocument): UntieredWarning[] => {
  if (doc.diagramType !== 'goalTree') return [];
  const out: UntieredWarning[] = [];
  for (const csf of entitiesOfType(doc, 'criticalSuccessFactor')) {
    if (COMPLIANCE_PATTERN.test(csf.title)) {
      out.push(
        makeWarning(
          doc,
          'goalTree-compliance-csf',
          { kind: 'entity', id: csf.id },
          'goalTree-compliance-csf',
          { title: csf.title }
        )
      );
    }
  }
  return out;
};
