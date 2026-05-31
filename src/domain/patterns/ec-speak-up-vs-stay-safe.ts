import type { TPDocument } from '../types';
import { buildECPattern } from './ec-shared';

/**
 * Pattern: Speak up vs stay safe (Evaporating Cloud).
 *
 * The identity-protection instance of Efrat's generic change cloud: a person on
 * a team needs to protect their own standing AND wants the team to fix the real
 * problems — the first pulls toward keeping quiet, the second toward naming the
 * hard issues. The everyday face of "resistance to change", surfacing wherever
 * psychological safety is thin.
 */
export const buildPatternECSpeakUpVsStaySafe = (): TPDocument =>
  buildECPattern({
    title: 'Speak up vs stay safe Evaporating Cloud',
    objective: 'The team does its best work and I belong in it',
    need1: 'Protect my standing on the team',
    need2: 'Get the real problems on the table',
    want1: 'Keep quiet about the hard issues',
    want2: 'Name the hard issues openly',
  });
