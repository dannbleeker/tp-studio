import clsx from 'clsx';
import { ArrowLeftRight, ListOrdered, Trash2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useShallow } from 'zustand/shallow';
import { paletteForDoc, resolveEntityTypeMeta } from '@/domain/entityTypeMeta';
import type { EntityTitleSize, EntityType } from '@/domain/types';
import { guardWriteOrToast } from '@/services/browseLock';
import { confirmAndDeleteSelection } from '@/services/confirmations';
import { useDocumentStore } from '@/store';
import { arrayShallowEqualByKeys } from '@/store/equality';
import { useDocumentStoreWith } from '@/store/useDocumentStoreWithEquality';
import { TextInput } from '../settings/formPrimitives';
import { Button } from '../ui/Button';
import {
  SELECTED_BUTTON_CLASS,
  SELECTED_BUTTON_CLASS_PLAIN,
  UNSELECTED_BUTTON_CLASS,
  UNSELECTED_BUTTON_CLASS_PLAIN,
} from '../ui/buttonClasses';
import { Field } from './Field';

// Session 135 / infra-debt — narrow the EntitiesMulti / EdgesMulti
// subscriptions away from whole-map (`s.doc.entities` / `s.doc.edges`)
// reads using custom equality. The selector still walks the
// selection but `arrayShallowEqualByKeys` skips re-renders when the
// derived row data is logically the same. Matches the pattern landed
// for `AttachedEdgesList`, `AssumptionAnchorOverlay`, etc.
type EntitiesMultiRow = {
  id: string;
  type: EntityType;
  titleSize: EntityTitleSize | undefined;
  ordering: number | undefined;
};
const entitiesMultiRowsEqual = arrayShallowEqualByKeys<EntitiesMultiRow>([
  'id',
  'type',
  'titleSize',
  'ordering',
]);

type EdgesMultiRow = {
  id: string;
  targetId: string;
  andGroupId: string | undefined;
  orGroupId: string | undefined;
  xorGroupId: string | undefined;
};
const edgesMultiRowsEqual = arrayShallowEqualByKeys<EdgesMultiRow>([
  'id',
  'targetId',
  'andGroupId',
  'orGroupId',
  'xorGroupId',
]);

/**
 * Inspector view for multi-selection. Entities: bulk convert + bulk delete +
 * (when exactly two) Swap. Edges: bulk delete + (when ≥2) Group as AND /
 * Ungroup AND. Single-selection still goes through EntityInspector / EdgeInspector.
 */
export function MultiInspector(
  props: { kind: 'entities'; ids: string[] } | { kind: 'edges'; ids: string[] }
) {
  const locked = useDocumentStore((s) => s.browseLocked);
  if (props.kind === 'entities') {
    return <EntitiesMulti ids={props.ids} locked={locked} />;
  }
  return <EdgesMulti ids={props.ids} locked={locked} />;
}

