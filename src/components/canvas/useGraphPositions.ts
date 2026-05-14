import { NODE_MIN_HEIGHT, NODE_WIDTH, ST_NODE_HEIGHT } from '@/domain/constants';
import { layoutFingerprint } from '@/domain/fingerprint';
import { isStNodeFormat, pinnedEntities } from '@/domain/graph';
import { LAYOUT_STRATEGY } from '@/domain/layoutStrategy';
import { radialLayout } from '@/domain/radialLayout';
import type { TPDocument } from '@/domain/types';
import { useFingerprintMemo } from '@/hooks/useFingerprintMemo';
import { useDocumentStore } from '@/store';
import { useEffect, useState } from 'react';
import { COLLAPSED_HEIGHT, COLLAPSED_WIDTH } from './graphViewConstants';
import type { GraphProjection } from './useGraphProjection';

/**
 * Stable cache-key string for the per-doc `LayoutConfig`. Threading
 * `JSON.stringify(layoutConfig)` directly into the memo's deps would
 * stringify on every render; this helper makes the intent explicit and
 * lets the memo dependency stay shallow.
 */
const layoutConfigKey = (cfg: TPDocument['layoutConfig']): string =>
  cfg ? `${cfg.direction ?? ''}|${cfg.nodesep ?? ''}|${cfg.ranksep ?? ''}|${cfg.align ?? ''}` : '';

/**
 * Stage 2 of the three-stage `useGraphView` pipeline.
 *
 * Run dagre (or radial, or read-stored-position for manual-layout diagrams)
 * over the projected visible-entity + visible-collapsed-root set, and return
 * an `id → {x, y}` map.
 *
 * Gating by `layoutFingerprint(doc)` is the win: title and description edits
 * (the high-frequency mutations) don't change the structural fingerprint, so
 * the memo short-circuits and dagre doesn't re-run. Add/remove/connect ops
 * advance the fingerprint and the layout recomputes. Manual diagrams skip
 * layout entirely and read `Entity.position` directly.
 *
 * Session 81 — dagre is now lazy-loaded. `@/domain/layout` (which pulls
 * in the dagre dependency, ~25 KB gzipped) is `await import()`-ed inside
 * an effect rather than statically imported at module top. The first
 * paint on a cold app load briefly shows an empty position map; once
 * dagre arrives (resolved within one paint frame thanks to Vite's
 * preload hints), the hook returns real positions. Manual-layout
 * diagrams (Evaporating Cloud) stay fully synchronous because their
 * positions come from `entity.position` and never need dagre.
 */
export type GraphPositions = Record<string, { x: number; y: number }>;

/**
 * Module-level cache of the resolved layout module. Once loaded, every
 * subsequent hook call gets the same instance immediately — no re-import
 * round-trip. The first call kicks off the import and stores the promise
 * so concurrent first-renders coalesce onto a single fetch.
 */
type LayoutModule = typeof import('@/domain/layout');
let layoutModule: LayoutModule | null = null;
let layoutModulePromise: Promise<LayoutModule> | null = null;
const loadLayoutModule = (): Promise<LayoutModule> => {
  if (layoutModule) return Promise.resolve(layoutModule);
  if (!layoutModulePromise) {
    layoutModulePromise = import('@/domain/layout').then((m) => {
      layoutModule = m;
      return m;
    });
  }
  return layoutModulePromise;
};

/**
 * Build the per-node + per-edge inputs the layout engine expects from
 * the projected visible set. Pulled out of both the sync and async
 * branches so the geometry stays in lockstep.
 */
const buildLayoutInputs = (
  doc: TPDocument,
  projection: GraphProjection
): {
  nodes: { id: string; width: number; height: number }[];
  edges: { sourceId: string; targetId: string }[];
} => {
  const { visibleEntityIds, visibleCollapsedRoots, remap } = projection;
  const nodes = [
    ...[...visibleEntityIds].map((id) => {
      const entity = doc.entities[id];
      const height = entity && isStNodeFormat(entity) ? ST_NODE_HEIGHT : NODE_MIN_HEIGHT;
      return { id, width: NODE_WIDTH, height };
    }),
    ...visibleCollapsedRoots.map((id) => ({
      id,
      width: COLLAPSED_WIDTH,
      height: COLLAPSED_HEIGHT,
    })),
  ];
  // Remap + dedupe edges. dagre dedups silently, but keeping the set
  // we feed to the layout in sync with what we render avoids surprise
  // discrepancies if the algorithm ever starts caring about edge
  // multiplicity.
  const seen = new Set<string>();
  const edges: { sourceId: string; targetId: string }[] = [];
  for (const e of Object.values(doc.edges)) {
    const s = remap(e.sourceId);
    const t = remap(e.targetId);
    if (!s || !t || s === t) continue;
    const k = `${s}->${t}`;
    if (seen.has(k)) continue;
    seen.add(k);
    edges.push({ sourceId: s, targetId: t });
  }
  return { nodes, edges };
};

