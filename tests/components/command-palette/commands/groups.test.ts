import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { groupCommands } from '@/components/command-palette/commands/groups';
import { resetStoreForTest, useDocumentStore } from '@/store';
import { seedEntity } from '../../../helpers/seedDoc';
import { findCommand, runCommand } from './helpers';

beforeEach(resetStoreForTest);
afterEach(resetStoreForTest);

/** Seed a group of two entities and return its id; also returns the member ids. */
const seedGroupWithMembers = (): { groupId: string; memberIds: [string, string] } => {
  const a = seedEntity('A');
  const b = seedEntity('B');
  const g = useDocumentStore.getState().createGroupFromSelection([a.id, b.id]);
  if (!g) throw new Error('createGroupFromSelection failed in seedGroupWithMembers');
  return { groupId: g.id, memberIds: [a.id, b.id] };
};

const s = () => useDocumentStore.getState();

const seedGroupOfTwo = (): { groupId: string } => {
  const a = seedEntity('A');
  const b = seedEntity('B');
  const g = useDocumentStore.getState().createGroupFromSelection([a.id, b.id]);
  if (!g) throw new Error('createGroupFromSelection failed');
  return { groupId: g.id };
};

describe('groupCommands — group-selected-entities', () => {
  it('creates a group from a multi-entity selection', async () => {
    const a = seedEntity('A');
    const b = seedEntity('B');
    useDocumentStore.getState().selectEntities([a.id, b.id]);
    const before = Object.keys(s().doc.groups).length;
    await runCommand(findCommand(groupCommands, 'group-selected-entities'));
    expect(Object.keys(s().doc.groups).length).toBe(before + 1);
  });

  it('toasts info when no entity is selected', async () => {
    await runCommand(findCommand(groupCommands, 'group-selected-entities'));
    expect(s().toasts.some((t) => /select one or more entities/i.test(t.message))).toBe(true);
  });
});

describe('groupCommands — ungroup-selected', () => {
  it('deletes a selected group (members preserved)', async () => {
    const { groupId } = seedGroupOfTwo();
    useDocumentStore.getState().selectEntities([groupId]);
    const beforeEntities = Object.keys(s().doc.entities).length;
    await runCommand(findCommand(groupCommands, 'ungroup-selected'));
    expect(s().doc.groups[groupId]).toBeUndefined();
    // Members survive — the count of entities doesn't change.
    expect(Object.keys(s().doc.entities).length).toBe(beforeEntities);
  });

  it("toasts info when selection isn't a group", async () => {
    const a = seedEntity('A');
    useDocumentStore.getState().selectEntities([a.id]);
    await runCommand(findCommand(groupCommands, 'ungroup-selected'));
    expect(s().toasts.some((t) => /not a group/i.test(t.message))).toBe(true);
  });
});

describe('groupCommands — toggle-group-collapsed', () => {
  it("flips the group's collapsed state", async () => {
    const { groupId } = seedGroupOfTwo();
    useDocumentStore.getState().selectEntities([groupId]);
    const before = s().doc.groups[groupId]?.collapsed ?? false;
    await runCommand(findCommand(groupCommands, 'toggle-group-collapsed'));
    expect(s().doc.groups[groupId]?.collapsed).toBe(!before);
  });
});

describe('groupCommands — hoist + unhoist', () => {
  it('hoist-into-group sets hoistedGroupId', async () => {
    const { groupId } = seedGroupOfTwo();
    useDocumentStore.getState().selectEntities([groupId]);
    await runCommand(findCommand(groupCommands, 'hoist-into-group'));
    expect(s().hoistedGroupId).toBe(groupId);
  });

  it('unhoist clears hoistedGroupId', async () => {
    const { groupId } = seedGroupOfTwo();
    useDocumentStore.getState().selectEntities([groupId]);
    useDocumentStore.getState().hoistGroup(groupId);
    expect(s().hoistedGroupId).toBe(groupId);
    await runCommand(findCommand(groupCommands, 'unhoist'));
    expect(s().hoistedGroupId).toBeNull();
  });

  it('unhoist toasts info when not currently hoisted', async () => {
    await runCommand(findCommand(groupCommands, 'unhoist'));
    expect(s().toasts.some((t) => /not currently hoisted/i.test(t.message))).toBe(true);
  });
});

