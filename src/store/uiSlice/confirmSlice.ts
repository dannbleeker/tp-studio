import type { StateCreator } from 'zustand';
import type { RootStore } from '../types';

/**
 * Session 135 — extracted from `dialogsSlice.ts` (file split). The
 * async-confirm dialog replaces `window.confirm` with a theme-aware,
 * non-blocking promise: `confirm()` stashes the pending resolver in
 * the store and returns a `Promise<boolean>` that the `<ConfirmDialog>`
 * component settles via `resolveConfirm`. Self-contained promise
 * plumbing — promoted to its own UI sub-slice alongside `toastsSlice`.
 */
export type ConfirmSlice = {
  /** Holds the message + pending resolver while a confirm is open;
   *  `null` when closed. The `<ConfirmDialog>` component reads this. */
  confirmDialog: {
    message: string;
    confirmLabel?: string;
    cancelLabel?: string;
    /** Resolver kept in store so the dialog component can settle it on click. */
    resolve: (ok: boolean) => void;
  } | null;
  /**
   * Open the async-confirm dialog. Resolves to `true` if the user
   * confirms, `false` if they cancel (Esc, backdrop click, or Cancel
   * button). Use this in place of `window.confirm`.
   */
  confirm: (
    message: string,
    options?: { confirmLabel?: string; cancelLabel?: string }
  ) => Promise<boolean>;
  /** Settle the open confirm with the given answer. The component wires
   *  both buttons + Esc through this. */
  resolveConfirm: (ok: boolean) => void;
};

export type ConfirmDataKeys = 'confirmDialog';

export const confirmDefaults = (): Pick<ConfirmSlice, ConfirmDataKeys> => ({
  confirmDialog: null,
});

export const createConfirmSlice: StateCreator<RootStore, [], [], ConfirmSlice> = (set, get) => ({
  confirmDialog: null,

  confirm: (message, options) => {
    // If a confirm is somehow already open, resolve it as `false` first
    // so the previous caller doesn't hang on a forever-pending promise.
    const existing = get().confirmDialog;
    if (existing) existing.resolve(false);
    return new Promise<boolean>((resolve) => {
      set({
        confirmDialog: {
          message,
          // Conditional spread to avoid passing `confirmLabel:
          // undefined` / `cancelLabel: undefined` when the options
          // object omits them — the confirmDialog type's optional
          // string fields reject explicit undefined under
          // exactOptionalPropertyTypes.
          ...(options?.confirmLabel !== undefined ? { confirmLabel: options.confirmLabel } : {}),
          ...(options?.cancelLabel !== undefined ? { cancelLabel: options.cancelLabel } : {}),
          resolve,
        },
      });
    });
  },
  resolveConfirm: (ok) => {
    const current = get().confirmDialog;
    if (!current) return;
    current.resolve(ok);
    set({ confirmDialog: null });
  },
});
