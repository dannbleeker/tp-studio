import clsx from 'clsx';
import type { ReactNode } from 'react';

/**
 * Session 135 (design audit #10) — tinted inset note card.
 *
 * Six "tinted inline note" recipes had drifted across the inspectors
 * (Imported-from, EC guiding question, EC brainstorm prompt, Evidence
 * row, Attributes add-row) — same shape, different padding (px-2 /
 * px-3 / p-2), opacity (/60 / /70 / opaque), and dark-mode washes
 * (/30 / /40). This bakes one canonical padding (`px-3 py-2`) + one
 * opacity per role:
 *   - light: `/60` for every tone
 *   - dark: `/40` for accent tones (indigo / amber), `/60` for neutral
 *
 * Extra props (`aria-label`, `data-component`, `role`…) pass through so
 * a caller that was an `<aside>` landmark keeps its semantics.
 */
const TONE: Record<'indigo' | 'amber' | 'neutral', string> = {
  indigo:
    'border-indigo-200 bg-indigo-50/60 text-indigo-900 dark:border-indigo-900/40 dark:bg-indigo-950/40 dark:text-indigo-100',
  amber:
    'border-amber-200 bg-amber-50/60 text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/40 dark:text-amber-100',
  neutral:
    'border-neutral-200 bg-neutral-50/60 text-neutral-700 dark:border-neutral-800 dark:bg-neutral-900/60 dark:text-neutral-200',
};

export function InsetCard({
  tone = 'neutral',
  className,
  children,
  ...rest
}: {
  tone?: 'indigo' | 'amber' | 'neutral';
  className?: string;
  children: ReactNode;
} & React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={clsx('rounded-md border px-3 py-2 text-xs', TONE[tone], className)} {...rest}>
      {children}
    </div>
  );
}
