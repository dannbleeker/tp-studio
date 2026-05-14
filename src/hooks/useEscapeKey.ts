import { useEffect } from 'react';

/**
 * Session 87 (S23) — shared Escape-key handler hook for modals,
 * dialogs, and slide-in panels.
 *
 * Pre-fix, Esc handling was scattered: SettingsDialog relied on the
 * Modal primitive, PrintPreviewDialog wired its own keydown effect,
 * TemplatePickerDialog did the same, the Inspector closed via a
 * global shortcut, and the CreationWizard had its own per-textarea
 * keydown branch. Five different code paths drifted apart on details
 * (Should preventDefault fire? Does propagation stop? Does the
 * handler still listen when the modal is closed?).
 *
 * This hook centralizes the pattern:
 *
 *   - **Listens at the window level** when `enabled` is true, removes
 *     itself when false.
 *   - **`preventDefault()` + `stopPropagation()`** so an inner modal's
 *     Esc doesn't also fire a parent surface's handler (e.g. closing
 *     a print preview shouldn't also clear the canvas selection).
 *   - **No global "topmost wins" registry** — the consumer controls
 *     `enabled` and the standard event-listener stacking gives a
 *     reasonable default (modals mounted later "see" Esc first if
 *     they `stopPropagation`).
 *
 * Existing CreationWizard "Esc-armed" pattern (double-Esc to discard a
 * non-empty draft) stays on its own; it owns a textarea event handler,
 * not a window-level one, and the two layers compose without
 * conflict.
 *
 * @example
 *   useEscapeKey(open, close);
 */
export const useEscapeKey = (enabled: boolean, handler: () => void): void => {
  useEffect(() => {
    if (!enabled) return;
    const onKey = (e: KeyboardEvent): void => {
      if (e.key !== 'Escape') return;
      e.preventDefault();
      e.stopPropagation();
      handler();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [enabled, handler]);
};
