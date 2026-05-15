import { TextInput } from '@/components/settings/formPrimitives';
import { Button } from '@/components/ui/Button';
import { INPUT_FOCUS } from '@/components/ui/focusClasses';
import { GROUP_COLORS_ORDER, GROUP_COLOR_CLASSES } from '@/domain/groupColors';
import { GROUP_PRESETS } from '@/domain/groupPresets';
import { wouldCreateCycle } from '@/domain/groups';
import { guardWriteOrToast } from '@/services/browseLock';
import { useDocumentStore } from '@/store';
import clsx from 'clsx';
import { ChevronDown, ChevronRight, Maximize2, Trash2 } from 'lucide-react';
import { Field } from './Field';

export function GroupInspector({ groupId }: { groupId: string }) {
  // Subscribe to just this group's record; `memberCount` is derived locally
  // so we don't fire a second subscriber for what's already in `group`.
  const group = useDocumentStore((s) => s.doc.groups[groupId]);
  const memberCount = group?.memberIds.length ?? 0;
  const renameGroup = useDocumentStore((s) => s.renameGroup);
  const recolorGroup = useDocumentStore((s) => s.recolorGroup);
  const deleteGroup = useDocumentStore((s) => s.deleteGroup);
  const toggleCollapsed = useDocumentStore((s) => s.toggleGroupCollapsed);
  const hoistGroup = useDocumentStore((s) => s.hoistGroup);
  const addToGroup = useDocumentStore((s) => s.addToGroup);
  const allGroups = useDocumentStore((s) => s.doc.groups);
  const locked = useDocumentStore((s) => s.browseLocked);
  const confirm = useDocumentStore((s) => s.confirm);

  if (!group) return null;

  // FL-GR2: candidate parent groups for nesting. Exclude self + any
  // group that would form a cycle (the current group's transitive
  // descendants — already filtered by `wouldCreateCycle`).
  // Need a tiny fresh doc-shaped object here just for the cycle helper.
  const nestCandidates = Object.values(allGroups)
    .filter((g) => g.id !== groupId)
    .filter((g) => {
      // Avoid recomputing `descendantIds` here; defer to the canonical
      // helper. Build the minimal doc shape it expects (just `groups`).
      const fakeDoc = {
        groups: allGroups,
        entities: {},
        edges: {},
      } as never;
      return !wouldCreateCycle(fakeDoc, g.id, groupId);
    });

  return (
    <div className="flex flex-col gap-4">
      <Field label="Title">
        <TextInput
          value={group.title}
          onChange={(next) => renameGroup(groupId, next)}
          disabled={locked}
        />
      </Field>

      <Field label="Preset">
        {/*
          Book-derived (Session 59): canonical names + colors for the
          structural sub-graphs that recur across TOC tree types. Clicking
          a preset writes title + color in one click; both fields remain
          editable afterward.
        */}
        <div className="flex flex-col gap-1.5">
          {GROUP_PRESETS.map((preset) => (
            <button
              key={preset.id}
              type="button"
              disabled={locked}
              onClick={() => {
                if (!guardWriteOrToast()) return;
                renameGroup(groupId, preset.title);
                recolorGroup(groupId, preset.color);
              }}
              className="flex items-start gap-2 rounded-md border border-neutral-200 px-2 py-1.5 text-left text-xs transition hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-neutral-800 dark:hover:bg-neutral-900"
            >
              <span
                className={clsx(
                  'mt-0.5 h-3 w-3 shrink-0 rounded-full',
                  GROUP_COLOR_CLASSES[preset.color].swatch
                )}
                aria-hidden
              />
              <span className="flex-1">
                <span className="block font-medium text-neutral-800 dark:text-neutral-200">
                  {preset.title}
                </span>
                <span className="block text-[10px] text-neutral-500 dark:text-neutral-400">
                  {preset.hint}
                </span>
              </span>
            </button>
          ))}
        </div>
      </Field>

      <Field label="Color">
        <div className="flex gap-2">
          {GROUP_COLORS_ORDER.map((c) => (
            <button
              key={c}
              type="button"
              disabled={locked}
              onClick={() => {
                if (!guardWriteOrToast()) return;
                recolorGroup(groupId, c);
              }}
              aria-pressed={group.color === c}
              aria-label={c}
              className={clsx(
                'h-6 w-6 rounded-full transition disabled:cursor-not-allowed disabled:opacity-50',
                GROUP_COLOR_CLASSES[c].swatch,
                group.color === c
                  ? 'ring-2 ring-neutral-900 ring-offset-2 dark:ring-neutral-100'
                  : 'hover:scale-110'
              )}
            />
          ))}
        </div>
      </Field>

      <Field label="Members">
        <p className="text-neutral-600 text-xs dark:text-neutral-300">
          {memberCount} {memberCount === 1 ? 'item' : 'items'} in this group.
        </p>
      </Field>

      {nestCandidates.length > 0 && (
        <Field label="Nest into parent group">
          <select
            className={clsx(
              'w-full rounded-md border border-neutral-200 bg-white px-2 py-1.5 text-neutral-900 text-sm disabled:opacity-60 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-100',
              INPUT_FOCUS
            )}
            value=""
            disabled={locked}
            aria-label="Nest this group inside another group"
            onChange={(e) => {
              const targetId = e.target.value;
              if (!targetId) return;
              if (!guardWriteOrToast()) return;
              addToGroup(targetId, groupId);
              // Reset the select so the same pick can be re-applied if the
              // user undoes/redoes outside.
              e.target.value = '';
            }}
          >
            <option value="">Pick a parent group…</option>
            {nestCandidates.map((g) => (
              <option key={g.id} value={g.id}>
                {g.title}
              </option>
            ))}
          </select>
        </Field>
      )}

      <div className="flex flex-col gap-2">
        <Button variant="softNeutral" onClick={() => toggleCollapsed(groupId)}>
          {group.collapsed ? (
            <>
              <ChevronRight className="h-3.5 w-3.5" />
              Expand
            </>
          ) : (
            <>
              <ChevronDown className="h-3.5 w-3.5" />
              Collapse
            </>
          )}
        </Button>
        <Button variant="softNeutral" onClick={() => hoistGroup(groupId)}>
          <Maximize2 className="h-3.5 w-3.5" />
          Hoist into group
        </Button>
      </div>

      <Button
        variant="destructive"
        disabled={locked}
        onClick={async () => {
          if (!guardWriteOrToast()) return;
          const ok = await confirm(`Delete group "${group.title}"? Members will be preserved.`, {
            confirmLabel: 'Delete',
          });
          if (ok) deleteGroup(groupId);
        }}
        className="mt-2"
      >
        <Trash2 className="h-3.5 w-3.5" />
        Delete group
      </Button>
    </div>
  );
}
