import type { TPDocument } from '../types';
import { buildECPattern } from './ec-shared';

/**
 * Pattern: What to change — only what must vs all that can (Evaporating Cloud).
 *
 * The second of Barnard's three generic "core conflicts of change" in the *TOC
 * Handbook* (Ch. 15, "Continuous Improvement and Auditing"). Ongoing success
 * needs both not wasting scarce resources and capitalising on every
 * opportunity, and those needs pull toward opposite decisions about how much to
 * take on: improve only what must be improved, or improve everything that can
 * be. The break is acknowledging that scarce resources — especially management
 * time — must be focused on the few high-leverage points. Node text is
 * original.
 */
export const buildPatternECWhatToChange = (): TPDocument =>
  buildECPattern({
    title: 'What to change: only what must vs all that can (core conflict)',
    objective: 'Sustain ongoing success',
    need1: 'Not waste scarce resources',
    need2: 'Capitalise on every opportunity',
    want1: 'Improve only what must be improved',
    want2: 'Improve everything that can be improved',
  });