function EntitiesMulti({ ids, locked }: { ids: string[]; locked: boolean }) {
  const updateEntity = useDocumentStore((s) => s.updateEntity);
  const swapEntities = useDocumentStore((s) => s.swapEntities);

  // Session 135 / infra-debt — narrowed subscription. The component
  // re-renders only when the selected entities' (id, type, titleSize,
  // ordering) shape changes, not on every unrelated entity mutation.
  // `paletteForDoc` only reads diagramType + customEntityClasses;
  // those are subscribed separately via `useShallow` so an unrelated
  // entity edit doesn't churn the palette derivation.
  const present = useDocumentStoreWith((s) => {
    const out: EntitiesMultiRow[] = [];
    for (const id of ids) {
      const e = s.doc.entities[id];
      if (!e) continue;
      out.push({ id: e.id, type: e.type, titleSize: e.titleSize, ordering: e.ordering });
    }
    return out;
  }, entitiesMultiRowsEqual);
  const { diagramType, customEntityClasses } = useDocumentStore(
    useShallow((s) => ({
      diagramType: s.doc.diagramType,
      customEntityClasses: s.doc.customEntityClasses,
    }))
  );

  const availableTypes = useMemo(
    () => paletteForDoc({ diagramType, customEntityClasses }),
    [diagramType, customEntityClasses]
  );

  const { allSameType, sharedType } = useMemo(() => {
    const same = present.every((e) => e.type === present[0]?.type);
    return { allSameType: same, sharedType: same ? present[0]?.type : undefined };
  }, [present]);

  if (present.length === 0) return null;

  return (
    <div className="flex flex-col gap-4">
      <p className="text-neutral-700 text-sm dark:text-neutral-200">
        {present.length} entities selected.{' '}
        <span className="text-neutral-500 dark:text-neutral-400">
          {allSameType && sharedType
            ? `All ${resolveEntityTypeMeta(sharedType, customEntityClasses).label}.`
            : 'Mixed types.'}
        </span>
      </p>

      <Field label="Convert all to…">
        <div className="grid grid-cols-2 gap-1.5">
          {availableTypes.map((type) => {
            const meta = resolveEntityTypeMeta(type, customEntityClasses);
            const selected = sharedType === type;
            return (
              <button
                key={type}
                type="button"
                disabled={locked}
                onClick={() => {
                  if (!guardWriteOrToast()) return;
                  for (const e of present) {
                    if (e.type !== type) updateEntity(e.id, { type: type as EntityType });
                  }
                }}
                className={clsx(
                  'flex items-center gap-2 rounded-md border px-2 py-1.5 text-left text-xs transition disabled:cursor-not-allowed disabled:opacity-60',
                  selected ? SELECTED_BUTTON_CLASS_PLAIN : UNSELECTED_BUTTON_CLASS_PLAIN
                )}
              >
                <span
                  className="h-3 w-1 shrink-0 rounded-sm"
                  style={{ backgroundColor: meta.stripeColor }}
                />
                <span className="truncate text-neutral-700 dark:text-neutral-200">
                  {meta.label}
                </span>
              </button>
            );
          })}
        </div>
      </Field>

      {/*
        B8 — batch-edit fields. Two operations beyond the existing type
        conversion: title-size and renumber. Description mass-edit was
        considered but rejected as Block B scope — markdown descriptions
        are author-specific enough that a "replace all" is almost always
        the wrong choice; the type / size / order ops are not.
      */}
      <Field label="Title size — apply to all">
        <div className="grid grid-cols-3 gap-1.5">
          {(['sm', 'md', 'lg'] as const).map((size) => {
            const allMatch = present.every((e) => (e.titleSize ?? 'md') === size);
            const label = size === 'sm' ? 'Compact' : size === 'md' ? 'Regular' : 'Large';
            return (
              <button
                key={size}
                type="button"
                disabled={locked}
                onClick={() => {
                  if (!guardWriteOrToast()) return;
                  // `'md'` is the implicit default — store it as `undefined`
                  // so the persisted shape matches a freshly-created entity.
                  const next: EntityTitleSize | undefined = size === 'md' ? undefined : size;
                  for (const e of present) {
                    if ((e.titleSize ?? 'md') !== size) updateEntity(e.id, { titleSize: next });
                  }
                }}
                className={clsx(
                  'rounded-md border px-2 py-1.5 text-xs transition disabled:cursor-not-allowed disabled:opacity-60',
                  allMatch ? SELECTED_BUTTON_CLASS : UNSELECTED_BUTTON_CLASS
                )}
              >
                {label}
              </button>
            );
          })}
        </div>
      </Field>

      <RenumberControl present={present} locked={locked} updateEntity={updateEntity} />

      {present.length === 2 && (
        <Button
          variant="softViolet"
          disabled={locked}
          onClick={() => {
            if (!guardWriteOrToast()) return;
            const [a, b] = present;
            if (a && b) swapEntities(a.id, b.id);
          }}
        >
          <ArrowLeftRight className="h-3.5 w-3.5" />
          Swap entities
        </Button>
      )}

      <Button
        variant="destructive"
        disabled={locked}
        onClick={() => confirmAndDeleteSelection()}
        className="mt-2"
      >
        <Trash2 className="h-3.5 w-3.5" />
        Delete {present.length} entities
      </Button>
    </div>
  );
}

/**
 * B8 — renumber control. Sets `ordering` to start-N, start-N+1, start-N+2 …
 * across the multi-selection *in selection order*. The selection order is
 * what comes through `present` here; it mirrors the order React Flow
 * collected the entities in (typically click order, but marquee selection
 * uses node z-order — close enough for a renumber gesture).
 *
 * The start number persists in local state across re-renders so a user
 * can adjust it without retyping. Defaults to 1, the most common case
 * (renumber a freshly-selected chain from the top).
 */
function RenumberControl({
  present,
  locked,
  updateEntity,
}: {
  present: { id: string; ordering: number | undefined }[];
  locked: boolean;
  updateEntity: (id: string, patch: { ordering?: number }) => void;
}) {
  const [startAt, setStartAt] = useState(1);
  if (present.length < 2) return null;
  return (
    <Field label="Renumber as steps">
      <div className="flex items-center gap-2">
        <TextInput
          type="number"
          ariaLabel="Renumber starting at"
          className="w-20"
          value={String(startAt)}
          disabled={locked}
          onChange={(raw) => {
            const n = Number.parseInt(raw, 10);
            setStartAt(Number.isFinite(n) && n > 0 ? n : 1);
          }}
        />
        <Button
          variant="softNeutral"
          size="sm"
          disabled={locked}
          onClick={() => {
            if (!guardWriteOrToast()) return;
            present.forEach((e, idx) => {
              updateEntity(e.id, { ordering: startAt + idx });
            });
          }}
        >
          <ListOrdered className="h-3.5 w-3.5" />
          <span>
            Apply {startAt}…{startAt + present.length - 1}
          </span>
        </Button>
      </div>
    </Field>
  );
}

