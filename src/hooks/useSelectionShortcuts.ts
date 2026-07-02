import { useEffect } from 'react';
import { useShallow } from 'zustand/shallow';
import { defaultEntityType } from '@/domain/entityTypeMeta';
import { reachableBackward, reachableForward } from '@/domain/graph';
import type { EntityId } from '@/domain/types';
import { guardWriteOrToast } from '@/services/browseLock';
import { confirmAndDeleteSelection } from '@/services/confirmations';
import { useDocumentStore } from '@/store';
import { currentDoc } from '@/store/selectors';
import { isEditableTarget, isInteractiveTarget } from './keyboardUtils';

/**
 * Selection-dependent keyboard shortcuts. Everything here either reads the
 * current selection on every keystroke or only makes sense while something
 * is selected: Enter (rename / hoist), Tab / Shift+Tab (add child / parent),
 * Arrow expand / collapse on a group, Cmd/Ctrl+Shift+Arrow successor /
 * predecessor expansion, and the Delete/Backspace deletion path. (Plain-arrow
 * navigation between connected entities is owned by `useArrowKeyNodeNav`.)
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
  const { addEntity, connect, beginEditing } = useDocumentStore(
    useShallow((s) => ({
      addEntity: s.addEntity,
      connect: s.connect,
      beginEditing: s.beginEditing,
    }))
  );

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const cmdOrCtrl = e.metaKey || e.ctrlKey;
      // These are bare-key CANVAS shortcuts, so they fire only when the canvas
      // owns the keyboard — not when a text field OR an interactive control
      // (button / link / select / menu item) has focus, which would let a
      // keystroke meant for that control double as a canvas command (the
      // Tab-on-a-button "mint a child" / Backspace "delete selection" bugs).
      const onControl = isEditableTarget(e.target) || isInteractiveTarget(e.target);

      // reg: select-successors / select-predecessors
      // Cmd/Ctrl+Shift+ArrowRight / ArrowLeft — select successors / predecessors.
      if (cmdOrCtrl && e.shiftKey && (e.key === 'ArrowRight' || e.key === 'ArrowLeft')) {
        const state = useDocumentStore.getState();
        const doc = currentDoc(state);
        const sel = state.selection;
        if (sel.kind !== 'entities' || sel.ids.length === 0) return;
        e.preventDefault();
        // `Selection.ids` is `string[]`; filter on `doc.entities[id]`
        // guarantees the survivors are real entity ids, so the brand cast
        // is safe at this boundary.
        const seed = sel.ids.filter((id) => doc.entities[id]) as EntityId[];
        if (seed.length === 0) return;
        const reached =
          e.key === 'ArrowRight' ? reachableForward(doc, seed) : reachableBackward(doc, seed);
        const ids = new Set<string>(seed);
        for (const r of reached) ids.add(r);
        state.selectEntities([...ids]);
        return;
      }

      // Per-selection shortcuts read live store state once per keystroke. The
      // `single` shorthand captures the common "exactly one entity / edge
      // selected" predicate that several branches below share.
      const _state2 = useDocumentStore.getState();
      const selection = _state2.selection;
      const doc = currentDoc(_state2);
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
        !onControl &&
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
      // Enter OR F2 on a single selected entity → begin editing its title (F2 is
      // the conventional rename key — Z-6). Enter on a GROUP hoists it; F2 ignores
      // groups (they have no title to rename).
      if ((e.key === 'Enter' || e.key === 'F2') && !onControl && single?.kind === 'entities') {
        const isGroup = doc.groups[single.id] != null;
        if (isGroup && e.key !== 'Enter') return; // F2 on a group: no-op
        e.preventDefault();
        if (isGroup) {
          useDocumentStore.getState().hoistGroup(single.id);
          return;
        }
        if (!guardWriteOrToast()) return;
        beginEditing(single.id);
        return;
      }

      // reg: delete-entity / delete-group
      if ((e.key === 'Delete' || e.key === 'Backspace') && !onControl) {
        if (selection.kind === 'none') return;
        e.preventDefault();
        if (!guardWriteOrToast()) return;
        confirmAndDeleteSelection();
        return;
      }

      // reg: add-child / add-parent
      if (e.key === 'Tab' && !onControl && single?.kind === 'entities') {
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
      if (!onControl && single?.kind === 'entities' && doc.groups[single.id]) {
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

      // Arrow-key navigation between connected entities is owned SOLELY by
      // `useArrowKeyNodeNav` (geometric: walk to the connected neighbour in the
      // pressed direction). It previously ALSO lived here as a causal variant
      // (↑ effect / ↓ cause / ← → sibling), so the same selected node behaved
      // differently depending on whether it had DOM focus (Tab) or was merely
      // click-selected — the capture-phase geometric handler won only when a
      // node owned focus. That focus-dependent split contradicted the printed
      // shortcut reference; the causal branch is removed so there is one
      // documented model. Group expand/collapse (← / →) stays here — it's a
      // group-only gesture the geometric nav doesn't touch. The registry
      // markers for the arrow-nav shortcuts now live in `useArrowKeyNodeNav`.
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [addEntity, connect, beginEditing]);
}
