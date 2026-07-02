import clsx from 'clsx';
import { ChevronDown } from 'lucide-react';
import { type ReactNode, useState } from 'react';
import { log } from '@/services/logger';

/**
 * Session 193 — a collapsible inspector section: a header button (label +
 * chevron) over a body region. Open/closed state is per-section (keyed by
 * `id`), NOT per-entity, so a collapse sticks as you click between entities and
 * survives reloads via localStorage. Used to fold the inspector's secondary
 * groups (Appearance tweaks, advanced flags) out of the default view so the
 * core Title / Type / Description / State fields aren't buried under a long
 * scroll. Best-effort persistence — a throwing localStorage degrades to the
 * `defaultOpen` value rather than crashing the inspector.
 */

const KEY_PREFIX = 'tp-inspector-section:';

const readOpen = (id: string, defaultOpen: boolean): boolean => {
  if (typeof window === 'undefined') return defaultOpen;
  try {
    const v = window.localStorage.getItem(KEY_PREFIX + id);
    return v === null ? defaultOpen : v === '1';
  } catch (err) {
    log.warn('inspector-section-read-failed', err);
    return defaultOpen;
  }
};

const writeOpen = (id: string, open: boolean): void => {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(KEY_PREFIX + id, open ? '1' : '0');
  } catch (err) {
    log.warn('inspector-section-write-failed', err);
  }
};

export function CollapsibleSection({
  id,
  title,
  defaultOpen = true,
  children,
}: {
  /** Stable id — the localStorage key + the aria-controls target. */
  id: string;
  title: string;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(() => readOpen(id, defaultOpen));
  const bodyId = `inspector-section-${id}`;
  const toggle = (): void => {
    setOpen((prev) => {
      const next = !prev;
      writeOpen(id, next);
      return next;
    });
  };
  return (
    <section className="flex flex-col gap-2">
      <button
        type="button"
        onClick={toggle}
        aria-expanded={open}
        aria-controls={bodyId}
        className="-mx-1 flex items-center justify-between gap-2 rounded-md px-1 py-0.5 text-left text-neutral-500 transition hover:text-neutral-800 dark:text-neutral-400 dark:hover:text-neutral-100"
      >
        <span className="font-semibold text-[10px] uppercase tracking-wider">{title}</span>
        <ChevronDown
          className={clsx('h-3.5 w-3.5 shrink-0 transition-transform', !open && '-rotate-90')}
          aria-hidden
        />
      </button>
      {/* Always in the DOM so the button's `aria-controls` target exists even
          when collapsed; `hidden` handles the show/hide (and keeps the wrapped
          fields' state across a collapse). */}
      <div id={bodyId} hidden={!open} className="flex flex-col gap-4">
        {children}
      </div>
    </section>
  );
}
