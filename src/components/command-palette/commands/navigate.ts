import { entityMeta } from '@/domain/entityTypeMeta';
import { findPath, reachableBackward, reachableForward } from '@/domain/graph';
import type { EntityId } from '@/domain/types';
import { getCanvasInstance } from '@/services/canvasRef';
import { prefersReducedMotion } from '@/services/prefersReducedMotion';
import { currentDoc } from '@/store/selectors';
import type { Command } from './types';

export const navigateCommands: Command[] = [
  {
    id: 'open-search',
    label: 'Find in document…',
    group: 'View',
    run: (s) => s.openSearch(),
  },
  {
    // Type is a primary TP navigation axis ("show me every UDE / obstacle / IO").
    // Operates on the selected entity's type so it needs no type picker, and
    // matches on the raw `type` string so custom classes work identically to
    // built-ins. Pure selection — not write-guarded.
    id: 'select-all-of-type',
    label: 'Select all entities of the same type as the selection',
    group: 'View',
    run: (s) => {
      const sel = s.selection;
      if (sel.kind !== 'entities' || sel.ids.length !== 1) {
        s.showToast('info', 'Select a single entity first.');
        return;
      }
      const doc = currentDoc(s);
      const type = doc.entities[sel.ids[0]!]?.type;
      if (!type) return;
      const ids = Object.values(doc.entities)
        .filter((e) => e.type === type)
        .map((e) => e.id);
      s.selectEntities(ids);
      const label = entityMeta(type, doc).label;
      s.showToast(
        'info',
        `Selected ${ids.length} “${label}” entit${ids.length === 1 ? 'y' : 'ies'}.`
      );
    },
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
      const path = findPath(currentDoc(s), a, b);
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
      const doc = currentDoc(s);
      const seed = sel.ids.filter((id) => doc.entities[id]) as EntityId[];
      const reached = reachableForward(doc, seed);
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
      const doc = currentDoc(s);
      const seed = sel.ids.filter((id) => doc.entities[id]) as EntityId[];
      const reached = reachableBackward(doc, seed);
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
      inst?.fitView({ padding: 0.4, maxZoom: 1.2, duration: prefersReducedMotion() ? 0 : 200 });
    },
  },
  {
    // Session 136 — explicit user-triggered relayout. The auto-layout
    // already fires on every structural edit (entities + edges added /
    // removed; see `useGraphPositions` + `fingerprint.ts`), but pinned
    // positions and post-drag manual placement can leave the diagram
    // looking off. This command clears every pinned `entity.position`
    // and triggers a fresh dagre pass + a fit-view so the user can
    // reset to the auto-layout from a single keystroke. Browse Lock
    // does NOT block this — it's a view operation that mutates
    // positions but not any other doc state, and the user explicitly
    // asked for it.
    id: 're-layout',
    label: 'Re-layout diagram (clear pinned positions)',
    group: 'View',
    run: (s) => {
      // Clear every pinned position. `setEntityPosition(id, null)`
      // (per `entityCrud.ts`) removes the field; dagre's next pass
      // then sees them as free.
      const ids = Object.keys(currentDoc(s).entities);
      for (const id of ids) {
        s.setEntityPosition(id, null);
      }
      // Give the auto-layout effect a tick to recompute, then fit.
      setTimeout(() => {
        const inst = getCanvasInstance();
        inst?.fitView({ padding: 0.4, maxZoom: 1.2, duration: prefersReducedMotion() ? 0 : 200 });
      }, 50);
    },
  },
];
