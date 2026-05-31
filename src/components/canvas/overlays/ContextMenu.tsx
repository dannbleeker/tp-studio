import { useShallow } from 'zustand/shallow';
import { defaultEntityType, paletteForDoc, resolveEntityTypeMeta } from '@/domain/entityTypeMeta';
import { outgoingEdges } from '@/domain/graph';
import { presetByTitle } from '@/domain/groupPresets';
import { spawnECFromConflict } from '@/domain/spawnEC';
import type { EntityType } from '@/domain/types';
import { useEntity } from '@/hooks/useSelected';
import { getCanvasInstance } from '@/services/canvasRef';
import { confirmAndDeleteEntity, confirmAndDeleteSelection } from '@/services/confirmations';
import { useDocumentStore } from '@/store';
import { currentDoc } from '@/store/selectors';
import { ContextMenuList } from './ContextMenuList';
import { leadingVerbItems, type MenuItem } from './contextMenuItems';

export function ContextMenu() {
  // Shallow-equal selector. The contract:
  //
  //   state (re-renders this component when changed):
  //     - menu (context-menu open/closed + target)
  //     - selection
  //     - diagramType
  //     - edges (used to detect grouping + back-edge state on the
  //       right-clicked edge, and to compute `hasDownstream` for a
  //       single-entity right-click)
  //
  //   actions (stable refs across renders — listed for readability):
  //     - close, addEntity, beginEditing, updateEntity,
  //       ungroupAnd, ungroupOr, ungroupXor,
  //       toggleEntityCollapsed, swapEntities, showToast, setDocument,
  //       createGroupFromSelection
  //
  // Session 95 — connect / groupAsAnd / groupAsOr / groupAsXor /
  // reverseEdge / spliceEdge dropped out of this selector when the
  // leading verb block of each branch moved to the selection-verb
  // registry. Their palette commands now drive those verbs.
  //
  // useShallow's shallow-equality on the resulting object means only a
  // change to one of the state fields triggers a re-render — action
  // refs being stable lets the bundle stay in one selector instead of
  // splintering into individual subscriptions.
  const {
    menu,
    close,
    selection,
    addEntity,
    beginEditing,
    updateEntity,
    ungroupAnd,
    ungroupOr,
    ungroupXor,
    toggleEntityCollapsed,
    swapEntities,
    showToast,
    setDocument,
    createGroupFromSelection,
    diagramType,
    edges,
    customEntityClasses,
  } = useDocumentStore(
    useShallow((s) => {
      const doc = currentDoc(s);
      return {
        menu: s.contextMenu,
        close: s.closeContextMenu,
        selection: s.selection,
        addEntity: s.addEntity,
        beginEditing: s.beginEditing,
        updateEntity: s.updateEntity,
        ungroupAnd: s.ungroupAnd,
        ungroupOr: s.ungroupOr,
        ungroupXor: s.ungroupXor,
        toggleEntityCollapsed: s.toggleEntityCollapsed,
        swapEntities: s.swapEntities,
        showToast: s.showToast,
        setDocument: s.setDocument,
        createGroupFromSelection: s.createGroupFromSelection,
        diagramType: doc.diagramType,
        edges: doc.edges,
        customEntityClasses: doc.customEntityClasses,
      };
    })
  );
  // B10: palette + meta lookups need the doc's custom classes.
  const docForPalette = currentDoc(useDocumentStore.getState());
  const entity = useEntity(menu.open && menu.target.kind === 'entity' ? menu.target.id : undefined);

  if (!menu.open) return null;

  // `selection.ids` carries branded ids since #5; the menu target's id
  // came from React Flow's context-menu event and is plain string.
  // Capture the discriminated id in a local — TS can't narrow
  // `menu.target` inside the arrow-function callback below, but the
  // local survives the boundary.
  const targetEntityId = menu.target.kind === 'entity' ? menu.target.id : null;
  const targetEdgeId = menu.target.kind === 'edge' ? menu.target.id : null;
  const isMultiEntities =
    targetEntityId !== null &&
    selection.kind === 'entities' &&
    selection.ids.some((id) => id === targetEntityId) &&
    selection.ids.length > 1;
  const isMultiEdges =
    targetEdgeId !== null &&
    selection.kind === 'edges' &&
    selection.ids.some((id) => id === targetEdgeId) &&
    selection.ids.length > 1;

  // IIFE — the items list depends on (target kind, selection shape) and
  // each branch reads its own subset of the closure. Splitting this
  // into per-branch helpers would mean passing ~17 store actions plus
  // doc-shaped state per call — the indirection cost outweighs the
  // line-count win. The branches below are clearly labeled instead.
  const items: MenuItem[] = (() => {
    // ── BRANCH 1: multi-edge selection ────────────────────────────────
    if (isMultiEdges && selection.kind === 'edges') {
      const ids = selection.ids;
      // Leading verbs (Group AND/OR/XOR + optional Ungroup AND/OR/XOR)
      // come from the selection-verb registry so the menu, the
      // SelectionToolbar, and the palette dispatch through one source
      // of truth. Trailing destructive Delete stays inline because the
      // separator-before-delete is part of the menu's UX rhythm.
      const result: MenuItem[] = leadingVerbItems({ kind: 'multi-edges', ids: [...ids] });
      result.push({ kind: 'separator' });
      result.push({
        kind: 'action',
        label: `Delete ${ids.length} edges`,
        destructive: true,
        run: () => confirmAndDeleteSelection(),
      });
      return result;
    }

    // ── BRANCH 2: multi-entity selection ──────────────────────────────
    if (isMultiEntities && selection.kind === 'entities') {
      const ids = selection.ids;
      const result: MenuItem[] = [{ kind: 'header', label: `${ids.length} entities` }];
      if (ids.length === 2) {
        result.push({
          kind: 'action',
          label: 'Swap entities',
          run: () => {
            const [a, b] = ids;
            if (a && b) swapEntities(a, b);
          },
        });
      }
      result.push({ kind: 'separator' });
      result.push({
        kind: 'submenu',
        label: 'Convert all to',
        items: paletteForDoc(docForPalette).map((type) => ({
          kind: 'action' as const,
          label: resolveEntityTypeMeta(type, customEntityClasses).label,
          run: () => {
            for (const id of ids) updateEntity(id, { type: type as EntityType });
          },
        })),
      });
      result.push({ kind: 'separator' });
      result.push({
        kind: 'action',
        label: `Delete ${ids.length} entities`,
        destructive: true,
        run: () => confirmAndDeleteSelection(),
      });
      return result;
    }

    // ── BRANCH 3: single entity ───────────────────────────────────────
    if (menu.target.kind === 'entity' && entity) {
      const id = menu.target.id;
      const convertOptions = paletteForDoc(docForPalette).filter((t) => t !== entity.type);
      // Session 135 / Perf #16 — use the edge index (`outgoingEdges`)
      // instead of a linear `Object.values(edges).some`. O(1) vs
      // O(E). Cheap improvement on a code path that runs once per
      // right-click but the previous implementation was the only
      // O(E) scan in the menu builder.
      const hasDownstream = outgoingEdges(docForPalette, id).length > 0;
      // Leading non-destructive verbs (Add child, Add parent) come
      // from the selection-verb registry. Rename + the rest of the
      // single-entity menu (Convert-to, Pin/Unpin, Spawn-EC, NBR,
      // Delete) stay inline — they're either dynamic per-doc or carry
      // labels that diverge from the registry's defaults.
      const result: MenuItem[] = leadingVerbItems({ kind: 'single-entity', id });
      result.push({ kind: 'action', label: 'Rename', run: () => beginEditing(id) });
      if (entity.collapsed || hasDownstream) {
        result.push({
          kind: 'action',
          label: entity.collapsed ? 'Expand downstream' : 'Collapse downstream',
          run: () => toggleEntityCollapsed(id),
        });
      }
      if (convertOptions.length > 0) {
        result.push({ kind: 'separator' });
        result.push({
          kind: 'submenu',
          label: 'Convert to',
          items: convertOptions.map((type) => ({
            kind: 'action' as const,
            label: resolveEntityTypeMeta(type, customEntityClasses).label,
            run: () => updateEntity(id, { type: type as EntityType }),
          })),
        });
      }
      // Spawn EC: only meaningful for CRT (the canonical "recast Core Driver
      // as Core Conflict" workflow) and only for rootCause entities — the
      // book frames the action specifically as a Core Driver follow-up.
      // We surface it for any entity in a CRT so the user can also try it
      // on a strongly-reaching effect, but rootCause is the prototypical case.
      if (diagramType === 'crt') {
        result.push({ kind: 'separator' });
        result.push({
          kind: 'action',
          label: 'Spawn Evaporating Cloud from this entity',
          run: () => {
            const doc = currentDoc(useDocumentStore.getState());
            const newDoc = spawnECFromConflict(doc, id);
            setDocument(newDoc);
            showToast(
              'success',
              'New Evaporating Cloud seeded — fill in Goal, Needs, and the conflicting Want.'
            );
          },
        });
      }
      // Negative Branch (NBR) — FRT-specific gesture. The book frames it
      // as "an injection has produced an unintended UDE; capture the
      // branch and decide whether to mitigate or replace the injection."
      if (diagramType === 'frt') {
        result.push({
          kind: 'action',
          label: 'Start Negative Branch from this entity',
          run: () => {
            const preset = presetByTitle('Negative Branch');
            if (!preset) return;
            const g = createGroupFromSelection([id], {
              title: preset.title,
              color: preset.color,
            });
            if (g) {
              showToast(
                'success',
                'Negative Branch started. Add the chain leading to this UDE inside the group.'
              );
            }
          },
        });
      }
      result.push({ kind: 'separator' });
      result.push({
        kind: 'action',
        label: 'Delete entity',
        destructive: true,
        run: () => confirmAndDeleteEntity(id),
      });
      return result;
    }
    // ── BRANCH 4: single edge ─────────────────────────────────────────
    if (menu.target.kind === 'edge') {
      const id = menu.target.id;
      const edge = edges[id];
      // Leading non-destructive verbs (Reverse direction, Splice) come
      // from the selection-verb registry. Per-edge ungroup actions,
      // back-edge tag toggle, and the destructive Delete stay inline —
      // they branch on this specific edge's state.
      const result: MenuItem[] = leadingVerbItems({ kind: 'single-edge', id });
      if (edge?.andGroupId || edge?.orGroupId || edge?.xorGroupId) {
        result.push({ kind: 'separator' });
        if (edge.andGroupId) {
          result.push({
            kind: 'action',
            label: 'Ungroup AND',
            run: () => {
              ungroupAnd([id]);
              showToast('info', 'Ungrouped.');
            },
          });
        }
        if (edge.orGroupId) {
          result.push({
            kind: 'action',
            label: 'Ungroup OR',
            run: () => {
              ungroupOr([id]);
              showToast('info', 'Ungrouped.');
            },
          });
        }
        if (edge.xorGroupId) {
          result.push({
            kind: 'action',
            label: 'Ungroup XOR',
            run: () => {
              ungroupXor([id]);
              showToast('info', 'Ungrouped.');
            },
          });
        }
      }
      // Back-edge tag toggle. Lets the user mark a cycle-closing edge as
      // intentional from the right-click menu without opening the inspector.
      result.push({ kind: 'separator' });
      result.push({
        kind: 'action',
        label: edge?.isBackEdge ? 'Untag back-edge' : 'Tag as back-edge',
        run: () => {
          if (!edge) return;
          useDocumentStore
            .getState()
            .updateEdge(id, { isBackEdge: edge.isBackEdge ? undefined : true });
        },
      });
      result.push({ kind: 'separator' });
      result.push({
        kind: 'action',
        label: 'Delete edge',
        destructive: true,
        run: () => confirmAndDeleteSelection(),
      });
      return result;
    }
    return [
      {
        kind: 'action',
        label: 'New entity here',
        run: () =>
          addEntity({
            type: defaultEntityType(diagramType),
            startEditing: true,
          }),
      },
      {
        // Free-floating review comment pinned at the right-click location.
        // Converts the screen coordinate to flow space so the pin tracks the
        // canvas through pan/zoom; falls back to a document-level comment if
        // the canvas instance isn't ready.
        kind: 'action',
        label: 'Add comment here',
        run: () => {
          const inst = getCanvasInstance();
          const pos = inst?.screenToFlowPosition({ x: menu.x, y: menu.y });
          useDocumentStore
            .getState()
            .startCommentAt(pos ? { kind: 'point', x: pos.x, y: pos.y } : { kind: 'document' });
        },
      },
    ];
  })();

  return <ContextMenuList items={items} x={menu.x} y={menu.y} onClose={close} />;
}
