import type { StateCreator } from 'zustand';
import type { RootStore } from '../types';

/**
 * In-app replacement for `window.prompt` — a theme-aware, non-blocking text
 * prompt. Mirrors `confirmSlice`: `prompt()` stashes a pending resolver in the
 * store and returns a `Promise<string | null>` that the `<PromptDialog>` shell
 * settles via `resolvePrompt` (a trimmed value on submit, `null` on cancel).
 * Self-contained promise plumbing; the store coupling lives in `PromptDialogHost`.
 */
export type PromptSlice = {
  /** Holds the message + options + pending resolver while a prompt is open;
   *  `null` when closed. The `<PromptDialogHost>` reads this. */
  promptDialog: {
    message: string;
    defaultValue: string;
    placeholder?: string;
    confirmLabel?: string;
    resolve: (value: string | null) => void;
  } | null;
  /**
   * Open the async text prompt. Resolves to the entered string if the user
   * submits, or `null` if they cancel (Esc, backdrop click, or Cancel). Use
   * this in place of `window.prompt`.
   */
  prompt: (
    message: string,
    options?: { defaultValue?: string; placeholder?: string; confirmLabel?: string }
  ) => Promise<string | null>;
  /** Settle the open prompt with the given value (or `null` to cancel). */
  resolvePrompt: (value: string | null) => void;
};

export type PromptDataKeys = 'promptDialog';

export const promptDefaults = (): Pick<PromptSlice, PromptDataKeys> => ({
  promptDialog: null,
});

export const createPromptSlice: StateCreator<RootStore, [], [], PromptSlice> = (set, get) => ({
  promptDialog: null,

  prompt: (message, options) => {
    // If a prompt is somehow already open, resolve it as cancelled first so the
    // previous caller doesn't hang on a forever-pending promise.
    const existing = get().promptDialog;
    if (existing) existing.resolve(null);
    return new Promise<string | null>((resolve) => {
      set({
        promptDialog: {
          message,
          defaultValue: options?.defaultValue ?? '',
          // Conditional spread avoids passing explicit `undefined` under
          // exactOptionalPropertyTypes (the optional string fields reject it).
          ...(options?.placeholder !== undefined ? { placeholder: options.placeholder } : {}),
          ...(options?.confirmLabel !== undefined ? { confirmLabel: options.confirmLabel } : {}),
          resolve,
        },
      });
    });
  },
  resolvePrompt: (value) => {
    const current = get().promptDialog;
    if (!current) return;
    current.resolve(value);
    set({ promptDialog: null });
  },
});
