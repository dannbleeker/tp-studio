import type { TPDocument } from '../types';
import { buildECPattern } from './ec-shared';

/**
 * Pattern: Delegation (Evaporating Cloud).
 *
 * An everyday-management cloud. To lead a team that both delivers and grows, a
 * manager must both develop their people (let them do the work) and guarantee
 * the result (do the critical work themselves). Assumption to break: that an
 * important result can't be trusted to someone still learning. Injection:
 * scaffold the delegation — a clear definition of done, checkpoints, and
 * reversible steps — so developing people and protecting the outcome stop
 * competing.
 */
export const buildPatternECDelegation = (): TPDocument =>
  buildECPattern({
    title: 'Delegation Evaporating Cloud',
    objective: 'Lead a team that delivers and grows',
    need1: 'Develop my people',
    need2: 'Guarantee the result',
    want1: 'Let them do the work themselves',
    want2: 'Do the critical work myself',
  });
