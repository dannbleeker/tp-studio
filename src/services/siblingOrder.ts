import { NODE_MIN_HEIGHT, NODE_WIDTH } from '@/domain/constants';
import { LAYOUT_STRATEGY } from '@/domain/layoutStrategy';
import { getCanvasNodes } from '@/services/canvasRef';
import { useDocumentStore } from '@/store';
import { currentDoc } from '@/store/selectors';

/**
 * Session 193 — manual sibling ordering setter.
 *
 * The layout's post-dagre pass honours `entity.ordering` for same-rank
 * siblings; this is the UI-side half that reads the live canvas positions to
 * decide which entities are siblings (same layout rank) and stamps a manual
 * `ordering` on the whole rank so a swap sticks. Auto-layout diagrams only —
 * hand-positioned ones (e.g. Evaporating Cloud) have no rank to reorder.
 */

// Two nodes count as the same rank when their rank-axis CENTRE coordinate
// matches within this tolerance. Centres (not top-left positions) are used so a
// tall node (an S&T injection, a grown card) at the same rank as a short one
// isn't mis-detected — dagre aligns rank CENTRES, so same-rank centres are
// identical and different ranks are a rank-gap (80+ px) apart; the slop only
// absorbs sub-pixel drift. Matches `reorderManualSiblings` in layout.ts, which
// buckets by dagre's centre coordinate.
const RANK_EPS = 8;

/**
 * The ids of an entity's layout siblings (the nodes sharing its rank), ordered
 * along the free axis, plus the entity's own index among them. Returns null
 * when the diagram is manual-layout, the entity isn't on the canvas, or it has
 * no sibling to reorder against.
 */
export const layoutSiblingOrder = (entityId: string): { ids: string[]; index: number } | null => {
  const doc = currentDoc(useDocumentStore.getState());
  if (LAYOUT_STRATEGY[doc.diagramType] === 'manual') return null;
  const nodes = getCanvasNodes();
  const self = nodes.find((n) => n.id === entityId);
  if (!self) return null;
  const direction = doc.layoutConfig?.direction ?? 'BT';
  const vertical = direction === 'BT' || direction === 'TB';
  // Node CENTRE on each axis — the measured size falls back to the canonical
  // card dimensions before React Flow has measured the DOM.
  const centreY = (n: (typeof nodes)[number]) =>
    n.position.y + (n.measured?.height ?? NODE_MIN_HEIGHT) / 2;
  const centreX = (n: (typeof nodes)[number]) =>
    n.position.x + (n.measured?.width ?? NODE_WIDTH) / 2;
  const rankOf = (n: (typeof nodes)[number]) => (vertical ? centreY(n) : centreX(n));
  const freeOf = (n: (typeof nodes)[number]) => (vertical ? centreX(n) : centreY(n));
  const selfRank = rankOf(self);
  const peers = nodes
    .filter((n) => Math.abs(rankOf(n) - selfRank) <= RANK_EPS)
    .sort((a, b) => freeOf(a) - freeOf(b));
  if (peers.length < 2) return null;
  const ids = peers.map((n) => n.id);
  return { ids, index: ids.indexOf(entityId) };
};

/**
 * Move an entity one slot earlier (`dir === -1`) or later (`dir === 1`) among
 * its layout siblings. Stamps sequential `ordering` on the whole rank in one
 * history step; the layout's reorder pass then reflects the swap. Returns false
 * (no-op) when there's no sibling or the entity is already at that end.
 */
export const moveEntityInSiblingOrder = (entityId: string, dir: -1 | 1): boolean => {
  const info = layoutSiblingOrder(entityId);
  if (!info) return false;
  const { ids, index } = info;
  const target = index + dir;
  if (target < 0 || target >= ids.length) return false;

  const reordered = [...ids];
  reordered[index] = ids[target]!;
  reordered[target] = ids[index]!;

  const state = useDocumentStore.getState();
  const doc = currentDoc(state);
  const now = Date.now();
  const nextEntities = { ...doc.entities };
  reordered.forEach((id, i) => {
    const e = nextEntities[id];
    if (e) nextEntities[id] = { ...e, ordering: i + 1, updatedAt: now };
  });
  state.setDocument({ ...doc, entities: nextEntities, updatedAt: now });
  return true;
};
