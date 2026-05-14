import { SIBLING_Y_TOLERANCE_PX } from '@/domain/constants';
import { defaultEntityType } from '@/domain/entityTypeMeta';
import { reachableBackward, reachableForward } from '@/domain/graph';
import type { EntityId } from '@/domain/types';
import { guardWriteOrToast } from '@/services/browseLock';
import { getCanvasNodes } from '@/services/canvasRef';
import { confirmAndDeleteSelection } from '@/services/confirmations';
import { useDocumentStore } from '@/store';
import { useEffect } from 'react';
import { useShallow } from 'zustand/shallow';
import { isEditableTarget } from './keyboardUtils';

/**
 * Selection-dependent keyboard shortcuts. Everything here either reads the
 * current selection on every keystroke or only makes sense while something
 * is selected: Enter (rename / hoist), Tab / Shift+Tab (add child / parent),
 * Arrow nav between connected entities, Arrow expand / collapse on a group,
 * Cmd/Ctrl+Shift+Arrow successor / predecessor expansion, and the
 * Delete/Backspace deletion path.
 *
 * Each branch carries a `// reg: <id>` marker that the registry-link test
 * (`tests/hooks/shortcutRegistry.test.ts`) cross-checks against `SHORTCUTS`
 * in `@/domain/shortcuts`. Adding a new branch here without the marker
 * fails CI.
 */