function EdgesMulti({ ids, locked }: { ids: string[]; locked: boolean }) {
  const groupAsAnd = useDocumentStore((s) => s.groupAsAnd);
  const ungroupAnd = useDocumentStore((s) => s.ungroupAnd);
  const groupAsOr = useDocumentStore((s) => s.groupAsOr);
  const ungroupOr = useDocumentStore((s) => s.ungroupOr);
  const groupAsXor = useDocumentStore((s) => s.groupAsXor);
  const ungroupXor = useDocumentStore((s) => s.ungroupXor);
  const showToast = useDocumentStore((s) => s.showToast);

  // Session 135 / infra-debt — same narrowing pattern as EntitiesMulti
  // above. Re-renders only when the selected edges' (id, targetId,
  // junctor groups) shape changes — unrelated edge mutations no
  // longer churn the panel.
  const present = useDocumentStoreWith((s) => {
    const out: EdgesMultiRow[] = [];
    for (const id of ids) {
      const e = s.doc.edges[id];
      if (!e) continue;
      out.push({
        id: e.id,
        targetId: e.targetId,
        andGroupId: e.andGroupId,
        orGroupId: e.orGroupId,
        xorGroupId: e.xorGroupId,
      });
    }
    return out;
  }, edgesMultiRowsEqual);

  if (present.length === 0) return null;

  const hasAndGrouped = present.some((e) => Boolean(e.andGroupId));
  const hasOrGrouped = present.some((e) => Boolean(e.orGroupId));
  const hasXorGrouped = present.some((e) => Boolean(e.xorGroupId));

  const allTypeLabel = (() => {
    const targetIds = new Set(present.map((e) => e.targetId));
    return targetIds.size === 1
      ? 'Share a target — eligible for AND / OR / XOR group.'
      : 'Different targets — cannot junctor-group.';
  })();

  const presentIds = present.map((e) => e.id);

  return (
    <div className="flex flex-col gap-4">
      <p className="text-neutral-700 text-sm dark:text-neutral-200">
        {present.length} edges selected.{' '}
        <span className="text-neutral-500 dark:text-neutral-400">{allTypeLabel}</span>
      </p>

      <div className="grid grid-cols-3 gap-2">
        <Button
          variant="softViolet"
          disabled={locked}
          onClick={() => {
            if (!guardWriteOrToast()) return;
            const result = groupAsAnd(presentIds);
            if (!result.ok) showToast('error', result.reason);
            else showToast('success', 'AND-grouped.');
          }}
        >
          Group as AND
        </Button>
        <Button
          variant="softViolet"
          disabled={locked}
          onClick={() => {
            if (!guardWriteOrToast()) return;
            const result = groupAsOr(presentIds);
            if (!result.ok) showToast('error', result.reason);
            else showToast('success', 'OR-grouped.');
          }}
        >
          Group as OR
        </Button>
        <Button
          variant="softViolet"
          disabled={locked}
          onClick={() => {
            if (!guardWriteOrToast()) return;
            const result = groupAsXor(presentIds);
            if (!result.ok) showToast('error', result.reason);
            else showToast('success', 'XOR-grouped.');
          }}
        >
          Group as XOR
        </Button>
      </div>
      {(hasAndGrouped || hasOrGrouped || hasXorGrouped) && (
        <div className="flex flex-col gap-2">
          {hasAndGrouped && (
            <Button
              variant="softNeutral"
              disabled={locked}
              onClick={() => {
                if (!guardWriteOrToast()) return;
                ungroupAnd(presentIds);
                showToast('info', 'Ungrouped.');
              }}
            >
              Ungroup AND
            </Button>
          )}
          {hasOrGrouped && (
            <Button
              variant="softNeutral"
              disabled={locked}
              onClick={() => {
                if (!guardWriteOrToast()) return;
                ungroupOr(presentIds);
                showToast('info', 'Ungrouped.');
              }}
            >
              Ungroup OR
            </Button>
          )}
          {hasXorGrouped && (
            <Button
              variant="softNeutral"
              disabled={locked}
              onClick={() => {
                if (!guardWriteOrToast()) return;
                ungroupXor(presentIds);
                showToast('info', 'Ungrouped.');
              }}
            >
              Ungroup XOR
            </Button>
          )}
        </div>
      )}

      <Button
        variant="destructive"
        disabled={locked}
        onClick={() => confirmAndDeleteSelection()}
        className="mt-2"
      >
        <Trash2 className="h-3.5 w-3.5" />
        Delete {present.length} edges
      </Button>
    </div>
  );
}
