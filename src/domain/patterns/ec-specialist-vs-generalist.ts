import type { TPDocument } from '../types';
import { buildECPattern } from './ec-shared';

/**
 * Pattern: Specialist vs generalist hiring (Evaporating Cloud).
 *
 * A team-composition EC for the recurring tension between hiring deep
 * specialists and hiring T-shaped generalists. Both camps argue from the same
 * goal and both have a legitimate Need; the conflict is in the specific hiring
 * action each Want demands. The value is showing the conflict isn't "deep vs
 * shallow knowledge" but "which scarcity hurts more right now".
 */
export const buildPatternECSpecialistVsGeneralist = (): TPDocument =>
  buildECPattern({
    title: 'Specialist vs generalist hiring EC',
    objective: 'Build a team that delivers reliably across a five-year horizon',
    need1: 'Get hard problems solved by someone who has solved them before',
    need2: "Be able to pivot the team to next year's unknown problem",
    want1: 'Hire a specialist with deep tenure in the current problem area',
    want2: 'Hire a generalist with a track record of picking up new domains',
  });
