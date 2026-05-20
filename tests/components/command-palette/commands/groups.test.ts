import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { groupCommands } from '@/components/command-palette/commands/groups';
import { resetStoreForTest, useDocumentStore } from '@/store';
import { seedEntity } from '../../../helpers/seedDoc';
import { findCommand, runCommand } from './helpers';

beforeEach(resetStoreForTest);
afterEach(resetStoreForTest);

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
});
