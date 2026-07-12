import type { TPDocument } from '../types';
import { buildECPattern } from './ec-shared';

/**
 * Pattern: How to change — cautious vs aggressive rollout (Evaporating Cloud).
 *
 * The third of Barnard's three generic "core conflicts of change" in the *TOC
 * Handbook* (Ch. 15, "Continuous Improvement and Auditing"), covering when to
 * start and when to stop a change. Ongoing success needs both fully resourcing
 * every change and achieving the best results, and those needs pull toward
 * opposite rollout rhythms: start each change as late as possible and stop as
 * soon as possible (protect resources) versus start as soon as possible and
 * stop as late as possible (chase results). Completes the when/what/how set of
 * meta-clouds about the act of changing. Node text is original.
 */
export const buildPatternECHowToChange = (): TPDocument =>
  buildECPattern({
    title: 'How to change: cautious vs aggressive rollout (core conflict)',
    objective: 'Sustain ongoing success',
    need1: 'Fully resource every change',
    need2: 'Achieve the best results',
    want1: 'Start each change as late as possible and stop as soon as possible',
    want2: 'Start each change as soon as possible and stop as late as possible',
  });
