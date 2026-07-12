import type { TPDocument } from '../types';
import { buildSTFacetDoc } from './st-shared';

/**
 * Pattern: Mafia Offer — Projects (Strategy & Tactics Tree, facet model).
 *
 * The Ch. 22 (Lang) un-refusable-offer family applied to a project / engineering
 * firm, abstracted with original wording. The buyer's real pain on a project isn't
 * price — it's the schedule slipping. The un-refusable offer is a credible on-time
 * guarantee, backed by a delivery discipline that makes the promise real rather
 * than a gamble. Two-leaf facet tree on the corrected directional model.
 */
export const buildPatternSTMafiaProjects = (): TPDocument =>
  buildSTFacetDoc('Mafia Offer — Projects S&T', {
    tactic: 'Offer a firm delivery date backed by a penalty — pay the premium only if we hit it',
    strategy: 'Buyers choose us because we sell schedule certainty no rival will underwrite',
    parallel:
      'Competing on price or a soft promise leaves the buyer’s schedule risk untouched — a date they can bank on, backed by a penalty, beats a lower bid they can’t',
    sufficiency:
      'A date we can only sometimes hit is a liability, not an offer — we must both protect each project AND not overload the pipeline — hence the two sub-steps',
    children: [
      {
        tactic: 'Run each project on a single shared buffer instead of padding every task',
        strategy:
          'A project finishes on its committed date without task-level padding hiding the slack',
        necessary:
          'A penalty-backed date can’t survive normal task variation on hope alone — without a real protection mechanism the guarantee is too risky to offer',
        parallel:
          'One aggregated project buffer beats padding every task — pooled protection is smaller and actually shields the finish',
      },
      {
        tactic: 'Release new projects to the capacity constraint, not to whoever is asking',
        strategy: 'Work in progress is capped so no project starves for the resource it needs',
        necessary:
          'Starting every won project at once overloads the shared constraint and makes every date unreliable at the same time',
        parallel:
          'Staggering starts to the constraint beats launching on demand — throughput rises when the bottleneck is not thrashed',
      },
    ],
  });
