import { act, cleanup, fireEvent, render, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GroupInspector } from '@/components/inspector/GroupInspector';
import { GROUP_COLORS_ORDER } from '@/domain/groupColors';
import { GROUP_PRESETS } from '@/domain/groupPresets';
import { resetStoreForTest, useDocumentStore } from '@/store';
import { seedEntity } from '../../helpers/seedDoc';

// guardWriteOrToast reads the store directly — mock so the browse-lock
// branch can be driven without triggering toast side-effects.
vi.mock('@/services/browseLock', () => ({
  guardWriteOrToast: vi.fn(() => true),
}));

import { guardWriteOrToast } from '@/services/browseLock';

const mockGuard = vi.mocked(guardWriteOrToast);

beforeEach(() => {
  resetStoreForTest();
  mockGuard.mockReturnValue(true);
});
afterEach(cleanup);

// ---------------------------------------------------------------------------
// Helper — seed a group with one member entity and return both ids.
// ---------------------------------------------------------------------------
function seedGroup(title = 'Test Group', color: 'amber' | 'indigo' | 'rose' | 'slate' = 'amber') {
  const entity = seedEntity('Member A');
  const group = useDocumentStore.getState().createGroupFromSelection([entity.id], { title, color });
  if (!group) throw new Error('createGroupFromSelection returned null');
  return { group, entity };
}

// ---------------------------------------------------------------------------
// Poll until the in-app ConfirmDialog opens, resolve with the given answer,
// and return the message text so callers can assert on it.
// ---------------------------------------------------------------------------
const settleNextConfirm = (answer: boolean): Promise<string> =>
  new Promise<string>((resolve, reject) => {
    const start = Date.now();
    const tick = () => {
      const cur = useDocumentStore.getState().confirmDialog;
      if (cur) {
        const msg = cur.message;
        useDocumentStore.getState().resolveConfirm(answer);
        resolve(msg);
        return;
      }
      if (Date.now() - start > 1000) {
        reject(new Error('Timeout waiting for ConfirmDialog'));
        return;
      }
      setTimeout(tick, 5);
    };
    tick();
  });

// ---------------------------------------------------------------------------
// Basic rendering
// ---------------------------------------------------------------------------

