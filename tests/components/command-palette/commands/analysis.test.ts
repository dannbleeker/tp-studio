import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { analysisCommands } from '@/components/command-palette/commands/analysis';
import { resetStoreForTest, useDocumentStore } from '@/store';
import { seedChain, seedEntity } from '../../../helpers/seedDoc';
import { findCommand, runCommand } from './helpers';

beforeEach(resetStoreForTest);
afterEach(resetStoreForTest);

const s = () => useDocumentStore.getState();

describe('analysisCommands — find-core-drivers', () => {
  it('selects the core driver entity and toasts when one exists', async () => {
    // Set up a CRT with a rootCause feeding a UDE — that's the minimal
    // shape that produces a core-driver candidate.
    useDocumentStore.getState().newDocument('crt');
    const rc = seedEntity('Root', 'rootCause');
    const ude = seedEntity('UDE', 'ude');
    useDocumentStore.getState().connect(rc.id, ude.id);
    await runCommand(findCommand(analysisCommands, 'find-core-drivers'));
    const sel = s().selection;
    expect(sel.kind).toBe('entities');
    if (sel.kind !== 'entities') return;
    expect(sel.ids).toContain(rc.id);
    expect(s().toasts.some((t) => /core driver/i.test(t.message))).toBe(true);
  });

  it('toasts info when there are no candidates', async () => {
    useDocumentStore.getState().newDocument('crt');
    await runCommand(findCommand(analysisCommands, 'find-core-drivers'));
    expect(s().toasts.some((t) => /no core driver/i.test(t.message))).toBe(true);
  });
});

describe('analysisCommands — spawn-ec-from-selection', () => {
  it('replaces the doc with a fresh EC when exactly one entity is selected', async () => {
    const e = seedEntity('A conflict');
    useDocumentStore.getState().selectEntities([e.id]);
    await runCommand(findCommand(analysisCommands, 'spawn-ec-from-selection'));
    expect(s().doc.diagramType).toBe('ec');
  });

  it('toasts info when not exactly one entity is selected', async () => {
    await runCommand(findCommand(analysisCommands, 'spawn-ec-from-selection'));
    expect(s().toasts.some((t) => /exactly one entity/i.test(t.message))).toBe(true);
  });
});

describe('analysisCommands — start-read-through', () => {
  it('opens the read-through overlay when edges exist', async () => {
    seedChain(['A', 'B', 'C']);
    await runCommand(findCommand(analysisCommands, 'start-read-through'));
    expect(s().walkthrough.kind).toBe('read-through');
  });

  it('toasts info when there are no edges to walk', async () => {
    await runCommand(findCommand(analysisCommands, 'start-read-through'));
    expect(s().walkthrough.kind).toBe('closed');
    expect(s().toasts.some((t) => /no edges to walk/i.test(t.message))).toBe(true);
  });
});

describe('analysisCommands — read-all-at-once', () => {
  it('opens the all-at-once dialog when edges exist', async () => {
    seedChain(['A', 'B']);
    await runCommand(findCommand(analysisCommands, 'read-all-at-once'));
    expect(s().readAllAtOnceOpen).toBe(true);
  });

  it('toasts info when there are no edges', async () => {
    await runCommand(findCommand(analysisCommands, 'read-all-at-once'));
    expect(s().readAllAtOnceOpen).toBe(false);
    expect(s().toasts.some((t) => /no edges to read/i.test(t.message))).toBe(true);
  });
});

describe('analysisCommands — start-clr-walkthrough', () => {
  it('toasts success when there are no open concerns', async () => {
    await runCommand(findCommand(analysisCommands, 'start-clr-walkthrough'));
    // Fresh empty doc -> no warnings -> success toast.
    expect(s().toasts.some((t) => /no open CLR/i.test(t.message))).toBe(true);
  });
});