export function useSelectionShortcuts() {
  // One shallow-equal selector for all the actions we bind. Zustand actions
  // are stable references, so this effectively runs once and stops re-rendering
  // this hook on every store mutation.
  const { selectEntity, addEntity, connect, beginEditing } = useDocumentStore(
    useShallow((s) => ({
      selectEntity: s.selectEntity,
      addEntity: s.addEntity,
      connect: s.connect,
      beginEditing: s.beginEditing,
    }))
  );

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const cmdOrCtrl = e.metaKey || e.ctrlKey;
      const inField = isEditableTarget(e.target);

      // reg: select-successors / select-predecessors
      // Cmd/Ctrl+Shift+ArrowRight / ArrowLeft — select successors / predecessors.
      if (cmdOrCtrl && e.shiftKey && (e.key === 'ArrowRight' || e.key === 'ArrowLeft')) {
        const state = useDocumentStore.getState();
        const sel = state.selection;
        if (sel.kind !== 'entities' || sel.ids.length === 0) return;
        e.preventDefault();
        // `Selection.ids` is `string[]`; filter on `doc.entities[id]`
        // guarantees the survivors are real entity ids, so the brand cast
        // is safe at this boundary.
        const seed = sel.ids.filter((id) => state.doc.entities[id]) as EntityId[];
        if (seed.length === 0) return;
        const reached =
          e.key === 'ArrowRight'
            ? reachableForward(state.doc, seed)
            : reachableBackward(state.doc, seed);
        const ids = new Set<string>(seed);
        for (const r of reached) ids.add(r);
        state.selectEntities([...ids]);
        return;
      }

      // Per-selection shortcuts read live store state once per keystroke. The
      // `single` shorthand captures the common "exactly one entity / edge
      // selected" predicate that several branches below share.
      const { selection, doc } = useDocumentStore.getState();
      const single =
        (selection.kind === 'entities' || selection.kind === 'edges') && selection.ids.length === 1
          ? { kind: selection.kind, id: selection.ids[0]! }
          : undefined;

      // reg: add-assumption-on-edge
      // A (bare) — when an edge is selected and nothing is in edit mode,
      // add a fresh assumption to that edge and focus the new row in the
      // AssumptionWell (the inspector handles the focus via `lastAddedRef`).
      // Brief §9: "A (on selected edge) → add assumption". For EC diagrams
      // the assumption seeds with the canonical "…because " prefix.
      if (
        !cmdOrCtrl &&
        !e.shiftKey &&
        !e.altKey &&
        !inField &&
        e.key.toLowerCase() === 'a' &&
        single?.kind === 'edges'
      ) {
        e.preventDefault();
        if (!guardWriteOrToast()) return;
        const seedTitle = doc.diagramType === 'ec' ? '…because ' : undefined;
        useDocumentStore.getState().addAssumptionToEdge(single.id, seedTitle);
        return;
      }

      // reg: rename / hoist-group
      if (e.key === 'Enter' && !inField && single?.kind === 'entities') {
        // Group → hoist; entity → begin-editing. Distinguish by id lookup.
        if (doc.groups[single.id]) {
          e.preventDefault();
          useDocumentStore.getState().hoistGroup(single.id);
          return;
        }
        e.preventDefault();
        if (!guardWriteOrToast()) return;
        beginEditing(single.id);
        return;
      }

      // reg: delete-entity / delete-group
      if ((e.key === 'Delete' || e.key === 'Backspace') && !inField) {
        if (selection.kind === 'none') return;
        e.preventDefault();
        if (!guardWriteOrToast()) return;
        confirmAndDeleteSelection();
        return;
      }

      // reg: add-child / add-parent
      if (e.key === 'Tab' && !inField && single?.kind === 'entities') {
        e.preventDefault();
        if (!guardWriteOrToast()) return;
        const newEntity = addEntity({
          type: defaultEntityType(doc.diagramType),
          startEditing: true,
        });
        if (e.shiftKey) {
          // create parent: new -> selected
          connect(newEntity.id, single.id);
        } else {
          // create child: selected -> new
          connect(single.id, newEntity.id);
        }
        return;
      }

      // reg: expand-group / collapse-group
      // Group expand / collapse on a selected group node:
      //   →  expands a collapsed group; ←  collapses an expanded one.
      // The asymmetry mirrors how a tree control reads: right = open.
      if (!inField && single?.kind === 'entities' && doc.groups[single.id]) {
        const group = doc.groups[single.id];
        if (e.key === 'ArrowRight' && group?.collapsed) {
          e.preventDefault();
          useDocumentStore.getState().toggleGroupCollapsed(single.id);
          return;
        }
        if (e.key === 'ArrowLeft' && group && !group.collapsed) {
          e.preventDefault();
          useDocumentStore.getState().toggleGroupCollapsed(single.id);
          return;
        }
      }

      // reg: move-to-effect / move-to-cause / move-to-sibling
      // Arrow-key navigation among connected entities.
      // Layout is bottom-up: effects are visually above causes.
      // ArrowUp → effect (target of an outgoing edge).
      // ArrowDown → cause (source of an incoming edge).
      // ArrowLeft / ArrowRight → sibling at the same rank (using live RF positions).
      if (!inField && single?.kind === 'entities' && !doc.groups[single.id]) {
        const edges = Object.values(doc.edges);
        let nextId: string | undefined;
        const currentId = single.id;

        if (e.key === 'ArrowUp') {
          const out = edges.find((edge) => edge.sourceId === currentId);
          if (out) nextId = out.targetId;
        } else if (e.key === 'ArrowDown') {
          const inc = edges.find((edge) => edge.targetId === currentId);
          if (inc) nextId = inc.sourceId;
        } else if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
          const rfNodes = getCanvasNodes();
          const current = rfNodes.find((n) => n.id === currentId);
          if (current) {
            const direction = e.key === 'ArrowRight' ? 1 : -1;
            const candidates = rfNodes.filter(
              (n) =>
                n.id !== current.id &&
                Math.abs(n.position.y - current.position.y) <= SIBLING_Y_TOLERANCE_PX &&
                Math.sign(n.position.x - current.position.x) === direction
            );
            candidates.sort(
              (a, b) =>
                Math.abs(a.position.x - current.position.x) -
                Math.abs(b.position.x - current.position.x)
            );
            nextId = candidates[0]?.id;
          }
        }

        if (nextId) {
          e.preventDefault();
          selectEntity(nextId);
        }
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [selectEntity, addEntity, connect, beginEditing]);
}