describe('GroupInspector — basic rendering', () => {
  it('pre-fills the title input from the group', () => {
    const { group } = seedGroup('My Group');
    const { container } = render(<GroupInspector groupId={group.id} />);
    const input = container.querySelector('input[type="text"]') as HTMLInputElement;
    expect(input).toBeTruthy();
    expect(input.value).toBe('My Group');
  });

  it('shows the member count — singular "item" for 1 member', () => {
    const { group } = seedGroup();
    const { container } = render(<GroupInspector groupId={group.id} />);
    expect(container.textContent).toContain('1 item in this group');
  });

  it('shows plural "items" for 2 or more members', () => {
    const { group } = seedGroup();
    const extra = seedEntity('Member B');
    act(() => useDocumentStore.getState().addToGroup(group.id, extra.id));
    const { container } = render(<GroupInspector groupId={group.id} />);
    expect(container.textContent).toContain('2 items in this group');
  });

  it('renders null when the group id does not exist', () => {
    const { container } = render(<GroupInspector groupId="nonexistent-id" />);
    expect(container.firstChild).toBeNull();
  });

  it('renders the Collapse button when group is expanded', () => {
    const { group } = seedGroup();
    const { container } = render(<GroupInspector groupId={group.id} />);
    const btn = Array.from(container.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Collapse')
    );
    expect(btn).toBeTruthy();
  });

  it('renders the Expand button when group is already collapsed', () => {
    const { group } = seedGroup();
    act(() => useDocumentStore.getState().toggleGroupCollapsed(group.id));
    const { container } = render(<GroupInspector groupId={group.id} />);
    const btn = Array.from(container.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Expand')
    );
    expect(btn).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// Rename
// ---------------------------------------------------------------------------

describe('GroupInspector — rename', () => {
  it('typing in the title input renames the group in the store', () => {
    const { group } = seedGroup('Old Name');
    const { container } = render(<GroupInspector groupId={group.id} />);
    const input = container.querySelector('input[type="text"]') as HTMLInputElement;
    act(() => fireEvent.change(input, { target: { value: 'New Name' } }));
    expect(useDocumentStore.getState().doc.groups[group.id]?.title).toBe('New Name');
  });
});

// ---------------------------------------------------------------------------
// Color swatches
// ---------------------------------------------------------------------------

describe('GroupInspector — color swatches', () => {
  it('each color swatch button has an aria-label matching the color name', () => {
    const { group } = seedGroup();
    const { container } = render(<GroupInspector groupId={group.id} />);
    for (const color of GROUP_COLORS_ORDER) {
      const btn = container.querySelector(`button[aria-label="${color}"]`);
      expect(btn, `swatch for ${color}`).toBeTruthy();
    }
  });

  it('clicking a color swatch updates the group color in the store', () => {
    const { group } = seedGroup('G', 'slate');
    const { container } = render(<GroupInspector groupId={group.id} />);
    const indigoBtn = container.querySelector('button[aria-label="indigo"]') as HTMLButtonElement;
    expect(indigoBtn).toBeTruthy();
    act(() => fireEvent.click(indigoBtn));
    expect(useDocumentStore.getState().doc.groups[group.id]?.color).toBe('indigo');
  });

  it('the currently selected color swatch has aria-pressed="true"', () => {
    const { group } = seedGroup('G', 'rose');
    const { container } = render(<GroupInspector groupId={group.id} />);
    const roseBtn = container.querySelector('button[aria-label="rose"]') as HTMLButtonElement;
    expect(roseBtn.getAttribute('aria-pressed')).toBe('true');
  });

  it('a non-selected color swatch has aria-pressed="false"', () => {
    const { group } = seedGroup('G', 'rose');
    const { container } = render(<GroupInspector groupId={group.id} />);
    const amberBtn = container.querySelector('button[aria-label="amber"]') as HTMLButtonElement;
    expect(amberBtn.getAttribute('aria-pressed')).toBe('false');
  });

  it('color swatch is disabled under Browse Lock', () => {
    const { group } = seedGroup();
    act(() => useDocumentStore.getState().setBrowseLocked(true));
    const { container } = render(<GroupInspector groupId={group.id} />);
    const amberBtn = container.querySelector('button[aria-label="amber"]') as HTMLButtonElement;
    expect(amberBtn.disabled).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Presets
// ---------------------------------------------------------------------------

describe('GroupInspector — presets', () => {
  it('renders a button for each preset', () => {
    const { group } = seedGroup();
    const { container } = render(<GroupInspector groupId={group.id} />);
    for (const preset of GROUP_PRESETS) {
      const btn = Array.from(container.querySelectorAll('button')).find((b) =>
        b.textContent?.includes(preset.title)
      );
      expect(btn, `preset button for ${preset.title}`).toBeTruthy();
    }
  });

  it('clicking a preset writes both title and color to the store', () => {
    const { group } = seedGroup('Original', 'slate');
    const preset = GROUP_PRESETS[0]!; // 'Negative Branch', rose
    const { container } = render(<GroupInspector groupId={group.id} />);
    const btn = Array.from(container.querySelectorAll('button')).find((b) =>
      b.textContent?.includes(preset.title)
    ) as HTMLButtonElement;
    expect(btn).toBeTruthy();
    act(() => fireEvent.click(btn));
    const updated = useDocumentStore.getState().doc.groups[group.id];
    expect(updated?.title).toBe(preset.title);
    expect(updated?.color).toBe(preset.color);
  });

  it('preset buttons are disabled under Browse Lock', () => {
    const { group } = seedGroup();
    act(() => useDocumentStore.getState().setBrowseLocked(true));
    const { container } = render(<GroupInspector groupId={group.id} />);
    const preset = GROUP_PRESETS[0]!;
    const btn = Array.from(container.querySelectorAll('button')).find((b) =>
      b.textContent?.includes(preset.title)
    ) as HTMLButtonElement;
    expect(btn).toBeTruthy();
    expect(btn.disabled).toBe(true);
  });

  it('clicking a preset is no-op when guardWriteOrToast returns false', () => {
    const { group } = seedGroup('Original', 'slate');
    mockGuard.mockReturnValue(false);
    const preset = GROUP_PRESETS[0]!;
    const { container } = render(<GroupInspector groupId={group.id} />);
    const btn = Array.from(container.querySelectorAll('button')).find((b) =>
      b.textContent?.includes(preset.title)
    ) as HTMLButtonElement;
    act(() => fireEvent.click(btn));
    // Title and color should remain unchanged
    const stored = useDocumentStore.getState().doc.groups[group.id];
    expect(stored?.title).toBe('Original');
    expect(stored?.color).toBe('slate');
  });
});

// ---------------------------------------------------------------------------
// Collapse toggle
// ---------------------------------------------------------------------------

describe('GroupInspector — collapse toggle', () => {
  it('clicking Collapse sets collapsed to true', () => {
    const { group } = seedGroup();
    const { container } = render(<GroupInspector groupId={group.id} />);
    const btn = Array.from(container.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Collapse')
    ) as HTMLButtonElement;
    act(() => fireEvent.click(btn));
    expect(useDocumentStore.getState().doc.groups[group.id]?.collapsed).toBe(true);
  });

  it('clicking Expand (when already collapsed) sets collapsed to false', () => {
    const { group } = seedGroup();
    act(() => useDocumentStore.getState().toggleGroupCollapsed(group.id)); // pre-collapse
    const { container } = render(<GroupInspector groupId={group.id} />);
    const btn = Array.from(container.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Expand')
    ) as HTMLButtonElement;
    act(() => fireEvent.click(btn));
    expect(useDocumentStore.getState().doc.groups[group.id]?.collapsed).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Archive toggle
// ---------------------------------------------------------------------------

describe('GroupInspector — archive toggle', () => {
  it('renders "Archive (preserve, hide)" button when not archived', () => {
    const { group } = seedGroup();
    const { container } = render(<GroupInspector groupId={group.id} />);
    // The button text includes the label "Archive (preserve, hide)" — find
    // by checking for the distinctive parenthetical, which only appears here.
    const btn = Array.from(container.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('preserve, hide')
    );
    expect(btn).toBeTruthy();
  });

  it('clicking Archive sets archived to true', () => {
    const { group } = seedGroup();
    const { container } = render(<GroupInspector groupId={group.id} />);
    const btn = Array.from(container.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('preserve, hide')
    ) as HTMLButtonElement;
    act(() => fireEvent.click(btn));
    expect(useDocumentStore.getState().doc.groups[group.id]?.archived).toBe(true);
  });

  it('archiving with showArchivedGroups=false auto-flips showArchivedGroups to true', () => {
    const { group } = seedGroup();
    // Ensure showArchivedGroups starts as false
    act(() => useDocumentStore.getState().setShowArchivedGroups(false));
    const { container } = render(<GroupInspector groupId={group.id} />);
    const btn = Array.from(container.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('preserve, hide')
    ) as HTMLButtonElement;
    act(() => fireEvent.click(btn));
    expect(useDocumentStore.getState().showArchivedGroups).toBe(true);
  });

  it('archiving when showArchivedGroups is already true does NOT toggle it back', () => {
    const { group } = seedGroup();
    act(() => useDocumentStore.getState().setShowArchivedGroups(true));
    const { container } = render(<GroupInspector groupId={group.id} />);
    const btn = Array.from(container.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('preserve, hide')
    ) as HTMLButtonElement;
    act(() => fireEvent.click(btn));
    expect(useDocumentStore.getState().showArchivedGroups).toBe(true);
  });

  it('renders "Unarchive" button when group is archived', () => {
    const { group } = seedGroup();
    act(() => useDocumentStore.getState().toggleGroupArchived(group.id));
    const { container } = render(<GroupInspector groupId={group.id} />);
    const btn = Array.from(container.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Unarchive')
    );
    expect(btn).toBeTruthy();
  });

  it('clicking Unarchive clears archived flag', () => {
    const { group } = seedGroup();
    act(() => useDocumentStore.getState().toggleGroupArchived(group.id));
    const { container } = render(<GroupInspector groupId={group.id} />);
    const btn = Array.from(container.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Unarchive')
    ) as HTMLButtonElement;
    act(() => fireEvent.click(btn));
    expect(useDocumentStore.getState().doc.groups[group.id]?.archived).toBeUndefined();
  });

  it('shows "Show archived groups on canvas" checkbox when group is archived', () => {
    const { group } = seedGroup();
    act(() => useDocumentStore.getState().toggleGroupArchived(group.id));
    const { container } = render(<GroupInspector groupId={group.id} />);
    // Look for any label containing the "Show archived groups" text, not just the
    // first label (which belongs to the title Field).
    const labels = Array.from(container.querySelectorAll('label'));
    const archiveLabel = labels.find((l) => l.textContent?.includes('Show archived groups'));
    expect(archiveLabel).toBeTruthy();
  });

  it('does NOT show "Show archived groups on canvas" checkbox when group is not archived', () => {
    const { group } = seedGroup();
    const { container } = render(<GroupInspector groupId={group.id} />);
    const checkboxes = container.querySelectorAll('input[type="checkbox"]');
    expect(checkboxes.length).toBe(0);
  });

  it('the "Show archived groups" checkbox reflects showArchivedGroups state', () => {
    const { group } = seedGroup();
    act(() => useDocumentStore.getState().toggleGroupArchived(group.id));
    act(() => useDocumentStore.getState().setShowArchivedGroups(true));
    const { container } = render(<GroupInspector groupId={group.id} />);
    const checkbox = container.querySelector('input[type="checkbox"]') as HTMLInputElement;
    expect(checkbox.checked).toBe(true);
  });

  it('toggling the "Show archived groups" checkbox calls setShowArchivedGroups', () => {
    const { group } = seedGroup();
    act(() => useDocumentStore.getState().toggleGroupArchived(group.id));
    act(() => useDocumentStore.getState().setShowArchivedGroups(false));
    const { container } = render(<GroupInspector groupId={group.id} />);
    const checkbox = container.querySelector('input[type="checkbox"]') as HTMLInputElement;
    // fireEvent.click toggles a checkbox and fires the onChange handler with
    // the updated checked value in RTL — more reliable than fireEvent.change
    // when the handler reads e.target.checked.
    act(() => fireEvent.click(checkbox));
    expect(useDocumentStore.getState().showArchivedGroups).toBe(true);
  });

  it('archive button is disabled under Browse Lock', () => {
    const { group } = seedGroup();
    act(() => useDocumentStore.getState().setBrowseLocked(true));
    const { container } = render(<GroupInspector groupId={group.id} />);
    const btn = Array.from(container.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('preserve, hide')
    ) as HTMLButtonElement;
    expect(btn).toBeTruthy();
    expect(btn.disabled).toBe(true);
  });

  it('archive is no-op when guardWriteOrToast returns false', () => {
    const { group } = seedGroup();
    mockGuard.mockReturnValue(false);
    const { container } = render(<GroupInspector groupId={group.id} />);
    const btn = Array.from(container.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('preserve, hide')
    ) as HTMLButtonElement;
    act(() => fireEvent.click(btn));
    expect(useDocumentStore.getState().doc.groups[group.id]?.archived).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Hoist into group
// ---------------------------------------------------------------------------

describe('GroupInspector — hoist into group', () => {
  it('renders the "Hoist into group" button', () => {
    const { group } = seedGroup();
    const { container } = render(<GroupInspector groupId={group.id} />);
    const btn = Array.from(container.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Hoist into group')
    );
    expect(btn).toBeTruthy();
  });

  it('clicking "Hoist into group" sets hoistedGroupId in the store', () => {
    const { group } = seedGroup();
    const { container } = render(<GroupInspector groupId={group.id} />);
    const btn = Array.from(container.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Hoist into group')
    ) as HTMLButtonElement;
    act(() => fireEvent.click(btn));
    expect(useDocumentStore.getState().hoistedGroupId).toBe(group.id);
  });
});

// ---------------------------------------------------------------------------
// Nest into parent group dropdown
// ---------------------------------------------------------------------------

describe('GroupInspector — nest into parent group', () => {
  it('does NOT show the nest dropdown when there are no other groups', () => {
    const { group } = seedGroup();
    const { container } = render(<GroupInspector groupId={group.id} />);
    const select = container.querySelector(
      'select[aria-label="Nest this group inside another group"]'
    );
    expect(select).toBeNull();
  });

  it('shows the nest dropdown when a sibling group exists', () => {
    const { group } = seedGroup('Child');
    // Create a second group (potential parent)
    const parent = useDocumentStore
      .getState()
      .createGroupFromSelection([seedEntity('P-member').id], { title: 'Parent' });
    expect(parent).toBeTruthy();
    const { container } = render(<GroupInspector groupId={group.id} />);
    const select = container.querySelector(
      'select[aria-label="Nest this group inside another group"]'
    );
    expect(select).toBeTruthy();
  });

  it('the nest dropdown lists the sibling group by name', () => {
    const { group } = seedGroup('Child');
    const parent = useDocumentStore
      .getState()
      .createGroupFromSelection([seedEntity('P-member').id], { title: 'Parent Group' });
    expect(parent).toBeTruthy();
    const { container } = render(<GroupInspector groupId={group.id} />);
    const option = container.querySelector(
      `select[aria-label="Nest this group inside another group"] option[value="${parent!.id}"]`
    );
    expect(option?.textContent).toBe('Parent Group');
  });

  it('selecting a parent group via the dropdown calls addToGroup', () => {
    const { group: child } = seedGroup('Child');
    const parent = useDocumentStore
      .getState()
      .createGroupFromSelection([seedEntity('P-member').id], { title: 'Parent' });
    expect(parent).toBeTruthy();
    const { container } = render(<GroupInspector groupId={child.id} />);
    const select = container.querySelector(
      'select[aria-label="Nest this group inside another group"]'
    ) as HTMLSelectElement;
    act(() => fireEvent.change(select, { target: { value: parent!.id } }));
    const parentGroup = useDocumentStore.getState().doc.groups[parent!.id];
    expect(parentGroup?.memberIds).toContain(child.id);
  });

  it('choosing empty option in dropdown is a no-op', () => {
    const { group: child } = seedGroup('Child');
    useDocumentStore
      .getState()
      .createGroupFromSelection([seedEntity('P-member').id], { title: 'Parent' });
    const { container } = render(<GroupInspector groupId={child.id} />);
    const select = container.querySelector(
      'select[aria-label="Nest this group inside another group"]'
    ) as HTMLSelectElement;
    // Fire with empty value (the placeholder option)
    act(() => fireEvent.change(select, { target: { value: '' } }));
    // Child should not appear in any group's memberIds except its own initial group
    const allGroups = Object.values(useDocumentStore.getState().doc.groups);
    const nests = allGroups.filter((g) => g.id !== child.id && g.memberIds.includes(child.id));
    expect(nests).toHaveLength(0);
  });

  it('the nest dropdown is disabled under Browse Lock', () => {
    const { group: child } = seedGroup('Child');
    useDocumentStore
      .getState()
      .createGroupFromSelection([seedEntity('P-member').id], { title: 'Parent' });
    act(() => useDocumentStore.getState().setBrowseLocked(true));
    const { container } = render(<GroupInspector groupId={child.id} />);
    const select = container.querySelector(
      'select[aria-label="Nest this group inside another group"]'
    ) as HTMLSelectElement;
    expect(select).toBeTruthy();
    expect(select.disabled).toBe(true);
  });

  it('does NOT show the parent group as a nest candidate for itself', () => {
    const { group } = seedGroup('G');
    const { container } = render(<GroupInspector groupId={group.id} />);
    // There should be no option with value=group.id in the dropdown
    // (the dropdown itself may not even render if there are no other groups)
    const option = container.querySelector(`select option[value="${group.id}"]`);
    expect(option).toBeNull();
  });

  it('does not list a child group that would create a cycle', () => {
    // child1 nested inside parent; parent should not appear as candidate for child1
    const child1Member = seedEntity('C1-member');
    const child1 = useDocumentStore
      .getState()
      .createGroupFromSelection([child1Member.id], { title: 'Child1' });
    expect(child1).toBeTruthy();
    const parent = useDocumentStore
      .getState()
      .createGroupFromSelection([child1!.id], { title: 'Parent' });
    expect(parent).toBeTruthy();

    // Now render GroupInspector for parent — child1 would create a cycle
    const { container } = render(<GroupInspector groupId={parent!.id} />);
    const option = container.querySelector(`select option[value="${child1!.id}"]`);
    expect(option).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Delete group
// ---------------------------------------------------------------------------

describe('GroupInspector — delete group', () => {
  it('renders the "Delete group" button', () => {
    const { group } = seedGroup();
    const { container } = render(<GroupInspector groupId={group.id} />);
    const btn = Array.from(container.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Delete group')
    );
    expect(btn).toBeTruthy();
  });

  it('Delete group button is disabled under Browse Lock', () => {
    const { group } = seedGroup();
    act(() => useDocumentStore.getState().setBrowseLocked(true));
    const { container } = render(<GroupInspector groupId={group.id} />);
    const btn = Array.from(container.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Delete group')
    ) as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
  });

  it('clicking Delete group opens the confirm dialog with the group title', async () => {
    const { group } = seedGroup('My Group');
    const { container } = render(<GroupInspector groupId={group.id} />);
    const btn = Array.from(container.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Delete group')
    ) as HTMLButtonElement;
    const confirmPromise = settleNextConfirm(true);
    act(() => fireEvent.click(btn));
    const msg = await confirmPromise;
    expect(msg).toContain('My Group');
  });

  it('confirming Delete group removes the group from the store', async () => {
    const { group } = seedGroup('To Delete');
    const { container } = render(<GroupInspector groupId={group.id} />);
    const btn = Array.from(container.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Delete group')
    ) as HTMLButtonElement;
    const confirmPromise = settleNextConfirm(true);
    act(() => fireEvent.click(btn));
    await confirmPromise;
    await waitFor(() => {
      expect(useDocumentStore.getState().doc.groups[group.id]).toBeUndefined();
    });
  });

  it('cancelling Delete group leaves the group intact', async () => {
    const { group } = seedGroup('Keep Me');
    const { container } = render(<GroupInspector groupId={group.id} />);
    const btn = Array.from(container.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Delete group')
    ) as HTMLButtonElement;
    const confirmPromise = settleNextConfirm(false);
    act(() => fireEvent.click(btn));
    await confirmPromise;
    await waitFor(() => {
      expect(useDocumentStore.getState().doc.groups[group.id]).toBeDefined();
    });
  });

  it('delete is no-op when guardWriteOrToast returns false', () => {
    const { group } = seedGroup();
    mockGuard.mockReturnValue(false);
    const { container } = render(<GroupInspector groupId={group.id} />);
    const btn = Array.from(container.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Delete group')
    ) as HTMLButtonElement;
    act(() => fireEvent.click(btn));
    // confirm dialog should never have opened
    expect(useDocumentStore.getState().confirmDialog).toBeNull();
    expect(useDocumentStore.getState().doc.groups[group.id]).toBeDefined();
  });
});
