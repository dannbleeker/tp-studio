import type { TPDocument } from '../types';
import { buildECPattern } from './ec-shared';

/**
 * Firefighting (Lieutenant) Cloud — the symptom-vs-cause trap that keeps a team
 * reacting: stop the pain now vs. stop it from coming back. Cohen's recurring
 * cloud for an organisation stuck in perpetual firefighting. Original content.
 */
export const buildPatternCloudFirefighting = (): TPDocument =>
  buildECPattern({
    title: 'Firefighting cloud — fix now vs. fix the cause',
    cloudType: 'firefighting',
    objective: 'Keep the system running smoothly',
    need1: "Stop today's problem from hurting us right now",
    need2: 'Stop the same problem from coming back',
    want1: 'Drop everything and patch the symptom immediately',
    want2: 'Pause to find and remove the underlying cause',
  });
