/**
 * Multi-doc tabs Phase 5, Batch 5.3 — `undoRestoreAction` contract.
 *
 * The shared rule the load dialogs lean on: a new tab is undone by closing
 * it (no toast action), a replace is undone by restoring the previous doc.
 */

import { describe, expect, it, vi } from 'vitest';
import { undoRestoreAction } from '@/components/ui/loadToast';
import { createDocument } from '@/domain/factory';

describe('Batch 5.3 — undoRestoreAction', () => {
  it('offers no Undo action when the load opened a new tab', () => {
    const prev = createDocument('crt');
    expect(undoRestoreAction(true, prev, () => {})).toBeUndefined();
  });

  it('offers an Undo that restores the previous doc in replace mode', () => {
    const prev = createDocument('crt');
    const setDocument = vi.fn();
    const opts = undoRestoreAction(false, prev, setDocument);
    expect(opts?.action.label).toBe('Undo');
    opts?.action.run();
    expect(setDocument).toHaveBeenCalledWith(prev);
  });
});
