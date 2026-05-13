import { Field } from '@/components/inspector/Field';
import { Button } from '@/components/ui/Button';
import {
  CUSTOM_CLASS_ICONS,
  CUSTOM_CLASS_ICON_NAMES,
  ENTITY_TYPE_META,
} from '@/domain/entityTypeMeta';
import type { CustomEntityClass, EntityType } from '@/domain/types';
import { useDocumentStore } from '@/store';
import { Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { useShallow } from 'zustand/shallow';

/**
 * B10 — per-document custom entity class manager. Lives in the
 * Document Inspector under a collapsible `<details>` section.
 *
 * UX:
 *   - Existing classes render as one row each (label, color swatch,
 *     supersetOf indicator, remove button).
 *   - "+ Add class" opens an inline form for id / label / color /
 *     supersetOf. Save validates the slug (lowercased, [a-z0-9-]+, no
 *     built-in collision) and commits via `upsertCustomEntityClass`.
 *
 * Slug rule duplicated from `persistenceValidators.ts` — the validator
 * is the authority at load time; this UI rejects obvious mistakes
 * before they hit the store. The two checks should stay in sync.
 */
const SLUG_RE = /^[a-z0-9][a-z0-9-]*$/;
const BUILTIN_IDS = new Set(Object.keys(ENTITY_TYPE_META));

// Hex stripe color the picker defaults to — matches the neutral
// fallback used by `resolveEntityTypeMeta` for classes without a color.
const DEFAULT_COLOR = '#64748b';

const SUPERSET_OPTIONS: { id: EntityType | ''; label: string }[] = [
  { id: '', label: '(none — purely decorative)' },
  ...(Object.keys(ENTITY_TYPE_META) as EntityType[]).map((t) => ({
    id: t,
    label: ENTITY_TYPE_META[t].label,
  })),
];

export function CustomEntityClassesSection() {
  const { customClasses, upsert, remove, locked } = useDocumentStore(
    useShallow((s) => ({
      customClasses: s.doc.customEntityClasses,
      upsert: s.upsertCustomEntityClass,
      remove: s.removeCustomEntityClass,
      locked: s.browseLocked,
    }))
  );

  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState<CustomEntityClass>({
    id: '',
    label: '',
    color: DEFAULT_COLOR,
  });
  const [error, setError] = useState<string | null>(null);
  // Session 76 — icon-picker filter. Substring match against icon names;
  // empty filter shows the full catalogue. Reset alongside the rest of
  // the draft form when the user cancels or saves.
  const [iconFilter, setIconFilter] = useState('');

  const existing = customClasses ?? {};
  const ids = Object.keys(existing).sort();

  const commit = () => {
    setError(null);
    const id = draft.id.trim().toLowerCase();
    const label = draft.label.trim();
    if (!id) {
      setError('Pick an id (lowercase, letters/digits/dashes).');
      return;
    }
    if (!SLUG_RE.test(id)) {
      setError('Invalid id — use lowercase letters, digits, dashes only.');
      return;
    }
    if (BUILTIN_IDS.has(id)) {
      setError(`"${id}" is a built-in entity type; pick a different id.`);
      return;
    }
    if (id in existing) {
      setError(`"${id}" already exists. Remove it first or pick another id.`);
      return;
    }
    if (!label) {
      setError('Pick a human-readable label.');
      return;
    }
    upsert({ ...draft, id, label });
    setDraft({ id: '', label: '', color: DEFAULT_COLOR });
    setIconFilter('');
    setAdding(false);
  };

  return (
    <Field label="Custom entity classes">
      <div className="flex flex-col gap-1.5">
        {ids.length === 0 && !adding && (
          <p className="text-[11px] text-neutral-500 dark:text-neutral-400">
            Define your own entity types for this document. Useful when the built-in TOC types (UDE,
            Effect, Root Cause, etc.) don't match your domain.
          </p>
        )}
        {ids.map((id) => {
          const cls = existing[id];
          if (!cls) return null;
          return (
            <div
              key={id}
              className="flex items-center gap-2 rounded-md border border-neutral-200 px-2 py-1 dark:border-neutral-800"
            >
              <span
                className="h-3 w-1 shrink-0 rounded"
                style={{ backgroundColor: cls.color ?? DEFAULT_COLOR }}
                aria-hidden
              />
              {(() => {
                const Icon = cls.icon ? CUSTOM_CLASS_ICONS[cls.icon] : undefined;
                return Icon ? (
                  <Icon
                    className="h-3 w-3 shrink-0 text-neutral-500 dark:text-neutral-400"
                    aria-hidden
                  />
                ) : null;
              })()}
              <span className="flex-1 truncate text-xs">
                <span className="font-medium">{cls.label}</span>{' '}
                <span className="font-mono text-[10px] text-neutral-500">({cls.id})</span>
                {cls.supersetOf && (
                  <span className="ml-2 text-[10px] text-neutral-500">
                    behaves as {ENTITY_TYPE_META[cls.supersetOf].label}
                  </span>
                )}
              </span>
              <button
                type="button"
                onClick={() => remove(id)}
                disabled={locked}
                className="rounded p-0.5 text-neutral-400 transition hover:bg-rose-50 hover:text-rose-700 disabled:opacity-40 dark:hover:bg-rose-950/40 dark:hover:text-rose-200"
                aria-label={`Remove ${cls.label}`}
                title="Remove"
              >
                <Trash2 className="h-3 w-3" />
              </button>
            </div>
          );
        })}
        {adding && (
          <div className="flex flex-col gap-1.5 rounded-md border border-neutral-200 bg-neutral-50 p-2 dark:border-neutral-800 dark:bg-neutral-900">
            <input
              type="text"
              value={draft.id}
              onChange={(e) => setDraft({ ...draft, id: e.target.value })}
              placeholder="id (e.g. evidence)"
              className="w-full rounded border border-neutral-200 bg-white px-2 py-1 font-mono text-xs outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400 dark:border-neutral-700 dark:bg-neutral-950"
              autoComplete="off"
            />
            <input
              type="text"
              value={draft.label}
              onChange={(e) => setDraft({ ...draft, label: e.target.value })}
              placeholder="Label (e.g. Evidence)"
              className="w-full rounded border border-neutral-200 bg-white px-2 py-1 text-xs outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400 dark:border-neutral-700 dark:bg-neutral-950"
            />
            <label className="flex items-center gap-2 text-xs">
              <span className="text-neutral-600 dark:text-neutral-300">Color</span>
              <input
                type="color"
                value={draft.color ?? DEFAULT_COLOR}
                onChange={(e) => setDraft({ ...draft, color: e.target.value })}
                className="h-6 w-10 cursor-pointer rounded border border-neutral-200 dark:border-neutral-700"
              />
            </label>
            <div className="flex flex-col gap-1 text-xs">
              <span className="text-neutral-600 dark:text-neutral-300">Icon</span>
              <input
                type="text"
                value={iconFilter}
                onChange={(e) => setIconFilter(e.target.value)}
                placeholder="Filter icons (e.g. flag, lock, map)"
                className="w-full rounded border border-neutral-200 bg-white px-2 py-1 text-xs outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400 dark:border-neutral-700 dark:bg-neutral-950"
                autoComplete="off"
              />
              <div className="flex max-h-32 flex-wrap gap-1 overflow-y-auto">
                {CUSTOM_CLASS_ICON_NAMES.filter((name) =>
                  iconFilter.trim() === ''
                    ? true
                    : name.toLowerCase().includes(iconFilter.trim().toLowerCase())
                ).map((name) => {
                  const Icon = CUSTOM_CLASS_ICONS[name];
                  if (!Icon) return null;
                  const selected = draft.icon === name;
                  return (
                    <button
                      key={name}
                      type="button"
                      onClick={() => setDraft({ ...draft, icon: selected ? undefined : name })}
                      title={name}
                      aria-label={`Use ${name} icon`}
                      aria-pressed={selected}
                      className={`flex h-6 w-6 items-center justify-center rounded border transition ${
                        selected
                          ? 'border-indigo-400 bg-indigo-50 text-indigo-700 dark:border-indigo-500 dark:bg-indigo-950 dark:text-indigo-200'
                          : 'border-neutral-200 hover:bg-neutral-100 dark:border-neutral-700 dark:hover:bg-neutral-800'
                      }`}
                    >
                      <Icon className="h-3.5 w-3.5" />
                    </button>
                  );
                })}
              </div>
              <p className="text-[10px] text-neutral-500 dark:text-neutral-400">
                {CUSTOM_CLASS_ICON_NAMES.length} icons available. Power users can hand-edit JSON to
                reference any Lucide icon by name (unknown names render with the Box fallback until
                they're added to the curated set).
              </p>
            </div>
            <label className="flex flex-col gap-0.5 text-xs">
              <span className="text-neutral-600 dark:text-neutral-300">
                Behaves as (validators)
              </span>
              <select
                value={draft.supersetOf ?? ''}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    supersetOf: e.target.value ? (e.target.value as EntityType) : undefined,
                  })
                }
                className="w-full rounded border border-neutral-200 bg-white px-2 py-1 dark:border-neutral-700 dark:bg-neutral-950"
              >
                {SUPERSET_OPTIONS.map((opt) => (
                  <option key={opt.id} value={opt.id}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </label>
            {error && <p className="text-[11px] text-rose-600 dark:text-rose-400">{error}</p>}
            <div className="flex gap-1">
              <Button variant="primary" size="sm" onClick={commit}>
                Save
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setAdding(false);
                  setDraft({ id: '', label: '', color: DEFAULT_COLOR });
                  setIconFilter('');
                  setError(null);
                }}
              >
                Cancel
              </Button>
            </div>
          </div>
        )}
        {!adding && !locked && (
          <Button
            variant="softNeutral"
            size="sm"
            onClick={() => setAdding(true)}
            className="self-start"
          >
            <Plus className="h-3 w-3" />
            Add class
          </Button>
        )}
      </div>
    </Field>
  );
}
