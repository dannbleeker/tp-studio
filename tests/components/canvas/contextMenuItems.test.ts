import { beforeEach, describe, expect, it } from 'vitest';
import { leadingVerbItems, toMenuItem } from '@/components/canvas/overlays/contextMenuItems';
import { hasVerbCommand } from '@/components/command-palette/verbCommandRuns';
import type { Branch, Verb } from '@/domain/selectionVerbs';
import { verbsForBranch } from '@/domain/selectionVerbs';
import { resetStoreForTest, useDocumentStore } from '@/store';
import { seedEntity } from '../../helpers/seedDoc';

// `contextMenuItems.ts` (the verb→MenuItem bridge extracted from ContextMenu)
// had no direct test: `toMenuItem`'s three dispatch branches + the conditional
// `destructive` spread, and `leadingVerbItems`' non-destructive filter, were
// only exercised implicitly by rendering the whole menu. These pin them.

beforeEach(resetStoreForTest);

describe('toMenuItem', () => {
  it('produces an action row carrying the verb label', () => {
    const item = toMenuItem({ id: 'x', label: 'Do the thing' });
    expect(item.kind).toBe('action');
    if (item.kind !== 'action') return;
    expect(item.label).toBe('Do the thing');
    expect(typeof item.run).toBe('function');
  });

  it('omits the `destructive` key entirely when the verb does not set it', () => {
    // exactOptionalPropertyTypes: passing `destructive: undefined` would be a
    // type error downstream, so the bridge must spread the key away, not pass
    // it through as undefined.
    const item = toMenuItem({ id: 'x', label: 'Safe' });
    expect('destructive' in item).toBe(false);
  });

  it('preserves destructive:true', () => {
    const item = toMenuItem({ id: 'x', label: 'Delete', destructive: true });
    expect(item.kind === 'action' && item.destructive).toBe(true);
  });

  it('preserves an explicit destructive:false (kept because it is !== undefined)', () => {
    const item = toMenuItem({ id: 'x', label: 'Safe', destructive: false });
    expect('destructive' in item).toBe(true);
    expect(item.kind === 'action' && item.destructive).toBe(false);
  });

  it('dispatches a verb with an inline run through that closure when invoked', () => {
    let called = 0;
    const verb: Verb = {
      id: 'inline-only',
      label: 'Inline',
      run: () => {
        called += 1;
      },
    };
    const item = toMenuItem(verb);
    expect(item.kind).toBe('action');
    if (item.kind !== 'action') return;
    item.run();
    expect(called).toBe(1);
  });

  it('falls back to a safe no-op when the verb has neither a palette command nor a run', () => {
    const item = toMenuItem({ id: 'inert', label: 'Nothing' });
    expect(item.kind).toBe('action');
    if (item.kind !== 'action') return;
    expect(() => item.run()).not.toThrow();
  });

  it('takes the palette-command path for a verb naming a registered command', () => {
    // `reverse-edge` is a verb-dispatchable command (edges module). The bridge
    // routes such verbs through `runVerbCommand` rather than their own `run`;
    // this asserts the contract the branch depends on and exercises that path.
    expect(hasVerbCommand('reverse-edge')).toBe(true);
    const item = toMenuItem({
      id: 'reverse-edge',
      label: 'Reverse direction',
      paletteCommandId: 'reverse-edge',
    });
    expect(item.kind).toBe('action');
    if (item.kind !== 'action') return;
    expect(typeof item.run).toBe('function');
  });
});

describe('leadingVerbItems', () => {
  it('keeps every non-destructive verb (as action rows) and drops the destructive ones', () => {
    const e = seedEntity('Node', 'effect');
    const branch: Branch = { kind: 'single-entity', id: e.id };
    const allVerbs = verbsForBranch(branch, useDocumentStore.getState());
    const nonDestructive = allVerbs.filter((v) => !v.destructive);

    // Guard: a single entity must offer both a destructive (Delete) verb and
    // some non-destructive ones, else the filter assertion proves nothing.
    expect(allVerbs.some((v) => v.destructive)).toBe(true);
    expect(nonDestructive.length).toBeGreaterThan(0);

    const items = leadingVerbItems(branch);
    expect(items).toHaveLength(nonDestructive.length);
    expect(items.every((i) => i.kind === 'action')).toBe(true);
    expect(items.some((i) => i.kind === 'action' && i.destructive === true)).toBe(false);
    expect(items.map((i) => (i.kind === 'action' ? i.label : ''))).toEqual(
      nonDestructive.map((v) => v.label)
    );
  });
});
