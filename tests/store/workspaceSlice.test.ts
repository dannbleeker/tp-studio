import { resetStoreForTest, useDocumentStore } from '@/store';
import { beforeEach, describe, expect, it } from 'vitest';

/**
 * FL-EX8 — multi-document workspace slice (v0, in-memory).
 *
 * The slice keeps the active tab's doc in `state.doc` (so every
 * existing reader keeps working) and archives inactive tabs in
 * `workspace.inactiveDocs`. Tab switches save the current doc into
 * the inactive slot and load the target's slot. Tests pin the
 * round-trip + the close-tab fallback behavior.
 */

beforeEach(() => {
  resetStoreForTest();
});

describe('workspaceSlice', () => {
  it('starts with a single tab pointing at the boot doc', () => {
    const { doc, workspace } = useDocumentStore.getState();
    expect(workspace.tabs).toHaveLength(1);
    expect(workspace.tabs[0]?.id).toBe(doc.id);
    expect(workspace.activeTabId).toBe(doc.id);
    expect(workspace.inactiveDocs).toEqual({});
  });

  it('openNewTab archives the current doc, makes the new one active', () => {
    const before = useDocumentStore.getState();
    const beforeId = before.doc.id;
    before.openNewTab('frt');
    const after = useDocumentStore.getState();
    expect(after.workspace.tabs).toHaveLength(2);
    expect(after.workspace.activeTabId).toBe(after.doc.id);
    // The first tab's id should still be the boot doc's id; the
    // active doc has a different id (fresh from createDocument).
    expect(after.workspace.tabs[0]?.id).toBe(beforeId);
    expect(after.workspace.tabs[1]?.id).toBe(after.doc.id);
    // The previous doc is archived under its tab id.
    expect(after.workspace.inactiveDocs[beforeId]?.id).toBe(beforeId);
    // The active tab is not in the inactive map.
    expect(after.workspace.inactiveDocs[after.doc.id]).toBeUndefined();
  });

  it('switchTab swaps active <-> inactive without losing either doc', () => {
    const state = useDocumentStore.getState();
    const firstTabId = state.doc.id;
    state.openNewTab('ec');
    const ecTabId = useDocumentStore.getState().doc.id;
    // Switch back to the first tab.
    useDocumentStore.getState().switchTab(firstTabId);
    const afterSwitch = useDocumentStore.getState();
    expect(afterSwitch.doc.id).toBe(firstTabId);
    expect(afterSwitch.workspace.activeTabId).toBe(firstTabId);
    // The EC tab's doc is now archived.
    expect(afterSwitch.workspace.inactiveDocs[ecTabId]?.id).toBe(ecTabId);
  });

  it('closeTab on an inactive tab drops it without disturbing the active one', () => {
    const state = useDocumentStore.getState();
    const firstTabId = state.doc.id;
    state.openNewTab('crt'); // now on a new CRT tab
    const newActiveId = useDocumentStore.getState().doc.id;
    // Close the inactive (first) tab. The active doc shouldn't change.
    useDocumentStore.getState().closeTab(firstTabId);
    const after = useDocumentStore.getState();
    expect(after.workspace.tabs).toHaveLength(1);
    expect(after.workspace.tabs[0]?.id).toBe(newActiveId);
    expect(after.doc.id).toBe(newActiveId);
    expect(after.workspace.inactiveDocs[firstTabId]).toBeUndefined();
  });

  it('closeTab on the active tab activates a sibling', () => {
    const state = useDocumentStore.getState();
    const firstTabId = state.doc.id;
    state.openNewTab('frt');
    const secondTabId = useDocumentStore.getState().doc.id;
    // Close the currently-active second tab.
    useDocumentStore.getState().closeTab(secondTabId);
    const after = useDocumentStore.getState();
    expect(after.workspace.tabs).toHaveLength(1);
    expect(after.workspace.activeTabId).toBe(firstTabId);
    expect(after.doc.id).toBe(firstTabId);
  });

  it('closeTab refuses to close the last remaining tab', () => {
    const state = useDocumentStore.getState();
    const onlyTabId = state.doc.id;
    state.closeTab(onlyTabId);
    const after = useDocumentStore.getState();
    expect(after.workspace.tabs).toHaveLength(1);
    expect(after.doc.id).toBe(onlyTabId);
  });

  it('setTitle on the active doc syncs the active tab title', () => {
    const state = useDocumentStore.getState();
    state.setTitle('My CRT');
    const after = useDocumentStore.getState();
    const activeTab = after.workspace.tabs.find((t) => t.id === after.workspace.activeTabId);
    expect(activeTab?.title).toBe('My CRT');
  });

  it('setDocument replaces the active tab and keeps the tab list intact', () => {
    const state = useDocumentStore.getState();
    const firstTabId = state.doc.id;
    state.openNewTab('ec'); // 2 tabs, active is EC
    const secondActiveId = useDocumentStore.getState().doc.id;
    // Now setDocument (e.g. import flow). The active tab should
    // retitle + reid; the other tab should be untouched.
    const incoming = { ...useDocumentStore.getState().doc, title: 'Imported' };
    useDocumentStore.getState().setDocument(incoming);
    const after = useDocumentStore.getState();
    expect(after.workspace.tabs).toHaveLength(2);
    // First tab is still the original boot doc.
    expect(after.workspace.tabs[0]?.id).toBe(firstTabId);
    // Second tab is the active one, retitled.
    expect(after.workspace.tabs[1]?.id).toBe(after.doc.id);
    expect(after.workspace.activeTabId).toBe(after.doc.id);
    expect(after.doc.id).toBe(secondActiveId); // setDocument keeps the doc id
  });

  it('per-tab undo stacks survive a switch', () => {
    const state = useDocumentStore.getState();
    const firstTabId = state.doc.id;
    // Push one history entry on the first tab by adding an entity.
    state.addEntity({ type: 'cause', title: 'A' });
    const firstTabPastLen = useDocumentStore.getState().past.length;
    expect(firstTabPastLen).toBeGreaterThan(0);
    // Open a new tab — first tab's past should be archived.
    state.openNewTab('crt');
    const after = useDocumentStore.getState();
    expect(after.past).toHaveLength(0); // fresh tab, fresh stack
    expect(after.workspace.inactiveHistory[firstTabId]?.past.length).toBe(firstTabPastLen);
    // Switch back — past restored.
    useDocumentStore.getState().switchTab(firstTabId);
    expect(useDocumentStore.getState().past.length).toBe(firstTabPastLen);
  });
});