describe('groupCommands — archive-selected', () => {
  it('creates an Archive group when none exists', async () => {
    const a = seedEntity('A');
    useDocumentStore.getState().selectEntities([a.id]);
    await runCommand(findCommand(groupCommands, 'archive-selected'));
    const groups = Object.values(s().doc.groups);
    const archive = groups.find((g) => /archive/i.test(g.title));
    expect(archive).toBeDefined();
    // Archive groups start collapsed (the command flips collapsed once).
    expect(archive?.collapsed).toBe(true);
  });

  it('toasts info when no entities are selected', async () => {
    await runCommand(findCommand(groupCommands, 'archive-selected'));
    expect(s().toasts.some((t) => /select one or more entities to archive/i.test(t.message))).toBe(
      true
    );
  });
});

describe('groupCommands — start-negative-branch', () => {
  it('creates a Negative Branch group rooted on the selected entity', async () => {
    const ude = seedEntity('A UDE', 'ude');
    useDocumentStore.getState().selectEntities([ude.id]);
    await runCommand(findCommand(groupCommands, 'start-negative-branch'));
    const groups = Object.values(s().doc.groups);
    expect(groups.some((g) => /negative branch/i.test(g.title))).toBe(true);
  });

  it('toasts info when no entity is selected', async () => {
    await runCommand(findCommand(groupCommands, 'start-negative-branch'));
    expect(s().toasts.some((t) => /exactly one entity/i.test(t.message))).toBe(true);
  });

  it('toasts info when more than one entity is selected', async () => {
    const a = seedEntity('A');
    const b = seedEntity('B');
    useDocumentStore.getState().selectEntities([a.id, b.id]);
    await runCommand(findCommand(groupCommands, 'start-negative-branch'));
    expect(s().toasts.some((t) => /exactly one entity/i.test(t.message))).toBe(true);
  });
});

// ── Additional branch coverage ──────────────────────────────────────────────

describe('groupCommands — group-selected-entities (extra branches)', () => {
  it('toasts info when selection kind is not entities', async () => {
    // The default selection kind after reset is 'none'.
    useDocumentStore.setState({ selection: { kind: 'none' } });
    await runCommand(findCommand(groupCommands, 'group-selected-entities'));
    expect(s().toasts.some((t) => /select one or more entities/i.test(t.message))).toBe(true);
  });

  it('toasts success with entity count and group title on success', async () => {
    const a = seedEntity('X');
    const b = seedEntity('Y');
    useDocumentStore.getState().selectEntities([a.id, b.id]);
    await runCommand(findCommand(groupCommands, 'group-selected-entities'));
    // Toast message includes the count "2"
    expect(s().toasts.some((t) => /grouped 2 into/i.test(t.message))).toBe(true);
  });

  it('is blocked by Browse Lock (withWriteGuard)', async () => {
    const a = seedEntity('A');
    const b = seedEntity('B');
    useDocumentStore.getState().selectEntities([a.id, b.id]);
    const groupsBefore = Object.keys(s().doc.groups).length;
    useDocumentStore.getState().setBrowseLocked(true);
    await runCommand(findCommand(groupCommands, 'group-selected-entities'));
    // No group should have been created — the guard short-circuited.
    expect(Object.keys(s().doc.groups).length).toBe(groupsBefore);
    // The browse-lock toast must have been shown.
    expect(s().toasts.some((t) => /browse lock/i.test(t.message))).toBe(true);
  });
});

describe('groupCommands — ungroup-selected (extra branches)', () => {
  it('toasts info when zero entities are selected', async () => {
    useDocumentStore.setState({ selection: { kind: 'none' } });
    await runCommand(findCommand(groupCommands, 'ungroup-selected'));
    expect(s().toasts.some((t) => /select a single group/i.test(t.message))).toBe(true);
  });

  it('toasts info when more than one entity is selected', async () => {
    const a = seedEntity('A');
    const b = seedEntity('B');
    useDocumentStore.getState().selectEntities([a.id, b.id]);
    await runCommand(findCommand(groupCommands, 'ungroup-selected'));
    expect(s().toasts.some((t) => /select a single group/i.test(t.message))).toBe(true);
  });
});

