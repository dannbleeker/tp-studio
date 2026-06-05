import { beforeEach, describe, expect, it } from 'vitest';
import { toolCommands } from '@/components/command-palette/commands/tools';
import { resetStoreForTest, useDocumentStore } from '@/store';
import { currentDoc } from '@/store/selectors';
import { seedEntity } from '../../helpers/seedDoc';

const run = (id: string) => {
  const cmd = toolCommands.find((c) => c.id === id);
  if (!cmd) throw new Error(`command ${id} not found`);
  cmd.run(useDocumentStore.getState());
};
const doc = () => currentDoc(useDocumentStore.getState());
const select = (ids: string[]) => useDocumentStore.getState().selectEntities(ids);

beforeEach(resetStoreForTest);

describe('tool commands — entity retyping', () => {
  it('mark-as-rootcause / mark-as-obstacle / promote-to-goal retype the selection', () => {
    const a = seedEntity('A');
    select([a.id]);
    run('mark-as-rootcause');
    expect(doc().entities[a.id]?.type).toBe('rootCause');
    run('mark-as-obstacle');
    expect(doc().entities[a.id]?.type).toBe('obstacle');
    run('promote-to-goal');
    expect(doc().entities[a.id]?.type).toBe('goal');
  });

  it('mark-as-io and mark-as-action retype the selection', () => {
    const a = seedEntity('A');
    select([a.id]);
    run('mark-as-io');
    expect(doc().entities[a.id]?.type).toBe('intermediateObjective');
    run('mark-as-action');
    expect(doc().entities[a.id]?.type).toBe('action');
  });

  it('is a no-op without a single-entity selection', () => {
    const before = Object.keys(doc().entities).length;
    run('mark-as-ude'); // nothing selected
    expect(Object.keys(doc().entities).length).toBe(before);
  });
});

describe('tool commands — structure', () => {
  it('add-successor adds a child entity + a connecting edge', () => {
    const a = seedEntity('A');
    select([a.id]);
    run('add-successor');
    expect(Object.keys(doc().entities).length).toBe(2);
    expect(Object.values(doc().edges).some((e) => e.sourceId === a.id)).toBe(true);
  });

  it('add-predecessor adds a parent entity + a connecting edge', () => {
    const a = seedEntity('A');
    select([a.id]);
    run('add-predecessor');
    expect(Object.values(doc().edges).some((e) => e.targetId === a.id)).toBe(true);
  });

  it('swap-entities runs on a two-entity selection', () => {
    const a = seedEntity('A');
    const b = seedEntity('B');
    select([a.id, b.id]);
    expect(() => run('swap-entities')).not.toThrow();
  });

  it('cycle-edge-polarity advances the weight (undefined -> positive)', () => {
    const a = seedEntity('A');
    const b = seedEntity('B');
    const edge = useDocumentStore.getState().connect(a.id, b.id);
    if (!edge) throw new Error('edge not created');
    useDocumentStore.getState().selectEdge(edge.id);
    run('cycle-edge-polarity');
    expect(doc().edges[edge.id]?.weight).toBe('positive');
  });
});

describe('tool commands — read-only + history', () => {
  it('run-validation, copy-selection, undo and redo run without error', () => {
    const a = seedEntity('A');
    select([a.id]);
    expect(() => {
      run('run-validation');
      run('copy-selection');
      run('undo');
      run('redo');
    }).not.toThrow();
  });
});
