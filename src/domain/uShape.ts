import { buildEntity } from './examples/shared';
import { createDocument } from './factory';
import type { EntityId, TPDocument } from './types';

/**
 * Phase 2b (TP completeness #2 — U-Shape linkage) — pure builders for the
 * guided "build the next step" helpers. Each returns a fresh document plus the
 * id of the **anchor entity** the caller links back to the source (so the
 * U-Shape thread is reciprocal). The store action owns the linking + tab-open;
 * these stay pure (no store, no `Date.now()` beyond the factory's own stamp) so
 * they're trivially unit-testable.
 *
 * Cohen's journey: a CRT **core problem** → its **Core Cloud** (EC) → an FRT
 * **injection**. These two builders bootstrap the second and third hops.
 */

/**
 * A Core Cloud (Evaporating Cloud) seeded from a CRT core problem. Reuses the
 * blank 5-box EC scaffold (`createDocument('ec')`), titles the doc after the
 * problem, and pre-tags it `cloudType: 'core'` (Phase 1). The **anchor** is box
 * A (the shared objective, `ecSlot: 'a'`) — the natural hinge to link back to
 * the originating problem.
 */
export const buildCoreCloudSeed = (problem: string): { doc: TPDocument; anchorId: EntityId } => {
  const base = createDocument('ec');
  const anchor = Object.values(base.entities).find((e) => e.ecSlot === 'a');
  if (!anchor) throw new Error('EC seed is missing its objective box');
  return {
    doc: { ...base, title: `Core Cloud — ${problem}`, cloudType: 'core' },
    anchorId: anchor.id,
  };
};

/**
 * A Future Reality Tree seeded with one **injection** entity (the breakthrough
 * being carried forward from an EC). The injection is the **anchor** linked
 * back to the source.
 */
export const buildInjectionFRTSeed = (
  injection: string
): { doc: TPDocument; anchorId: EntityId } => {
  const base = createDocument('frt');
  const inj = buildEntity('injection', injection, base.createdAt, 1);
  return {
    doc: {
      ...base,
      title: `FRT — ${injection}`,
      entities: { [inj.id]: inj },
      nextAnnotationNumber: 2,
    },
    anchorId: inj.id,
  };
};
