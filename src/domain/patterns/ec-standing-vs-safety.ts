import type { TPDocument } from '../types';
import { buildECPattern } from './ec-shared';

/**
 * Pattern: Assert standing vs stay safe (Evaporating Cloud).
 *
 * The group-bullying conflict from the *TOC Handbook* (Ch. 26, "TOC for
 * Education", Suerken) — when groups of students haze others, the cloud reveals
 * that the standing the ringleaders are chasing is itself put at risk by the
 * hazing. One side hazes to assert standing among peers; the other refuses, to
 * stay safe; both, at bottom, want to be set up well for their future. A
 * teaching example of a conflict where the "winning" action undermines the very
 * need it serves. Node text is original; no names.
 */
export const buildPatternECStandingVsSafety = (): TPDocument =>
  buildECPattern({
    title: 'Assert standing vs stay safe (bullying cloud)',
    objective: 'Be set up well for my future',
    need1: 'Have standing and authority among my peers',
    need2: 'Be safe',
    want1: 'Haze other students',
    want2: 'Refuse to haze others',
  });
