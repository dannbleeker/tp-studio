import type { TPDocument } from '../types';
import { buildECPattern } from './ec-shared';

/**
 * Pattern: Project task safety (Evaporating Cloud).
 *
 * The conflict behind Critical Chain. To deliver a project on time you must
 * both protect each task from its own uncertainty (pad every estimate) and
 * protect the whole project / finish fast (strip the task-level padding).
 * Assumption to break: that protecting each task protects the project — that
 * local safety sums to project safety. Injection: cut task estimates, aggregate
 * the safety into a shared project / feeding buffer, and manage by buffer
 * consumption rather than by per-task due dates.
 *
 * Published validation: Gupta & Kerrick, *Journal of International Technology
 * and Information Management* 23(3/4), 2014, work the same contingency-padding
 * conflict as a complete cloud — five entities, five surfaced assumptions
 * under the C→D′ arrow, and an injection re-shaping how delivery commitments
 * are evaluated. Independent confirmation of this pattern's shape; wording
 * here is TP Studio's own.
 */
export const buildPatternECProjectTaskSafety = (): TPDocument =>
  buildECPattern({
    title: 'Project task safety Evaporating Cloud',
    objective: 'Deliver the project on time',
    need1: 'Protect each task from its own uncertainty',
    need2: 'Protect the whole project and finish fast',
    want1: 'Pad every task estimate with safety',
    want2: 'Strip the task-level safety',
  });
