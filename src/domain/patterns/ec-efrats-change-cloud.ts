import type { TPDocument } from '../types';
import { buildECPattern } from './ec-shared';

/**
 * Pattern: Resistance to change — Efrat's generic cloud (Evaporating Cloud).
 *
 * The universal "why we resist change even when we want it" conflict, after
 * Efrat Goldratt-Ashlag's generic cloud: a person simultaneously needs to
 * protect their own standing AND wants the system to improve, and those needs
 * drive opposite actions — keep the familiar way (feels safe) vs. change (what
 * the system needs). The most-reached-for cloud in buy-in / facilitation work,
 * and the companion to Goldratt's Change Matrix.
 */
export const buildPatternECEfratsChangeCloud = (): TPDocument =>
  buildECPattern({
    title: "Resistance to change (Efrat's cloud)",
    objective: 'The organisation thrives — and I thrive with it',
    need1: 'Protect my standing and sense of security',
    need2: 'Let the organisation adapt and improve',
    want1: 'Keep working the way we always have',
    want2: 'Change how we work',
  });
