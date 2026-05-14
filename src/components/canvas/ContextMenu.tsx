import { defaultEntityType, paletteForDoc, resolveEntityTypeMeta } from '@/domain/entityTypeMeta';
import { presetByTitle } from '@/domain/groupPresets';
import { LAYOUT_STRATEGY } from '@/domain/layoutStrategy';
import { spawnECFromConflict } from '@/domain/spawnEC';
import type { EntityType } from '@/domain/types';
import { useOutsideAndEscape } from '@/hooks/useOutsideAndEscape';
import { useEntity } from '@/hooks/useSelected';
import { guardWriteOrToast } from '@/services/browseLock';
import { confirmAndDeleteEntity, confirmAndDeleteSelection } from '@/services/confirmations';
import { useDocumentStore } from '@/store';
import { useRef } from 'react';
import { useShallow } from 'zustand/shallow';

type MenuItem =
  | { kind: 'action'; label: string; destructive?: boolean; run: () => void }
  | { kind: 'separator' }
  | { kind: 'header'; label: string };

export function ContextMenu() {
  // Shallow-equal selector. The contract:
  //
  //   state (re-renders this component when changed):
  //     - menu (context-menu open/closed + target)
  //     - selection
  //     - diagramType
  //     - edges (used to find the splice target)
  //
  //   actions (stable refs across renders — listed for readability):
  //     - close, addEntity, connect, beginEditing, updateEntity,
  //       groupAsAnd, ungroupAnd, reverseEdge, spliceEdge,
  //       toggleEntityCollapsed, swapEntities, showToast, setDocument,
  //       setEntityPosition, createGroupFromSelection
  //
  // useShallow's shallow-equality on the resulting object means only a
  // change to one of the state fields triggers a re-render — action
  // refs being stable lets the bundle stay in one selector instead of
  // splintering into 17 individual subscriptions.
  const {
    menu,
    close,
    selection,
    addEntity,
    connect,
    beginEditing,
    updateEntity,
    groupAsAnd,
    ungroupAnd,
    groupAsOr,
    ungroupOr,
    groupAsXor,
    ungroupXor,
    reverseEdge,
    spliceEdge,
    toggleEntityCollapsed,
    swapEntities,
    showToast,
    setDocument,
    setEntityPosition,
    createGroupFromSelection,
    diagramType,
    edges,
    customEntityClasses,
  } = useDocumentStore(
    useShallow((s) => ({
      menu: s.contextMenu,
      close: s.closeContextMenu,
      selection: s.selection,
      addEntity: s.addEntity,
      connect: s.connect,
      beginEditing: s.beginEditing,
      updateEntity: s.updateEntity,
      groupAsAnd: s.groupAsAnd,
      ungroupAnd: s.ungroupAnd,
      groupAsOr: s.groupAsOr,
      ungroupOr: s.ungroupOr,
      groupAsXor: s.groupAsXor,
      ungroupXor: s.ungroupXor,
      reverseEdge: s.reverseEdge,
      spliceEdge: s.spliceEdge,
      toggleEntityCollapsed: s.toggleEntityCollapsed,
      swapEntities: s.swapEntities,
      showToast: s.showToast,
      setDocument: s.setDocument,
      setEntityPosition: s.setEntityPosition,
      createGroupFromSelection: s.createGroupFromSelection,
      diagramType: s.doc.diagramType,
      edges: s.doc.edges,
      customEntityClasses: s.doc.customEntityClasses,
    }))
  );
  // B10: palette + meta lookups need the doc's custom classes.
  const docForPalette = useDocumentStore.getState().doc;
  const entity = useEntity(menu.open && menu.target.kind === 'entity' ? menu.target.id : undefined);

  const ref = useRef<HTMLDivElement | null>(null);
  useOutsideAndEscape(ref, close, menu.open);

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
      const anyAndGrouped = ids.some((id) => edges[id]?.andGroupId);
      const anyOrGrouped = ids.some((id) => edges[id]?.orGroupId);
      const anyXorGrouped = ids.some((id) => edges[id]?.xorGroupId);
      const result: MenuItem[] = [
        {
          kind: 'action',
          label: 'Group as AND',
          run: () => {
            const r = groupAsAnd(ids);
            if (!r.ok) showToast('error', r.reason);
            else showToast('success', 'AND-grouped.');
          },
        },
        {
          kind: 'action',
          label: 'Group as OR',
          run: () => {
            const r = groupAsOr(ids);
            if (!r.ok) showToast('error', r.reason);
            else showToast('success', 'OR-grouped.');
          },
        },
        {
          kind: 'action',
          label: 'Group as XOR',
          run: () => {
            const r = groupAsXor(ids);
            if (!r.ok) showToast('error', r.reason);
            else showToast('success', 'XOR-grouped.');
          },
        },
      ];
      if (anyAndGrouped) {
        result.push({
          kind: 'action',
          label: 'Ungroup AND',
          run: () => {
            ungroupAnd(ids);
            showToast('info', 'Ungrouped.');
          },
        });
      }
      if (anyOrGrouped) {
        result.push({
          kind: 'action',
          label: 'Ungroup OR',
          run: () => {
            ungroupOr(ids);
            showToast('info', 'Ungrouped.');
          },
        });
      }
      if (anyXorGrouped) {
        result.push({
          kind: 'action',
          label: 'Ungroup XOR',
          run: () => {
            ungroupXor(ids);
            showToast('info', 'Ungrouped.');
          },
        });
      }
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
      result.push({ kind: 'header', label: 'Convert all to' });
      for (const type of paletteForDoc(docForPalette)) {
        result.push({
          kind: 'action',
          label: resolveEntityTypeMeta(type, customEntityClasses).label,
          run: () => {
            for (const id of ids) updateEntity(id, { type: type as EntityType });
          },
        });
      }
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
      const hasDownstream = Object.values(edges).some((e) => e?.sourceId === id);
      const result: MenuItem[] = [
        {
          kind: 'action',
          label: 'Add child',
          run: () => {
            const e = addEntity({
              type: defaultEntityType(diagramType),
              startEditing: true,
            });
            connect(id, e.id);
          },
        },
        {
          kind: 'action',
          label: 'Add parent',
          run: () => {
            const e = addEntity({
              type: defaultEntityType(diagramType),
              startEditing: true,
            });
            connect(e.id, id);
          },
        },
        { kind: 'action', label: 'Rename', run: () => beginEditing(id) },
      ];
      if (entity.collapsed || hasDownstream) {
        result.push({
          kind: 'action',
          label: entity.collapsed ? 'Expand downstream' : 'Collapse downstream',
          run: () => toggleEntityCollapsed(id),
        });
      }
      result.push({ kind: 'separator' });
      result.push({ kind: 'header', label: 'Convert to' });
      for (const type of convertOptions) {
        result.push({
          kind: 'action',
          label: resolveEntityTypeMeta(type, customEntityClasses).label,
          run: () => updateEntity(id, { type: type as EntityType }),
        });
      }
      // LA5 (Session 63): pin / unpin position. Only meaningful on
      // auto-layout diagrams — manual-layout diagrams (EC) always read
      // entity.position by definition. Show "Unpin" when the entity is
      // currently pinned; otherwise nothing (a drag is the way to pin).
      if (LAYOUT_STRATEGY[diagramType] !== 'manual' && entity.position) {
        result.push({ kind: 'separator' });
        result.push({
          kind: 'action',
          label: 'Unpin position (let layout reclaim)',
          run: () => {
            setEntityPosition(id, null);
            showToast('info', 'Position unpinned — auto-layout will place this entity again.');
          },
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
            const doc = useDocumentStore.getState().doc;
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
      const result: MenuItem[] = [];
      result.push({
        kind: 'action',
        label: 'Reverse direction',
        run: () => {
          if (!edge) return;
          reverseEdge(id);
          const after = useDocumentStore.getState().doc.edges[id];
          if (after && (after.sourceId !== edge.sourceId || after.targetId !== edge.targetId)) {
            showToast('success', 'Edge reversed.');
          } else {
            showToast('info', 'Cannot reverse — the opposite-direction edge already exists.');
          }
        },
      });
      // Splice: insert a fresh entity in the middle of this edge. Pairs
      // naturally with Reverse direction as the two direct-manipulation
      // edge operations.
      result.push({
        kind: 'action',
        label: 'Splice entity into this edge',
        run: () => {
          const created = spliceEdge(id);
          if (!created) showToast('error', 'Could not splice — edge or endpoints missing.');
          else if (edge?.andGroupId) {
            showToast('info', 'Spliced. AND grouping on the original edge was dropped.');
          }
        },
      });
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
    ];
  })();

  return (
    <div
      ref={ref}
      className="fixed z-40 min-w-[180px] overflow-hidden rounded-md border border-neutral-200 bg-white py-1 shadow-lg dark:border-neutral-800 dark:bg-neutral-950"
      style={{ top: menu.y, left: menu.x }}
      role="menu"
    >
      {items.map((item, idx) => {
        const stableKey =
          item.kind === 'separator'
            ? `sep:${idx}`
            : item.kind === 'header'
              ? `hdr:${item.label}`
              : `act:${item.label}`;
        if (item.kind === 'separator') {
          return <div key={stableKey} className="my-1 h-px bg-neutral-200 dark:bg-neutral-800" />;
        }
        if (item.kind === 'header') {
          return (
            <div
              key={stableKey}
              className="px-3 pt-1.5 pb-1 font-semibold text-[10px] text-neutral-500 uppercase tracking-wider dark:text-neutral-400"
            >
              {item.label}
            </div>
          );
        }
        return (
          <button
            key={stableKey}
            type="button"
            role="menuitem"
            onClick={() => {
              close();
              if (!guardWriteOrToast()) return;
              item.run();
            }}
            className={
              item.destructive
                ? 'flex w-full items-center justify-between px-3 py-1.5 text-left text-red-700 text-sm transition hover:bg-red-50 dark:text-red-300 dark:hover:bg-red-950/30'
                : 'flex w-full items-center justify-between px-3 py-1.5 text-left text-neutral-700 text-sm transition hover:bg-neutral-100 dark:text-neutral-200 dark:hover:bg-neutral-900'
            }
          >
            {item.label}
          </button>
        );
      })}
    </div>
  );
}
