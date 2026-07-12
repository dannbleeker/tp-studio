import type { TPDocument } from '../types';
import { buildSTFacetDoc } from './st-shared';

/**
 * Pattern: Healthcare Viable Vision (3-level Strategy & Tactics Tree, facet model).
 *
 * A Viable-Vision tree for a care provider (Handbook Ch. 31 appendix; the VV
 * method of Ch. 34/18), abstracted with original wording and no institution
 * names. Reaches an ambitious care vision — more patients treated to better
 * outcomes on the same beds and staff — by managing patient flow to the
 * bottleneck resource instead of adding capacity. Three levels deep, so its
 * middle step carries all four facets.
 */
export const buildPatternSTHealthcareViableVision = (): TPDocument =>
  buildSTFacetDoc('Healthcare Viable Vision S&T', {
    tactic:
      'Make patients flow to the bottleneck resource — synchronise the whole path to it instead of adding beds',
    strategy: 'The provider treats more patients to better outcomes on its current beds and staff',
    parallel:
      'The constraint is flow through a few bottleneck resources, not total bed count — smoothing the path beats buying capacity',
    sufficiency:
      'It needs both a working flow discipline AND the bottleneck kept free of avoidable load — hence the two sub-steps',
    children: [
      {
        // Middle step — parent + children, so all four facets.
        tactic: 'Manage a buffer of ready patients ahead of the bottleneck and schedule to it',
        strategy:
          'The bottleneck resource is never starved and never swamped, so it runs at a steady pace',
        necessary:
          'Scheduling each department to its own local efficiency is what creates the queues and idle gaps the vision must remove',
        parallel:
          'A buffer sized to real variability beats a packed master schedule — it absorbs the surprises that stall the path',
        sufficiency:
          'The discipline has to be proven on one pathway and then spread — hence the two sub-steps',
        children: [
          {
            tactic:
              'Pilot buffer-driven flow on one high-volume pathway and tune the buffer to real variation',
            strategy:
              'One pathway runs on a tuned buffer with shorter waits and steadier throughput',
            necessary:
              'Spreading an untuned buffer everywhere at once multiplies a sizing error across every unit',
            parallel:
              'Proving it on one pathway first beats an org-wide launch — the buffer size is learned cheaply and safely',
          },
          {
            tactic: 'Spread the proven flow discipline pathway by pathway on the tuned buffers',
            strategy:
              'Every major pathway runs on the same buffer-driven schedule to the bottleneck',
            necessary:
              'A partial rollout leaves local-efficiency scheduling upstream fighting the buffer discipline downstream',
            parallel:
              'Pathway by pathway on proven buffers beats all-at-once — it keeps clinical risk bounded while it spreads',
          },
        ],
      },
      {
        // Leaf — parent, no children, so no sufficiency assumption.
        tactic:
          'Offload from the bottleneck every task that a non-bottleneck resource can do instead',
        strategy: 'The bottleneck resource spends its time only on work nothing else can do',
        necessary:
          'If the bottleneck keeps doing offloadable work, the flow discipline is choked at the very point it depends on',
        parallel:
          'Shifting work off the constraint is far cheaper than expanding it — an hour freed there is an hour of extra system throughput',
      },
    ],
  });
