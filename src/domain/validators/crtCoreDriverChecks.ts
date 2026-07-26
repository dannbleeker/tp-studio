import { findCoreDrivers } from '../coreDriver';
import { entitiesOfType } from '../graph';
import type { TPDocument } from '../types';
import { makeWarning, makeWarningAction, type UntieredWarning } from './shared';

/**
 * Session 179 (Theme B) — two diagnostic nudges built on `findCoreDrivers`,
 * both scoped to CRT. They reuse the already-cached UDE-reach computation, so
 * they cost almost nothing on top of the Core Driver analysis the UI runs.
 */

const MIN_UDES_FOR_COVERAGE = 3;
const COVERAGE_THRESHOLD = 0.5;

/**
 * The leading root cause explains too few UDEs. CRT heuristic: a good core
 * driver reaches the majority of UDEs. When the top candidate covers less than
 * half (and there are ≥3 UDEs to make the ratio meaningful), the tree is
 * probably fragmented into independent clusters, or some UDEs aren't connected.
 */
export const crtLowCoreDriverCoverageRule = (doc: TPDocument): UntieredWarning[] => {
  if (doc.diagramType !== 'crt') return [];
  const totalUdes = entitiesOfType(doc, 'ude').length;
  if (totalUdes < MIN_UDES_FOR_COVERAGE) return [];
  const top = findCoreDrivers(doc)[0];
  if (!top) return [];
  if (top.reachedUdeCount / totalUdes >= COVERAGE_THRESHOLD) return [];
  const pct = Math.round((top.reachedUdeCount / totalUdes) * 100);
  return [
    makeWarning(
      doc,
      'crt-low-core-driver-coverage',
      { kind: 'entity', id: top.entity.id },
      'crt-low-core-driver-coverage',
      { reached: top.reachedUdeCount, total: totalUdes, pct }
    ),
  ];
};

/**
 * Two root causes tie for the most UDEs. When the top two candidates reach an
 * equal number of UDEs, no single core driver has emerged — often a sign that
 * a conflict (an Evaporating Cloud) sits beneath the tree. A nudge, not a
 * defect. Requires the tie to cover at least two UDEs so it doesn't fire on
 * trivial 1-UDE-each scaffolds.
 */
export const crtTiedCoreDriversRule = (doc: TPDocument): UntieredWarning[] => {
  if (doc.diagramType !== 'crt') return [];
  const [first, second] = findCoreDrivers(doc);
  if (!first || !second) return [];
  if (first.reachedUdeCount !== second.reachedUdeCount) return [];
  if (first.reachedUdeCount < 2) return [];
  return [
    {
      ...makeWarning(
        doc,
        'crt-tied-core-drivers',
        { kind: 'entity', id: first.entity.id },
        'crt-tied-core-drivers',
        { count: first.reachedUdeCount }
      ),
      // One-click remedy: seed an EC from this conflict candidate (handled by
      // the WARNING_ACTIONS registry, reusing the spawn-EC flow).
      action: makeWarningAction('spawn-ec-from-conflict'),
    },
  ];
};
