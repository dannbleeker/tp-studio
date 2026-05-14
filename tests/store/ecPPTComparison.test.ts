import { resetStoreForTest, useDocumentStore } from '@/store';
import { beforeEach, describe, expect, it } from 'vitest';

beforeEach(resetStoreForTest);

/**
 * Session 87 — EC PPT comparison store-action tests. Covers the new
 * store surface added across items #1, #4, #6, #7:
 *
 *   - `dismissECReadingInstructions` (#1) — session-scoped dismissal
 *     flag for the canvas reading-instruction strip.
 *   - `setECVerbalStyle` (#4) — per-doc verbal-style toggle, including
 *     'neutral' as the implicit-default clear.
 *   - `setECInspectorTab` / `requestECInjectionsView` (#1 + #7) — the
 *     EC inspector tab is lifted to the store so canvas chrome can
 *     request a tab from outside the Inspector component.
 */

describe('Session 87 — EC reading-instruction dismissal flag', () => {
  it('defaults to false', () => {
    expect(useDocumentStore.getState().ecReadingInstructionsDismissed).toBe(false);
  });

  it('dismissECReadingInstructions flips the flag to true', () => {
    useDocumentStore.getState().dismissECReadingInstructions();
    expect(useDocumentStore.getState().ecReadingInstructionsDismissed).toBe(true);
  });

  it('resets to false on resetStoreForTest', () => {
    useDocumentStore.getState().dismissECReadingInstructions();
    resetStoreForTest();
    expect(useDocumentStore.getState().ecReadingInstructionsDismissed).toBe(false);
  });
});

describe('Session 87 — setECVerbalStyle', () => {
  it('defaults to undefined on a fresh doc (interpreted as neutral)', () => {
    useDocumentStore.getState().newDocument('ec');
    expect(useDocumentStore.getState().doc.ecVerbalStyle).toBeUndefined();
  });

  it("'twoSided' persists on the doc", () => {
    useDocumentStore.getState().newDocument('ec');
    useDocumentStore.getState().setECVerbalStyle('twoSided');
    expect(useDocumentStore.getState().doc.ecVerbalStyle).toBe('twoSided');
  });

  it("'neutral' clears the field rather than persisting the default", () => {
    useDocumentStore.getState().newDocument('ec');
    useDocumentStore.getState().setECVerbalStyle('twoSided');
    expect(useDocumentStore.getState().doc.ecVerbalStyle).toBe('twoSided');
    useDocumentStore.getState().setECVerbalStyle('neutral');
    expect(useDocumentStore.getState().doc.ecVerbalStyle).toBeUndefined();
  });

  it('is a no-op when the style is already the requested value', () => {
    useDocumentStore.getState().newDocument('ec');
    useDocumentStore.getState().setECVerbalStyle('twoSided');
    const docBefore = useDocumentStore.getState().doc;
    useDocumentStore.getState().setECVerbalStyle('twoSided');
    // Reference equality: a no-op leaves the same doc object in place,
    // preserving the existing history-coalesce semantics.
    expect(useDocumentStore.getState().doc).toBe(docBefore);
  });
});

describe('Session 87 — EC inspector tab + injection-view request', () => {
  it("defaults to 'inspector'", () => {
    expect(useDocumentStore.getState().ecInspectorTab).toBe('inspector');
  });

  it('setECInspectorTab updates the active tab', () => {
    useDocumentStore.getState().setECInspectorTab('verbalisation');
    expect(useDocumentStore.getState().ecInspectorTab).toBe('verbalisation');
  });

  it("requestECInjectionsView jumps the tab to 'injections'", () => {
    useDocumentStore.getState().setECInspectorTab('verbalisation');
    useDocumentStore.getState().requestECInjectionsView();
    expect(useDocumentStore.getState().ecInspectorTab).toBe('injections');
  });

  it("resets to 'inspector' on resetStoreForTest", () => {
    useDocumentStore.getState().setECInspectorTab('injections');
    resetStoreForTest();
    expect(useDocumentStore.getState().ecInspectorTab).toBe('inspector');
  });
});
