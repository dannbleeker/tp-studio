import clsx from 'clsx';
import { type ButtonHTMLAttributes, forwardRef } from 'react';

export type ButtonVariant = 'primary' | 'ghost' | 'softNeutral' | 'softViolet' | 'destructive';

export type ButtonSize = 'sm' | 'md' | 'icon';

const BASE =
  'inline-flex items-center justify-center gap-1.5 rounded-md font-medium transition outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 disabled:cursor-not-allowed disabled:opacity-50';

const SIZE: Record<ButtonSize, string> = {
  sm: 'px-2 py-1 text-xs',
  md: 'px-2.5 py-1.5 text-xs',
  icon: 'p-1.5 text-xs',
};

const VARIANT: Record<ButtonVariant, string> = {
  primary: 'border border-indigo-500 bg-indigo-500 text-white shadow-sm hover:bg-indigo-600',
  ghost:
    'border border-transparent text-neutral-500 hover:bg-neutral-100 hover:text-neutral-700 dark:hover:bg-neutral-800 dark:hover:text-neutral-200',
  softNeutral:
    'border border-neutral-200 bg-white/90 text-neutral-600 shadow-sm hover:bg-white hover:text-neutral-900 dark:border-neutral-800 dark:bg-neutral-950/90 dark:text-neutral-400 dark:hover:bg-neutral-900 dark:hover:text-neutral-100',
  softViolet:
    'border border-violet-200 bg-violet-50 text-violet-700 hover:bg-violet-100 dark:border-violet-900/40 dark:bg-violet-950/40 dark:text-violet-300',
  destructive:
    'border border-red-200 bg-red-50 text-red-700 hover:bg-red-100 dark:border-red-900/40 dark:bg-red-950/40 dark:text-red-300',
};

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'ghost', size = 'md', className, type = 'button', ...rest },
  ref
) {
  return (
    <button
      ref={ref}
      type={type}
      className={clsx(BASE, SIZE[size], VARIANT[variant], className)}
      {...rest}
    />
  );
});
