import clsx from 'clsx';
import { Eye, Pencil } from 'lucide-react';
import { Suspense, lazy, useState } from 'react';
import { Field } from './Field';

/**
 * Session 115 / Tier-3 #14 — `MarkdownPreview` (along with its
 * transitive deps: DOMPurify ~18 KB gz + the micromark parser stack
 * ~25 KB gz) is now lazy-loaded. It only renders when the user
 * actively switches to Preview mode (the default is Edit), so the
 * markdown deps don't pay their cost on first paint or for users who
 * never preview a description.
 *
 * Suspense fallback is a single-line placeholder that matches the
 * surrounding preview surface so the flash on first preview-mode
 * click is barely perceptible. After the chunk loads, all subsequent
 * preview toggles in the session are instant (browser-cached chunk).
 */
const MarkdownPreview = lazy(() =>
  import('@/components/ui/MarkdownPreview').then((m) => ({ default: m.MarkdownPreview }))
);

/**
 * Text input that doubles as a markdown preview. Toggle between Edit and
 * Preview via the small tab buttons. Used for entity / document / group
 * descriptions and any other multi-line markdown-supporting field.
 *
 * When `locked` is true (Browse Lock), the field is read-only AND the
 * preview mode is forced — there's nothing useful to do in edit mode.
 */
export function MarkdownField({
  label,
  value,
  onChange,
  placeholder,
  rows = 4,
  locked = false,
}: {
  label: string;
  value: string;
  onChange: (next: string) => void;
  placeholder?: string;
  rows?: number;
  locked?: boolean;
}) {
  const [mode, setMode] = useState<'edit' | 'preview'>('edit');
  const effectiveMode = locked ? 'preview' : mode;

  return (
    <Field
      label={
        <div className="flex items-center justify-between gap-2">
          <span>{label}</span>
          {!locked && (
            <div className="flex items-center gap-0.5 rounded-md border border-neutral-200 bg-neutral-100 p-0.5 dark:border-neutral-800 dark:bg-neutral-900">
              <ModeButton active={effectiveMode === 'edit'} onClick={() => setMode('edit')}>
                <Pencil className="h-3 w-3" />
                Edit
              </ModeButton>
              <ModeButton active={effectiveMode === 'preview'} onClick={() => setMode('preview')}>
                <Eye className="h-3 w-3" />
                Preview
              </ModeButton>
            </div>
          )}
        </div>
      }
    >
      {effectiveMode === 'edit' ? (
        <textarea
          className="w-full resize-y rounded-md border border-neutral-200 bg-white px-2 py-1.5 font-mono text-neutral-900 text-xs leading-relaxed outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400 disabled:opacity-60 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-100"
          rows={rows}
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={locked}
        />
      ) : (
        <div className="min-h-[4rem] rounded-md border border-neutral-200 bg-neutral-50 px-2 py-1.5 dark:border-neutral-800 dark:bg-neutral-900/50">
          <Suspense fallback={<p className="text-neutral-400 text-xs italic">Loading preview…</p>}>
            <MarkdownPreview source={value} />
          </Suspense>
        </div>
      )}
    </Field>
  );
}

function ModeButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={clsx(
        'flex items-center gap-1 rounded px-1.5 py-0.5 font-medium text-[10px] uppercase tracking-wider transition',
        active
          ? 'bg-white text-neutral-700 shadow-sm dark:bg-neutral-800 dark:text-neutral-100'
          : 'text-neutral-500 hover:text-neutral-700 dark:text-neutral-400 dark:hover:text-neutral-200'
      )}
    >
      {children}
    </button>
  );
}
