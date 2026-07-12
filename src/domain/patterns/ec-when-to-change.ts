import type { TPDocument } from '../types';
import { buildECPattern } from './ec-shared';

/**
 * Pattern: When to change — change now vs not yet (Evaporating Cloud).
 *
 * The first of Barnard's three generic "core conflicts of change" in the *TOC
 * Handbook* (Ch. 15, "Continuous Improvement and Auditing") — a meta-cloud
 * about the act of changing itself, one level above the domain clouds in the
 * library. Ongoing success needs both improving performance now and holding
 * stability, and those needs push toward opposite decisions about whether to
 * change now. Paired with the what-to-change and how-to-change clouds, it is a
 * fast diagnostic for a team paralysed by the fear of changing. Node text is
 * original.
 */
export const buildPatternECWhenToChange = (): TPDocument =>
  buildECPattern({
    title: 'When to change: now vs not yet (core conflict)',
    objective: 'Sustain ongoing success',
    need1: 'Improve performance now and halt the decay',
    need2: 'Maintain stability and security',
    want1: 'Change now',
    want2: "Hold off — don't change now",
  });
