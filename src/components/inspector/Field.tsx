import type { ReactNode } from 'react';

export function Field({ label, children }: { label: ReactNode; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      {typeof label === 'string' ? (
        <span className="font-semibold text-[10px] text-neutral-500 uppercase tracking-wider dark:text-neutral-400">
          {label}
        </span>
      ) : (
        <div className="font-semibold text-[10px] text-neutral-500 uppercase tracking-wider dark:text-neutral-400">
          {label}
        </div>
      )}
      {children}
    </div>
  );
}
