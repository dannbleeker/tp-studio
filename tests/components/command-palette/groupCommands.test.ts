import { beforeEach, describe, expect, it } from 'vitest';
import { groupCommands } from '@/components/command-palette/commands/groups';
import { resetStoreForTest, useDocumentStore } from '@/store';
import { currentDoc } from '@/store/selectors';
import { seedEntity } from '../../helpers/seedDoc';

const run = (id: string) => {
  const cmd = groupCommands.find((c) => c.id === id);
  if (!cmd) throw new Error(`command ${id} not found`);
  cmd.run(useDocumentStore.getState());
};
const st = () => useDocumentStore.getState();
const doc = () => currentDoc(st());
// Group commands check an `entities`-kind selection whose id resolves to a group
// (group nodes are selected like entities on the canvas).
const select = (ids: string[]) => st().selectEntities(ids);
const makeGroup = () => {
  const a = seedEntity('A');
  const b = seedEntity('B');
  const g = st().createGroupFromSelection([a.id, b.id]);
  if (!g) throw new Error('group not created');
  return g;
};

beforeEach(resetStoreForTest);

describe('group commands', () => {
  it('group-selected-entities creates a group from the selection', () => {
    const a = seedEntity('A');
    const b = seedEntity('B');
    select([a.id, b.id]);
    run('group-selected-entities');
    expect(Object.keys(doc().groups).length).toBe(1);
  });

  it('ungroup-selected deletes the selected group, keeping members', () => {
    const g = makeGroup();
    select([g.id]);
    run('ungroup-selected');
    expect(doc().groups[g.id]).toBeUndefined();
    expect(Object.keys(doc().entities).length).toBe(2);
  });

  it('toggle-group-collapsed flips the collapsed flag', () => {
    const g = makeGroup();
    const before = doc().groups[g.id]?.collapsed;
    select([g.id]);
    run('toggle-group-collapsed');
    expect(doc().groups[g.id]?.collapsed).toBe(!before);
  });

  it('hoist-into-group then unhoist toggle the hoisted group', () => {
    const g = makeGroup();
    select([g.id]);
    run('hoist-into-group');
    expect(st().hoistedGroupId).toBe(g.id);
    run('unhoist');
    expect(st().hoistedGroupId).toBeNull();
  });

  it('toggle-group-archived flips archived + reveals archived groups', () => {
    const g = makeGroup();
    select([g.id]);
    run('toggle-group-archived');
    expect(doc().groups[g.id]?.archived).toBe(true);
    expect(st().showArchivedGroups).toBe(true);
  });

  it('toggle-show-archived-groups flips the view flag', () => {
    const before = st().showArchivedGroups;
    run('toggle-show-archived-groups');
    expect(st().showArchivedGroups).toBe(!before);
  });

  it('archive-selected moves the selection into an Archive group', () => {
    const a = seedEntity('A');
    select([a.id]);
    run('archive-selected');
    const archive = Object.values(doc().groups).find((gr) =>
      gr.title.toLowerCase().includes('archive')
    );
    expect(archive).toBeDefined();
  });

  it('start-negative-branch creates a Negative Branch group', () => {
    const a = seedEntity('A');
    select([a.id]);
    run('start-negative-branch');
    const nbr = Object.values(doc().groups).find((gr) => gr.title.includes('Negative'));
    expect(nbr).toBeDefined();
  });

  it('no-ops without a valid group/entity selection', () => {
    expect(() => run('ungroup-selected')).not.toThrow();
    run('unhoist');
    expect(st().hoistedGroupId).toBeNull();
  });
});
