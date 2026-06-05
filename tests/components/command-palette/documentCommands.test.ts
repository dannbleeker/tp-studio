import { beforeEach, describe, expect, it } from 'vitest';
import { documentCommands } from '@/components/command-palette/commands/document';
import { resetStoreForTest, useDocumentStore } from '@/store';
import { currentDoc } from '@/store/selectors';
import { seedEntity } from '../../helpers/seedDoc';

const run = (id: string) => {
  const cmd = documentCommands.find((c) => c.id === id);
  if (!cmd) throw new Error(`command ${id} not found`);
  cmd.run(useDocumentStore.getState());
};
const st = () => useDocumentStore.getState();

beforeEach(resetStoreForTest);

describe('document commands', () => {
  it('mark-core-problem toggles the coreProblem flag on the selected entity', () => {
    const a = seedEntity('A');
    st().selectEntities([a.id]);
    run('mark-core-problem');
    expect(currentDoc(st()).entities[a.id]?.coreProblem).toBe(true);
    run('mark-core-problem');
    expect(currentDoc(st()).entities[a.id]?.coreProblem).toBeUndefined();
  });

  it('mark-core-problem is a no-op without a single-entity selection', () => {
    const a = seedEntity('A');
    const b = seedEntity('B');
    st().selectEntities([a.id, b.id]);
    expect(() => run('mark-core-problem')).not.toThrow();
  });

  it('the sync dialog-opener / toggle commands run without error', () => {
    seedEntity('A');
    expect(() => {
      run('new-diagram');
      run('load-example');
      run('open-pattern-library');
      run('import');
      run('open-quick-capture');
      run('new-from-template');
      run('open-document-inspector');
      run('toggle-comments-panel');
      run('add-comment-on-selection');
      run('capture-snapshot');
      run('reopen-creation-wizard');
      run('toggle-ec-reading-guide');
      run('link-entity-cross-tab');
    }).not.toThrow();
  });
});