describe('groupCommands — toggle-group-collapsed (extra branches)', () => {
  it('toasts info when zero entities are selected', async () => {
    useDocumentStore.setState({ selection: { kind: 'none' } });
    await runCommand(findCommand(groupCommands, 'toggle-group-collapsed'));
    expect(s().toasts.some((t) => /select a single group to collapse/i.test(t.message))).toBe(true);
  });

  it('toasts info when more than one entity is selected', async () => {
    const a = seedEntity('A');
    const b = seedEntity('B');
    useDocumentStore.getState().selectEntities([a.id, b.id]);
    await runCommand(findCommand(groupCommands, 'toggle-group-collapsed'));
    expect(s().toasts.some((t) => /select a single group to collapse/i.test(t.message))).toBe(true);
  });

  it('toasts info when selected entity is not a group', async () => {
    const a = seedEntity('A');
    useDocumentStore.getState().selectEntities([a.id]);
    await runCommand(findCommand(groupCommands, 'toggle-group-collapsed'));
    expect(s().toasts.some((t) => /not a group/i.test(t.message))).toBe(true);
  });
});

describe('groupCommands — hoist-into-group (extra branches)', () => {
  it('toasts info when zero entities are selected', async () => {
    useDocumentStore.setState({ selection: { kind: 'none' } });
    await runCommand(findCommand(groupCommands, 'hoist-into-group'));
    expect(s().toasts.some((t) => /select a single group to hoist/i.test(t.message))).toBe(true);
  });

  it('toasts info when more than one entity is selected', async () => {
    const a = seedEntity('A');
    const b = seedEntity('B');
    useDocumentStore.getState().selectEntities([a.id, b.id]);
    await runCommand(findCommand(groupCommands, 'hoist-into-group'));
    expect(s().toasts.some((t) => /select a single group to hoist/i.test(t.message))).toBe(true);
  });

  it('toasts info when selected entity is not a group', async () => {
    const a = seedEntity('A');
    useDocumentStore.getState().selectEntities([a.id]);
    await runCommand(findCommand(groupCommands, 'hoist-into-group'));
    expect(s().toasts.some((t) => /not a group/i.test(t.message))).toBe(true);
  });

  it('does NOT require Browse Lock — hoist is a view-state change', async () => {
    const { groupId } = seedGroupWithMembers();
    useDocumentStore.getState().selectEntities([groupId]);
    useDocumentStore.getState().setBrowseLocked(true);
    await runCommand(findCommand(groupCommands, 'hoist-into-group'));
    // hoistGroup should still have run despite the lock.
    expect(s().hoistedGroupId).toBe(groupId);
  });
});

describe('groupCommands — archive-selected (extra branches)', () => {
  it('adds entities to an existing Archive group and collapses it', async () => {
    // Create an initial Archive group (already collapsed).
    const firstEntity = seedEntity('First');
    useDocumentStore.getState().selectEntities([firstEntity.id]);
    await runCommand(findCommand(groupCommands, 'archive-selected'));

    // Confirm the Archive group was created.
    const archiveGroup = Object.values(s().doc.groups).find((g) => /archive/i.test(g.title));
    expect(archiveGroup).toBeDefined();

    // Now archive a second entity — should reuse the existing group.
    const groupCountBefore = Object.keys(s().doc.groups).length;
    const secondEntity = seedEntity('Second');
    useDocumentStore.getState().selectEntities([secondEntity.id]);
    await runCommand(findCommand(groupCommands, 'archive-selected'));

    // Still the same number of groups — reused, not duplicated.
    expect(Object.keys(s().doc.groups).length).toBe(groupCountBefore);
    expect(s().toasts.some((t) => /added .* to existing archive group/i.test(t.message))).toBe(
      true
    );
  });

  it('collapses an existing Archive group that was manually expanded before archiving', async () => {
    // Create the Archive group first.
    const first = seedEntity('First');
    useDocumentStore.getState().selectEntities([first.id]);
    await runCommand(findCommand(groupCommands, 'archive-selected'));

    const archiveGroup = Object.values(s().doc.groups).find((g) => /archive/i.test(g.title))!;
    // Manually expand the group so it is NOT collapsed.
    if (archiveGroup.collapsed) {
      useDocumentStore.getState().toggleGroupCollapsed(archiveGroup.id);
    }
    expect(s().doc.groups[archiveGroup.id]?.collapsed).toBe(false);

    // Archive another entity — the command should collapse the group again.
    const second = seedEntity('Second');
    useDocumentStore.getState().selectEntities([second.id]);
    await runCommand(findCommand(groupCommands, 'archive-selected'));
    expect(s().doc.groups[archiveGroup.id]?.collapsed).toBe(true);
  });
});

