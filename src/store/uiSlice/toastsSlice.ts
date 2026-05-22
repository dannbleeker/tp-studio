import { nanoid } from 'nanoid';
import type { StateCreator } from 'zustand';
import { TOAST_AUTO_DISMISS_MS_BY_KIND } from '@/domain/constants';
import type { RootStore } from '../types';
import type { Toast, ToastAction, ToastKind } from './types';

/**
 * Session 135 — extracted from `dialogsSlice.ts` (file split). The
 * toast stack is the only part of the old dialogs slice with real
 * runtime logic (dedup + per-kind auto-dismiss); the rest was flat
 * open/close pairs. Promoted to a sibling UI sub-slice (like
 * `searchSlice` / `walkthroughSlice`) so the dialogs slice stays a
 * clean dialog-visibility registry. `showToast` resolves on the root
 * store exactly as before — no consumer changes.
 */
export type ToastsSlice = {
  toasts: Toast[];
  /** Session 88 (S14) — the optional `action` renders an Undo-style
   *  button on the toast. Existing two-arg callers continue to work
   *  unchanged; new call-sites pass `{ action: { label, run } }`.
   *
   *  Session 91 — optional `durationMs` overrides the per-kind default
   *  in `TOAST_AUTO_DISMISS_MS_BY_KIND` (the PWA "New version
   *  available" toast dwells longer so the user can save first). */
  showToast: (
    kind: ToastKind,
    message: string,
    options?: { action?: ToastAction; durationMs?: number }
  ) => void;
  dismissToast: (id: string) => void;
};

export type ToastsDataKeys = 'toasts';

export const toastsDefaults = (): Pick<ToastsSlice, ToastsDataKeys> => ({
  toasts: [],
});

export const createToastsSlice: StateCreator<RootStore, [], [], ToastsSlice> = (set, get) => ({
  toasts: [],

  showToast: (kind, message, options) => {
    // Dedup: if the same (kind, message) is already on the queue, drop
    // this one. Several validators sometimes fire on a single edit and
    // would otherwise stack identical toasts on top of each other. The
    // queue is short (≤5 in practice) so the linear scan is free.
    const existing = get().toasts;
    if (existing.some((t) => t.kind === kind && t.message === message)) return;
    const id = nanoid(8);
    // Session 88 (S14) — action is optional; spread keeps the shape
    // clean for the common two-arg call. The action's `run` is stored
    // by reference; Toaster invokes it on click.
    const toast: Toast = options?.action
      ? { id, kind, message, action: options.action }
      : { id, kind, message };
    set({ toasts: [...existing, toast] });
    // Session 91 — per-kind defaults grade by urgency (success short,
    // info medium, error long); per-call `durationMs` overrides for
    // edge cases like the PWA refresh toast.
    const duration = options?.durationMs ?? TOAST_AUTO_DISMISS_MS_BY_KIND[kind];
    setTimeout(() => {
      set({ toasts: get().toasts.filter((t) => t.id !== id) });
    }, duration);
  },
  dismissToast: (id) => set({ toasts: get().toasts.filter((t) => t.id !== id) }),
});
