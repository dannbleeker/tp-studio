import { useEffect, useMemo, useState } from 'react';
import { anchoredAssumptionIds, placeAssumptionsNearEdges } from '@/domain/assumptionPlacement';
import { NODE_MIN_HEIGHT, NODE_WIDTH } from '@/domain/constants';
import { layoutFingerprint } from '@/domain/fingerprint';
import { edgesArray } from '@/domain/graph';
import { LAYOUT_STRATEGY } from '@/domain/layoutStrategy';
import { radialLayout } from '@/domain/radialLayout';
import type { TPDocument } from '@/domain/types';
import { useFingerprintMemo } from '@/hooks/useFingerprintMemo';
import { useDocumentStore } from '@/store';
import { COLLAPSED_HEIGHT, COLLAPSED_WIDTH, nodeSizeFor } from './graphViewConstants';
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
    layoutModulePromise = import('@/domain/layout')
      .then((m) => {
        layoutModule = m;
        return m;
      })
      .catch((err) => {
        // A failed dynamic import (a stale PWA chunk after a deploy, or a
        // transient network drop) must NOT stay cached — clearing the slot
        // lets the next layout trigger re-fetch instead of leaving the canvas
        // un-laid-out forever.
        layoutModulePromise = null;
        throw err;
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
  edges: { sourceId: string; targetId: string; isJunctor: boolean }[];
} => {
  const { visibleEntityIds, visibleCollapsedRoots, remap } = projection;
  // Z-3 — anchored assumptions are excluded from dagre (they're edge metadata,
  // not structural nodes; left in, each is an isolated component dagre dumps in
  // a far corner). `placeAssumptionsNearEdges` adds them back beside their edge.
  const skipAssumptions = anchoredAssumptionIds(doc);
  const entityIds = [...visibleEntityIds].filter((id) => !skipAssumptions.has(id));
  const nodes = [
    ...entityIds.map((id) => {
      const { width, height } = nodeSizeFor(doc, id) ?? {
        width: NODE_WIDTH,
        height: NODE_MIN_HEIGHT,
      };
      return { id, width, height };
    }),
    ...visibleCollapsedRoots.map((id) => {
      const { width, height } = nodeSizeFor(doc, id) ?? {
        width: COLLAPSED_WIDTH,
        height: COLLAPSED_HEIGHT,
      };
      return { id, width, height };
    }),
  ];
  // Remap + dedupe edges. dagre dedups silently, but keeping the set
  // we feed to the layout in sync with what we render avoids surprise
  // discrepancies if the algorithm ever starts caring about edge
  // multiplicity.
  const seen = new Set<string>();
  const edges: { sourceId: string; targetId: string; isJunctor: boolean }[] = [];
  for (const e of edgesArray(doc)) {
    const s = remap(e.sourceId);
    const t = remap(e.targetId);
    if (!s || !t || s === t) continue;
    const k = `${s}->${t}`;
    if (seen.has(k)) continue;
    seen.add(k);
    edges.push({
      sourceId: s,
      targetId: t,
      isJunctor: Boolean(e.andGroupId || e.orGroupId || e.xorGroupId),
    });
  }
  return { nodes, edges };
};

export const useGraphPositions = (doc: TPDocument, projection: GraphProjection): GraphPositions => {
  // F5: alternate-view toggle. Manual-layout diagrams (EC) ignore it — their
  // positions live on the entities themselves, not in a layout algorithm.
  const layoutMode = useDocumentStore((s) => s.layoutMode);
  // Session 136 — layout density multiplier (compact / balanced /
  // spacious). Applied per dagre call below; per-doc `layoutConfig`
  // overrides still win.
  const layoutDensity = useDocumentStore((s) => s.layoutDensity);
  // Hoist state is part of the layout cache key — a hoist swap should
  // recompute positions even when the underlying doc fingerprint hasn't
  // changed. Read it directly from the store (stable selector ref).
  const hoistedGroupId = useDocumentStore((s) => s.hoistedGroupId);

  const strategy = LAYOUT_STRATEGY[doc.diagramType];
  // Goal #4 — auto-layout is authoritative: `entity.position` is honored
  // ONLY for `manual` diagrams (EC), read directly in the manual branch
  // below. Auto diagrams (dagre + radial) ignore stored positions entirely
  // so the map is always a fresh balanced layout, so there's no pin-overlay
  // cache segment here — `layoutFingerprint` already encodes position
  // changes, which is all the manual (EC) memo needs to recompute.
  const fp = `${layoutFingerprint(doc)}|h:${hoistedGroupId ?? ''}|c:${[
    ...projection.proj.collapsedRoots,
  ]
    .sort()
    .join(
      ','
    )}|ec:${[...projection.hiddenCountByCollapser.keys()].sort().join(',')}|cfg:${layoutConfigKey(doc.layoutConfig)}|s:${strategy}|m:${layoutMode}`;

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
    // Auto-layout authoritative — radial output wins; stored positions ignored.
    return radialLayout(nodes, edges);
  }, `radial:${fp}`);

  // Dagre is heavy (~25 KB gzip). Lazy-load via `await import()` and
  // cache the resolved module module-level so subsequent renders are
  // effectively synchronous (a resolved Promise + setState round-trip).
  const [dagreState, setDagreState] = useState<{
    fp: string;
    density: typeof layoutDensity;
    data: GraphPositions;
  }>({
    fp: '',
    density: layoutDensity,
    data: {},
  });
  // Session 136 — density multipliers. `'compact'` pulls entities
  // closer, `'spacious'` loosens for projector mode. Applied as a
  // factor on top of `LAYOUT_RANK_SEPARATION` / `LAYOUT_NODE_SEPARATION`
  // (per-doc `layoutConfig.rankSep` / `.nodeSep` overrides still win).
  const densityMultiplier =
    layoutDensity === 'compact' ? 0.75 : layoutDensity === 'spacious' ? 1.5 : 1.0;
  // biome-ignore lint/correctness/useExhaustiveDependencies: by design — we re-run when the structural fingerprint OR the density preset changes; doc/projection/layoutMode are closed-over and read at effect time. Listing them as deps would re-fire the layout on title-only edits, defeating the fingerprint gate.
  useEffect(() => {
    if (strategy === 'manual') return;
    if (layoutMode === 'radial') return;
    if (dagreState.fp === fp && dagreState.density === layoutDensity) return;
    let cancelled = false;
    void (async () => {
      try {
        const mod = await loadLayoutModule();
        if (cancelled) return;
        const { nodes, edges } = buildLayoutInputs(doc, projection);
        const opts = mod.layoutConfigToOptions(doc.layoutConfig);
        // Apply the density multiplier only when the per-doc override
        // is absent; an explicit `layoutConfig.ranksep` (user dialed
        // the per-doc setting) wins as-is. Note the lowercase dagre-style
        // field names on `LayoutConfig` (per `types/document.ts`).
        if (doc.layoutConfig?.ranksep === undefined) {
          opts.rankSep = (opts.rankSep ?? 80) * densityMultiplier;
        }
        if (doc.layoutConfig?.nodesep === undefined) {
          opts.nodeSep = (opts.nodeSep ?? 32) * densityMultiplier;
        }
        const auto = mod.computeLayout(nodes, edges, opts);
        if (cancelled) return;
        // Auto-layout authoritative — dagre output wins; stored positions ignored.
        setDagreState({ fp, density: layoutDensity, data: auto });
      } catch {
        // The layout engine failed to load or compute. `loadLayoutModule` has
        // cleared its cache, so the next structural change re-attempts it;
        // until then the canvas shows un-laid-out positions rather than
        // throwing an unhandled rejection into the void.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [fp, layoutDensity]);

  // Signature of the assumption→edge anchor set — changes only when an
  // assumption is added / removed / re-homed (which don't advance the structural
  // layout fingerprint), so the placement memo re-runs on those. Record-canonical:
  // attachment lives on `doc.assumptions` (each record's `edgeId`), so the memo
  // narrows to that slice — a title-only edit (which flips `doc` but not
  // `doc.assumptions`) doesn't re-run this per keystroke.
  // biome-ignore lint/correctness/useExhaustiveDependencies: deliberately narrowed to `doc.assumptions`.
  const assumptionAnchorSig = useMemo(() => {
    const map = doc.assumptions;
    if (!map) return '';
    const parts: string[] = [];
    for (const a of Object.values(map)) parts.push(`${a.edgeId}:${a.id}`);
    return parts.sort().join('|');
  }, [doc.assumptions]);

  // Z-3 — augment the auto-layout (dagre/radial) with anchored-assumption cards
  // placed beside their edges. Manual diagrams (EC) already position assumptions
  // via `entity.position`, so they fall through untouched below.
  const autoBase = radialPositions ?? dagreState.data;
  // biome-ignore lint/correctness/useExhaustiveDependencies: recompute only when the laid-out base map or the anchor signature changes; doc is read at compute time, and keying on it would re-run on title-only edits that move nothing — defeating the layout fingerprint gate.
  const withAssumptions = useMemo(() => {
    if (Object.keys(autoBase).length === 0) return autoBase;
    const sizeOf = (id: string) =>
      nodeSizeFor(doc, id) ?? { width: NODE_WIDTH, height: NODE_MIN_HEIGHT };
    const placed = placeAssumptionsNearEdges(doc, autoBase, sizeOf);
    return Object.keys(placed).length > 0 ? { ...autoBase, ...placed } : autoBase;
  }, [autoBase, assumptionAnchorSig]);

  if (manualPositions) return manualPositions;
  return withAssumptions;
};