describe('groupCommands — toggle-group-archived', () => {
  it('sets archived flag on a group', async () => {
    const { groupId } = seedGroupWithMembers();
    useDocumentStore.getState().selectEntities([groupId]);
    expect(s().doc.groups[groupId]?.archived).toBeFalsy();
    await runCommand(findCommand(groupCommands, 'toggle-group-archived'));
    expect(s().doc.groups[groupId]?.archived).toBe(true);
    expect(s().toasts.some((t) => /group archived/i.test(t.message))).toBe(true);
  });

  it('auto-reveals archived groups when archiving and showArchivedGroups is false', async () => {
    const { groupId } = seedGroupWithMembers();
    useDocumentStore.getState().selectEntities([groupId]);
    useDocumentStore.setState({ showArchivedGroups: false });
    await runCommand(findCommand(groupCommands, 'toggle-group-archived'));
    expect(s().showArchivedGroups).toBe(true);
  });

  it('does NOT change showArchivedGroups when un-archiving', async () => {
    const { groupId } = seedGroupWithMembers();
    // First archive the group.
    useDocumentStore.getState().toggleGroupArchived(groupId);
    // Set showArchivedGroups to true to verify it stays true on unarchive.
    useDocumentStore.setState({ showArchivedGroups: true });
    useDocumentStore.getState().selectEntities([groupId]);
    await runCommand(findCommand(groupCommands, 'toggle-group-archived'));
    // Group should now be unarchived.
    expect(s().doc.groups[groupId]?.archived).toBeFalsy();
    expect(s().toasts.some((t) => /group unarchived/i.test(t.message))).toBe(true);
    // showArchivedGroups should remain unchanged (still true).
    expect(s().showArchivedGroups).toBe(true);
  });

  it('toasts info when zero entities are selected', async () => {
    useDocumentStore.setState({ selection: { kind: 'none' } });
    await runCommand(findCommand(groupCommands, 'toggle-group-archived'));
    expect(s().toasts.some((t) => /select a single group to archive/i.test(t.message))).toBe(true);
  });

  it('toasts info when more than one entity is selected', async () => {
    const a = seedEntity('A');
    const b = seedEntity('B');
    useDocumentStore.getState().selectEntities([a.id, b.id]);
    await runCommand(findCommand(groupCommands, 'toggle-group-archived'));
    expect(s().toasts.some((t) => /select a single group to archive/i.test(t.message))).toBe(true);
  });

  it('toasts info when selected entity is not a group', async () => {
    const a = seedEntity('A');
    useDocumentStore.getState().selectEntities([a.id]);
    await runCommand(findCommand(groupCommands, 'toggle-group-archived'));
    expect(s().toasts.some((t) => /not a group/i.test(t.message))).toBe(true);
  });

  it('is blocked by Browse Lock (withWriteGuard)', async () => {
    const { groupId } = seedGroupWithMembers();
    useDocumentStore.getState().selectEntities([groupId]);
    useDocumentStore.getState().setBrowseLocked(true);
    await runCommand(findCommand(groupCommands, 'toggle-group-archived'));
    // Group should remain unarchived.
    expect(s().doc.groups[groupId]?.archived).toBeFalsy();
    expect(s().toasts.some((t) => /browse lock/i.test(t.message))).toBe(true);
  });
});

describe('groupCommands — toggle-show-archived-groups', () => {
  it('toggles showArchivedGroups from false to true', async () => {
    useDocumentStore.setState({ showArchivedGroups: false });
    await runCommand(findCommand(groupCommands, 'toggle-show-archived-groups'));
    expect(s().showArchivedGroups).toBe(true);
    expect(s().toasts.some((t) => /showing archived groups/i.test(t.message))).toBe(true);
  });

  it('toggles showArchivedGroups from true to false', async () => {
    useDocumentStore.setState({ showArchivedGroups: true });
    await runCommand(findCommand(groupCommands, 'toggle-show-archived-groups'));
    expect(s().showArchivedGroups).toBe(false);
    expect(s().toasts.some((t) => /hiding archived groups/i.test(t.message))).toBe(true);
  });

  it('is NOT blocked by Browse Lock — it is a view-state change', async () => {
    useDocumentStore.setState({ showArchivedGroups: false });
    useDocumentStore.getState().setBrowseLocked(true);
    await runCommand(findCommand(groupCommands, 'toggle-show-archived-groups'));
    // Toggle should have taken effect despite browse lock.
    expect(s().showArchivedGroups).toBe(true);
  });
});
