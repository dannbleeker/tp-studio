/**
 * `isAnyModalOpen` — the modal gate that hides canvas overlays (the
 * SelectionToolbar) while a centered dialog is up.
 *
 * Regression guard for the gap found reviewing the toolbar: Import picker,
 * Pattern library, About, Whiteboard-paste, Read-all-at-once, and the
 * visual-diff Compare were missing from the check, so the toolbar would
 * render behind those dialogs. Every centered modal must flip the gate; side
 * panels (Inspector / Revision panel) must NOT.
 */

import { beforeEach, describe, expect, it } from 'vitest';
import { isAnyModalOpen } from '@/hooks/useCanvasInteractionState';
import { resetStoreForTest, useDocumentStore } from '@/store';

const s = () => useDocumentStore.getState();
const set = useDocumentStore.setState;

beforeEach(() => resetStoreForTest());

describe('isAnyModalOpen', () => {
  it('is false on a clean store (no dialog open)', () => {
    expect(isAnyModalOpen(s())).toBe(false);
  });

  it.each<[string, () => void]>([
    ['settingsOpen', () => set({ settingsOpen: true })],
    ['helpOpen', () => set({ helpOpen: true })],
    ['aboutOpen', () => set({ aboutOpen: true })],
    ['docSettingsOpen', () => set({ docSettingsOpen: true })],
    ['searchOpen', () => set({ searchOpen: true })],
    ['printOpen', () => set({ printOpen: true })],
    ['diagramPickerOpen', () => set({ diagramPickerOpen: 'new' })],
    ['exportPickerOpen', () => set({ exportPickerOpen: true })],
    ['importPickerOpen', () => set({ importPickerOpen: true })],
    ['templatePickerOpen', () => set({ templatePickerOpen: true })],
    ['patternLibraryOpen', () => set({ patternLibraryOpen: { filter: 'all' } })],
    ['whiteboardPasteOpen', () => set({ whiteboardPasteOpen: true })],
    ['readAllAtOnceOpen', () => set({ readAllAtOnceOpen: true })],
    ['quickCaptureOpen', () => set({ quickCaptureOpen: true })],
    ['confirmDialog', () => set({ confirmDialog: { message: 't', resolve: () => {} } })],
    ['sideBySideRevisionId', () => set({ sideBySideRevisionId: 'rev-1' })],
    ['compareRevisionId', () => set({ compareRevisionId: 'rev-1' })],
  ])('is true while %s is open', (label, open) => {
    expect(isAnyModalOpen(s()), `before opening ${label}`).toBe(false);
    open();
    expect(isAnyModalOpen(s()), `after opening ${label}`).toBe(true);
  });

  it('stays false for side panels (the Revision panel is not a centered modal)', () => {
    set({ historyPanelOpen: true });
    expect(isAnyModalOpen(s())).toBe(false);
  });
});
