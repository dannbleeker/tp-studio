import clsx from 'clsx';
import { useEffect, useRef, useState } from 'react';
import { guardWriteOrToast } from '@/services/browseLock';
import { useDocumentStore } from '@/store';

/**
 * Session 76 — one row of the first-class S&T 5-facet card. Renders the
 * facet's label (uppercased, small caps) above its value. `accent`
 * highlights the Strategy row (the parent objective the tactic serves)
 * so it stands out from the three assumption rows.
 *
 * Session 81 — inline edit. Double-click the row's value to swap it for
 * a small textarea; Enter / blur commits to `setEntityAttribute`; Esc
 * cancels. Empty input clears the facet entirely (via `clearEntityAttribute`).
 * Browse Lock blocks the edit entry — same guard as the title.
 *
 * Session 135 — extracted out of `TPNode.tsx` into its own file. The
 * S&T rendering subsystem is conceptually separate from the
 * everyday-card render code: it only fires for `injection` entities
 * with at least one of the four reserved facet attributes set
 * (`isStNodeFormat` in `domain/graph.ts`), and it carries its own
 * inline-edit state machine. Pulling it out shrinks TPNode.tsx by
 * ~120 lines and lets the S&T-specific behaviour evolve without
 * touching the everyday-card code.
 */
export function StFacetRow({
  entityId,
  attrKey,
  label,
  value,
  accent,
}: {
  entityId: string;
  attrKey: string;
  label: string;
  value: string | undefined;
  accent?: boolean;
}) {
  const setEntityAttribute = useDocumentStore((s) => s.setEntityAttribute);
  const removeEntityAttribute = useDocumentStore((s) => s.removeEntityAttribute);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value ?? '');
  const taRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    if (editing) {
      // Sync the draft to the latest stored value when the user enters
      // edit mode, then focus + select for fast overwrite. Tab/Enter
      // commits; Esc cancels.
      setDraft(value ?? '');
      taRef.current?.focus();
      taRef.current?.select();
    }
  }, [editing, value]);

  const commit = (): void => {
    const next = draft.trim();
    if (next === (value ?? '').trim()) {
      // No-op — short-circuit so the store doesn't fire an undo entry.
      setEditing(false);
      return;
    }
    if (next.length === 0) {
      removeEntityAttribute(entityId, attrKey);
    } else {
      setEntityAttribute(entityId, attrKey, { kind: 'string', value: next });
    }
    setEditing(false);
  };

  const cancel = (): void => {
    setDraft(value ?? '');
    setEditing(false);
  };

  return (
    <div className="flex items-baseline gap-1">
      <span
        className={clsx(
          'shrink-0 font-semibold uppercase tracking-wide',
          accent ? 'text-accent-700 dark:text-accent-300' : 'text-neutral-500 dark:text-neutral-400'
        )}
        style={{ width: 48 }}
      >
        {label}
      </span>
      {editing ? (
        <textarea
          ref={taRef}
          value={draft}
          rows={1}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onClick={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
          onKeyDown={(e) => {
            e.stopPropagation();
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              commit();
            } else if (e.key === 'Escape') {
              e.preventDefault();
              cancel();
            }
          }}
          aria-label={`Edit ${label} facet`}
          className="flex-1 resize-none rounded-sm border border-accent-300 bg-white px-1 py-0 text-[10px] text-neutral-900 leading-tight outline-hidden focus:border-accent-500 focus:ring-1 focus:ring-accent-400 dark:border-accent-700 dark:bg-neutral-950 dark:text-neutral-100"
        />
      ) : (
        <button
          type="button"
          // Double-click matches the title's edit gesture. Click alone
          // would conflict with React Flow's drag/select handling, and
          // single-click-to-edit would surprise users navigating around
          // the canvas.
          onDoubleClick={(e) => {
            e.stopPropagation();
            if (!guardWriteOrToast()) return;
            setEditing(true);
          }}
          aria-label={`Edit ${label} facet (double-click)`}
          className={clsx(
            'flex-1 cursor-text truncate rounded-xs px-0.5 text-left transition hover:bg-accent-50 dark:hover:bg-accent-950/30',
            value ? '' : 'text-neutral-400 italic dark:text-neutral-500'
          )}
          title={value ? `${value} — double-click to edit` : 'Double-click to set'}
        >
          {value || '(unset)'}
        </button>
      )}
    </div>
  );
}
