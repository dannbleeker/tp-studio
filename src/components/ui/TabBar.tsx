import clsx from 'clsx';

/**
 * Session 135 (design audit #11) — shared horizontal tab bar. The
 * Inspector EC-views bar and the Settings sections bar were two
 * near-identical 25-line `role="tablist"` implementations that had
 * already drifted (py-1.5 vs py-2). One component, one source of truth
 * for the indigo-underline active pattern + ARIA wiring.
 *
 * Tabs are equal-width (`flex-1`). The caller owns the active id and
 * the panels; this just renders the bar and reports clicks.
 */
export function TabBar<T extends string>({
  tabs,
  active,
  onChange,
  ariaLabel,
}: {
  tabs: readonly { id: T; label: string }[];
  active: T;
  onChange: (id: T) => void;
  ariaLabel: string;
}) {
  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className="flex border-neutral-200 border-b px-2 dark:border-neutral-800"
    >
      {tabs.map((t) => {
        const isActive = active === t.id;
        return (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(t.id)}
            className={clsx(
              'flex-1 px-2 py-2 font-semibold text-[11px] uppercase tracking-wide transition',
              isActive
                ? 'border-indigo-500 border-b-2 text-indigo-700 dark:border-indigo-400 dark:text-indigo-300'
                : 'border-transparent border-b-2 text-neutral-500 hover:text-neutral-700 dark:text-neutral-400 dark:hover:text-neutral-200'
            )}
          >
            {t.label}
          </button>
        );
      })}
    </div>
  );
}
