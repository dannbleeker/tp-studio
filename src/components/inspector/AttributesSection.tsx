import type { AttrKind, AttrValue, Entity } from '@/domain/types';
import { useDocumentStore } from '@/store';
import { Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { Button } from '../ui/Button';
import { Field } from './Field';

/**
 * B7 / B1 — user-defined attributes editor. Works for both entities
 * (rendered inside `EntityInspector`) and edges (rendered inside
 * `EdgeInspector`). The shape is generic: pass the host's current
 * attributes map plus `onSet` / `onRemove` callbacks, and the
 * section handles the key/value/kind UX.
 *
 * Editing the value of an existing attribute is in-place; changing
 * the KIND of an attribute requires removing and re-adding (kind is
 * part of the value's identity — silently coercing a `bool` to a
 * `string` would lose data shape information that downstream
 * consumers rely on). The "Remove" button per row makes that
 * workflow explicit.
 *
 * Add-row UX: clicking "+ Add attribute" opens an inline form for
 * picking key + kind. Once both are set, "Save" commits a default
 * value for that kind (empty string / 0 / false). The user then
 * edits the value in the just-added row.
 */
export type AttributesSectionProps = {
  /** The current attributes map from the host entity / edge. */
  attributes: Record<string, AttrValue> | undefined;
  /** Add or replace a key. The caller decides which store action to
   *  call (setEntityAttribute or setEdgeAttribute). */
  onSet: (key: string, value: AttrValue) => void;
  /** Remove a key. */
  onRemove: (key: string) => void;
};

/**
 * Convenience wrapper for entity-attribute editing. Use this when
 * editing an Entity's attributes; for edges use `<AttributesSection>`
 * directly with the edge's attributes and the edge store actions.
 */
export function EntityAttributesSection({ entity }: { entity: Entity }) {
  const setEntityAttribute = useDocumentStore((s) => s.setEntityAttribute);
  const removeEntityAttribute = useDocumentStore((s) => s.removeEntityAttribute);
  return (
    <AttributesSection
      attributes={entity.attributes}
      onSet={(key, value) => setEntityAttribute(entity.id, key, value)}
      onRemove={(key) => removeEntityAttribute(entity.id, key)}
    />
  );
}

export function AttributesSection({ attributes, onSet, onRemove }: AttributesSectionProps) {
  const locked = useDocumentStore((s) => s.browseLocked);

  const attrs = attributes ?? {};
  const keys = Object.keys(attrs).sort();

  const [adding, setAdding] = useState(false);
  const [newKey, setNewKey] = useState('');
  const [newKind, setNewKind] = useState<AttrKind>('string');

  const commitNew = () => {
    const k = newKey.trim();
    if (!k) return;
    // Don't overwrite an existing key — defensive against double-click
    // on Save plus rapid typing.
    if (k in attrs) return;
    const defaultValue: AttrValue =
      newKind === 'string'
        ? { kind: 'string', value: '' }
        : newKind === 'int'
          ? { kind: 'int', value: 0 }
          : newKind === 'real'
            ? { kind: 'real', value: 0 }
            : { kind: 'bool', value: false };
    onSet(k, defaultValue);
    setNewKey('');
    setNewKind('string');
    setAdding(false);
  };

  return (
    <Field label="Attributes">
      <div className="flex flex-col gap-1.5">
        {keys.length === 0 && !adding && (
          <p className="text-[11px] text-neutral-500 dark:text-neutral-400">
            No attributes yet. Add custom key/value metadata that the built-in fields don't cover.
          </p>
        )}
        {keys.map((k) => {
          const v = attrs[k];
          if (!v) return null;
          return (
            <AttributeRow
              key={k}
              attrKey={k}
              value={v}
              locked={locked}
              onChange={(next) => onSet(k, next)}
              onRemove={() => onRemove(k)}
            />
          );
        })}
        {adding && (
          <div className="flex flex-col gap-1.5 rounded-md border border-neutral-200 bg-neutral-50 p-2 dark:border-neutral-800 dark:bg-neutral-900">
            <input
              type="text"
              value={newKey}
              onChange={(e) => setNewKey(e.target.value)}
              placeholder="Attribute name"
              className="w-full rounded border border-neutral-200 bg-white px-2 py-1 text-xs outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400 dark:border-neutral-700 dark:bg-neutral-950"
              autoComplete="off"
            />
            <select
              value={newKind}
              onChange={(e) => setNewKind(e.target.value as AttrKind)}
              className="w-full rounded border border-neutral-200 bg-white px-2 py-1 text-xs dark:border-neutral-700 dark:bg-neutral-950"
            >
              <option value="string">Text</option>
              <option value="int">Integer</option>
              <option value="real">Number</option>
              <option value="bool">Yes / No</option>
            </select>
            <div className="flex gap-1">
              <Button variant="primary" size="sm" onClick={commitNew} disabled={!newKey.trim()}>
                Save
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setAdding(false);
                  setNewKey('');
                  setNewKind('string');
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
            Add attribute
          </Button>
        )}
      </div>
    </Field>
  );
}

function AttributeRow({
  attrKey,
  value,
  locked,
  onChange,
  onRemove,
}: {
  attrKey: string;
  value: AttrValue;
  locked: boolean;
  onChange: (v: AttrValue) => void;
  onRemove: () => void;
}) {
  return (
    <div className="flex items-center gap-1.5 rounded-md border border-neutral-200 px-2 py-1 dark:border-neutral-800">
      <span
        className="min-w-0 flex-shrink truncate text-[11px] font-mono text-neutral-600 dark:text-neutral-400"
        title={attrKey}
      >
        {attrKey}
      </span>
      <span className="text-[9px] uppercase tracking-wider text-neutral-400">{value.kind}</span>
      <AttributeValueInput value={value} locked={locked} onChange={onChange} />
      <button
        type="button"
        onClick={onRemove}
        disabled={locked}
        className="rounded p-0.5 text-neutral-400 transition hover:bg-rose-50 hover:text-rose-700 disabled:opacity-40 dark:hover:bg-rose-950/40 dark:hover:text-rose-200"
        aria-label={`Remove attribute ${attrKey}`}
        title="Remove"
      >
        <Trash2 className="h-3 w-3" />
      </button>
    </div>
  );
}

function AttributeValueInput({
  value,
  locked,
  onChange,
}: {
  value: AttrValue;
  locked: boolean;
  onChange: (v: AttrValue) => void;
}) {
  const cls =
    'min-w-0 flex-1 rounded border border-neutral-200 bg-white px-2 py-0.5 text-xs outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400 disabled:opacity-60 dark:border-neutral-700 dark:bg-neutral-950';
  if (value.kind === 'string') {
    return (
      <input
        type="text"
        className={cls}
        value={value.value}
        disabled={locked}
        onChange={(e) => onChange({ kind: 'string', value: e.target.value })}
      />
    );
  }
  if (value.kind === 'int') {
    return (
      <input
        type="number"
        step={1}
        className={cls}
        value={value.value}
        disabled={locked}
        onChange={(e) => {
          const n = Number.parseInt(e.target.value, 10);
          if (Number.isInteger(n)) onChange({ kind: 'int', value: n });
        }}
      />
    );
  }
  if (value.kind === 'real') {
    return (
      <input
        type="number"
        step="any"
        className={cls}
        value={value.value}
        disabled={locked}
        onChange={(e) => {
          const n = Number.parseFloat(e.target.value);
          if (Number.isFinite(n)) onChange({ kind: 'real', value: n });
        }}
      />
    );
  }
  // bool
  return (
    <input
      type="checkbox"
      className="ml-auto mr-1 h-4 w-4 cursor-pointer accent-indigo-500"
      checked={value.value}
      disabled={locked}
      onChange={(e) => onChange({ kind: 'bool', value: e.target.checked })}
    />
  );
}
