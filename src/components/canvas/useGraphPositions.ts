import { NODE_MIN_HEIGHT, NODE_WIDTH, ST_NODE_HEIGHT } from '@/domain/constants';
import { layoutFingerprint } from '@/domain/fingerprint';
import { isStNodeFormat, pinnedEntities } from '@/domain/graph';
import { computeLayout, layoutConfigToOptions } from '@/domain/layout';
import { LAYOUT_STRATEGY } from '@/domain/layoutStrategy';
import { radialLayout } from '@/domain/radialLayout';
import type { TPDocument } from '@/domain/types';
import { useFingerprintMemo } from '@/hooks/useFingerprintMemo';
import { useDocumentStore } from '@/store';
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
 */
export type GraphPositions = Record<string, { x: number; y: number }>;

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
  // Cache key matches the original monolithic `useGraphView` exactly to
  // preserve behavior (and avoid spurious dagre re-runs on UI-only changes).
  // `cfg` was added in Block A so a Settings tweak (direction / compactness /
  // bias) re-runs dagre even when nothing structural changed.
  // `p` (Session 63) is the LA5 pinned-positions hash.
  // The fingerprint folds in everything that should re-run layout —
  // structural doc state (`layoutFingerprint`), the hoist target, the
  // visible-collapsed set, the layout config, the LA5 pin map, plus the
  // local view-state (`strategy`, `layoutMode`) that the `useMemo` body
  // closes over. Using `useFingerprintMemo` makes the contract explicit
  // and removes the `useExhaustiveDependencies` ignore that previously
  // covered all of this.
  const fp = `${layoutFingerprint(doc)}|h:${hoistedGroupId ?? ''}|c:${[
    ...projection.proj.collapsedRoots,
  ]
    .sort()
    .join(
      ','
    )}|ec:${[...projection.hiddenCountByCollapser.keys()].sort().join(',')}|cfg:${layoutConfigKey(doc.layoutConfig)}|p:${pinnedKey}|s:${strategy}|m:${layoutMode}`;

  return useFingerprintMemo(() => {
    const { visibleEntityIds, visibleCollapsedRoots, remap } = projection;
    // Manual-layout diagrams (Evaporating Cloud will be the first): skip
    // dagre, read each entity's stored `position`, fall back to {0,0} for
    // entities that haven't been positioned yet. Collapsed-root cards aren't
    // expected here today — manual diagrams don't have groups — but if they
    // ever appear we treat them like any unpositioned entity.
    if (strategy === 'manual') {
      const out: GraphPositions = {};
      for (const id of visibleEntityIds) {
        const e = doc.entities[id];
        out[id] = e?.position ?? { x: 0, y: 0 };
      }
      for (const id of visibleCollapsedRoots) out[id] = { x: 0, y: 0 };
      return out;
    }
    const layoutNodes = [
      ...[...visibleEntityIds].map((id) => {
        // Session 76: S&T-format injections render as taller 5-facet
        // cards. Pass the correct height to dagre so layout math accounts
        // for the bigger box; the regular nodes stay at NODE_MIN_HEIGHT.
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
    // Remap + aggregate edges for layout (dagre dedups silently anyway, but
    // aggregating here keeps `positions` consistent with what we render).
    const seen = new Set<string>();
    const layoutEdges: { sourceId: string; targetId: string }[] = [];
    for (const e of Object.values(doc.edges)) {
      const s = remap(e.sourceId);
      const t = remap(e.targetId);
      if (!s || !t || s === t) continue;
      const k = `${s}->${t}`;
      if (seen.has(k)) continue;
      seen.add(k);
      layoutEdges.push({ sourceId: s, targetId: t });
    }
    // Block A: thread the per-doc LayoutConfig through the dagre call.
    // Radial layout ignores the config — `align` etc. aren't meaningful for
    // a ring placement. The user's choice resurfaces when they toggle back
    // to flow mode.
    const auto =
      layoutMode === 'radial'
        ? radialLayout(layoutNodes, layoutEdges)
        : computeLayout(layoutNodes, layoutEdges, layoutConfigToOptions(doc.layoutConfig));
    // LA5: overlay pinned positions onto dagre's / radial's output. A user
    // drag on an auto-layout diagram persists `entity.position`; we honor
    // that as a fixed pin so dagre handles the unpinned majority while the
    // user keeps coordinate control over the entities that matter. React
    // Flow reroutes edges from the overridden node centers at render time,
    // so no per-edge geometry recompute is needed here.
    const out: GraphPositions = { ...auto };
    for (const id of visibleEntityIds) {
      const e = doc.entities[id];
      if (e?.position) out[id] = e.position;
    }
    return out;
  }, fp);
};