/** Overlay LA5 pinned positions on top of an auto-layout result. */
const overlayPinned = (
  doc: TPDocument,
  projection: GraphProjection,
  base: GraphPositions
): GraphPositions => {
  const out: GraphPositions = { ...base };
  for (const id of projection.visibleEntityIds) {
    const e = doc.entities[id];
    if (e?.position) out[id] = e.position;
  }
  return out;
};

export const useGraphPositions = (doc: TPDocument, projection: GraphProjection): GraphPositions => {
  // F5: alternate-view toggle. Manual-layout diagrams (EC) ignore it — their
  // positions live on the entities themselves, not in a layout algorithm.
  const layoutMode = useDocumentStore((s) => s.layoutMode);
  // Hoist state is part of the layout cache key — a hoist swap should
  // recompute positions even when the underlying doc fingerprint hasn't
  // changed. Read it directly from the store (stable selector ref).
  const hoistedGroupId = useDocumentStore((s) => s.hoistedGroupId);

  const strategy = LAYOUT_STRATEGY[doc.diagramType];
  // LA5 cache-key segment: hash of pinned-entity positions. Auto-layout
  // diagrams now honor `entity.position` as a pin override on top of
  // dagre's output; a position change to a pinned entity must invalidate
  // the memo so the overlay re-applies. Sorted-string form so order
  // doesn't flap the key. Empty when no entity is pinned, which is the
  // common case on fresh CRT/FRT/PRT/TT docs.
  const pinnedKey = pinnedEntities(doc)
    .map((e) => `${e.id}:${e.position?.x},${e.position?.y}`)
    .sort()
    .join('|');
  const fp = `${layoutFingerprint(doc)}|h:${hoistedGroupId ?? ''}|c:${[
    ...projection.proj.collapsedRoots,
  ]
    .sort()
    .join(
      ','
    )}|ec:${[...projection.hiddenCountByCollapser.keys()].sort().join(',')}|cfg:${layoutConfigKey(doc.layoutConfig)}|p:${pinnedKey}|s:${strategy}|m:${layoutMode}`;

  // Manual-layout diagrams (Evaporating Cloud) skip the layout engine
  // entirely: positions live on the entities themselves. Compute
  // synchronously via useMemo so EC users never see an empty-position
  // first paint.
  const manualPositions = useFingerprintMemo(() => {
    if (strategy !== 'manual') return null;
    const out: GraphPositions = {};
    for (const id of projection.visibleEntityIds) {
      const e = doc.entities[id];
      out[id] = e?.position ?? { x: 0, y: 0 };
    }
    for (const id of projection.visibleCollapsedRoots) out[id] = { x: 0, y: 0 };
    return out;
  }, `manual:${fp}`);

  // Radial layout is a small hand-rolled algorithm (no dagre dep) so it
  // can also run synchronously.
  const radialPositions = useFingerprintMemo(() => {
    if (strategy === 'manual' || layoutMode !== 'radial') return null;
    const { nodes, edges } = buildLayoutInputs(doc, projection);
    const auto = radialLayout(nodes, edges);
    return overlayPinned(doc, projection, auto);
  }, `radial:${fp}`);

  // Dagre is heavy (~25 KB gzip). Lazy-load via `await import()` and
  // cache the resolved module module-level so subsequent renders are
  // effectively synchronous (a resolved Promise + setState round-trip).
  const [dagreState, setDagreState] = useState<{ fp: string; data: GraphPositions }>({
    fp: '',
    data: {},
  });
  // biome-ignore lint/correctness/useExhaustiveDependencies: by design — we re-run when the structural fingerprint changes; doc/projection/layoutMode are closed-over and read at effect time. Listing them as deps would re-fire the layout on title-only edits, defeating the fingerprint gate.
  useEffect(() => {
    if (strategy === 'manual') return;
    if (layoutMode === 'radial') return;
    if (dagreState.fp === fp) return;
    let cancelled = false;
    void (async () => {
      const mod = await loadLayoutModule();
      if (cancelled) return;
      const { nodes, edges } = buildLayoutInputs(doc, projection);
      const auto = mod.computeLayout(nodes, edges, mod.layoutConfigToOptions(doc.layoutConfig));
      if (cancelled) return;
      setDagreState({ fp, data: overlayPinned(doc, projection, auto) });
    })();
    return () => {
      cancelled = true;
    };
  }, [fp]);

  if (manualPositions) return manualPositions;
  if (radialPositions) return radialPositions;
  return dagreState.data;
};
