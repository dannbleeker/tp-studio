import { findPath, reachableBackward, reachableForward } from '@/domain/graph';
import type { EntityId } from '@/domain/types';
import { getCanvasInstance } from '@/services/canvasRef';
import type { Command } from './types';

export const navigateCommands: Command[] = [
  {
    id: 'open-search',
    label: 'Find in document…',
    group: 'View',
    run: (s) => s.openSearch(),
  },
  {
    id: 'select-path-between',
    label: 'Select path between selected entities',
    group: 'View',
    run: (s) => {
      const sel = s.selection;
      if (sel.kind !== 'entities' || sel.ids.length !== 2) {
        s.showToast('info', 'Select exactly two entities to find a path.');
        return;
      }
      const [a, b] = sel.ids;
      if (!a || !b) return;
      const path = findPath(s.doc, a, b);
      if (!path) {
        s.showToast('info', 'No path found between selected entities.');
        return;
      }
      s.selectEntities(path.entityIds);
      s.showToast(
        'success',
        `Path: ${path.entityIds.length} entities, ${path.edgeIds.length} edges.`
      );
    },
  },
  {
    id: 'select-successors',
    label: 'Select all successors',
    group: 'View',
    run: (s) => {
      const sel = s.selection;
      if (sel.kind !== 'entities' || sel.ids.length === 0) {
        s.showToast('info', 'Select one or more entities first.');
        return;
      }
      // `Selection.ids` is `string[]` by design (it can hold ids from
      // React Flow events that haven't been brand-typed yet) — every
      // value that survives the `doc.entities[id]` filter is an existing
      // entity, so the EntityId cast is safe.
      const seed = sel.ids.filter((id) => s.doc.entities[id]) as EntityId[];
      const reached = reachableForward(s.doc, seed);
      const ids = new Set<string>(seed);
      for (const r of reached) ids.add(r);
      s.selectEntities([...ids]);
    },
  },
  {
    id: 'select-predecessors',
    label: 'Select all predecessors',
    group: 'View',
    run: (s) => {
      const sel = s.selection;
      if (sel.kind !== 'entities' || sel.ids.length === 0) {
        s.showToast('info', 'Select one or more entities first.');
        return;
      }
      const seed = sel.ids.filter((id) => s.doc.entities[id]) as EntityId[];
      const reached = reachableBackward(s.doc, seed);
      const ids = new Set<string>(seed);
      for (const r of reached) ids.add(r);
      s.selectEntities([...ids]);
    },
  },
  {
    id: 'zoom-fit',
    label: 'Fit view',
    group: 'View',
    run: () => {
      const inst = getCanvasInstance();
      inst?.fitView({ padding: 0.4, maxZoom: 1.2, duration: 200 });
    },
  },
];
