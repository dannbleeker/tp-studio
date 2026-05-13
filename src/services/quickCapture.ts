import { defaultEntityType } from '@/domain/entityTypeMeta';
import { type CaptureNode, type ParseResult, flattenPreorder } from '@/domain/quickCapture';
import { useDocumentStore } from '@/store';

/**
 * Apply a parsed Quick Capture tree to the current document.
 *
 * - Each captured node becomes an entity of the diagram's default type.
 * - Parent-child links in the tree become edges (parent.id → child.id).
 * - Roots in the tree are connected as children of `attachToId` if given,
 *   otherwise float free at the canvas root.
 *
 * Returns a summary the caller can surface via toast.
 */
export const applyQuickCapture = (
  result: ParseResult,
  attachToId: string | null
): { entities: number; edges: number } => {
  if (result.total === 0) return { entities: 0, edges: 0 };

  const state = useDocumentStore.getState();
  const type = defaultEntityType(state.doc.diagramType);

  // Map from the parsed-tree node reference to the freshly-minted entity id.
  const idByNode = new Map<CaptureNode, string>();

  let edgesCreated = 0;
  const flat = flattenPreorder(result.roots);

  // Phase 1: create every entity. We don't use applyDocChange directly — the
  // existing `addEntity` store action already handles annotation numbers,
  // persistence, history, and selection cleanly.
  for (const { node } of flat) {
    const entity = state.addEntity({ type, title: node.title });
    idByNode.set(node, entity.id);
  }

  // Phase 2: connect parents to children + (optionally) attach roots.
  for (const { node, parent } of flat) {
    const childId = idByNode.get(node)!;
    if (parent) {
      const parentId = idByNode.get(parent);
      if (parentId) {
        const edge = state.connect(parentId, childId);
        if (edge) edgesCreated += 1;
      }
    } else if (attachToId) {
      const edge = state.connect(attachToId, childId);
      if (edge) edgesCreated += 1;
    }
  }

  // The last entity created became the active selection from `addEntity`.
  // Replace with the freshly-pasted set so the user can immediately operate
  // on the whole capture (e.g. Cmd+G to group, Delete to undo).
  const allIds = [...idByNode.values()];
  state.selectEntities(allIds);

  return { entities: result.total, edges: edgesCreated };
};
