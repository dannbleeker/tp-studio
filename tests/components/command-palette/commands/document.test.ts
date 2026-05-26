import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { documentCommands } from '@/components/command-palette/commands/document';
import { resetStoreForTest, useDocumentStore } from '@/store';
import { findCommand, runCommand } from './helpers';

beforeEach(resetStoreForTest);
afterEach(resetStoreForTest);

const s = () => useDocumentStore.getState();

describe('documentCommands', () => {
  it('new-diagram opens the diagram picker in "new" mode', async () => {
    await runCommand(findCommand(documentCommands, 'new-diagram'));
    expect(s().diagramPickerOpen).toBe('new');
  });

  it('load-example opens the diagram picker in "example" mode', async () => {
    await runCommand(findCommand(documentCommands, 'load-example'));
    expect(s().diagramPickerOpen).toBe('example');
  });

  it('open-pattern-library opens the pattern library', async () => {
    await runCommand(findCommand(documentCommands, 'open-pattern-library'));
    expect(s().patternLibraryOpen).not.toBeNull();
  });

  it('import opens the import picker', async () => {
    await runCommand(findCommand(documentCommands, 'import'));
    expect(s().importPickerOpen).toBe(true);
  });

  it('open-quick-capture opens the quick-capture dialog', async () => {
    await runCommand(findCommand(documentCommands, 'open-quick-capture'));
    expect(s().quickCaptureOpen).toBe(true);
  });

  it('new-from-template opens the template picker', async () => {
    await runCommand(findCommand(documentCommands, 'new-from-template'));
    expect(s().templatePickerOpen).toBe(true);
  });

  it('open-document-inspector opens the doc-settings dialog', async () => {
    await runCommand(findCommand(documentCommands, 'open-document-inspector'));
    expect(s().docSettingsOpen).toBe(true);
  });

  it('capture-snapshot stores a snapshot, toasts, and opens the history panel', async () => {
    const before = s().revisions.length;
    await runCommand(findCommand(documentCommands, 'capture-snapshot'));
    const after = s();
    expect(after.revisions.length).toBe(before + 1);
    expect(after.historyPanelOpen).toBe(true);
    expect(after.toasts.some((t) => t.kind === 'success' && /snapshot/i.test(t.message))).toBe(
      true
    );
  });

  it('reopen-creation-wizard opens the wizard on a Goal Tree doc', async () => {
    useDocumentStore.getState().newDocument('goalTree');
    await runCommand(findCommand(documentCommands, 'reopen-creation-wizard'));
    expect(s().creationWizard).not.toBeNull();
    expect(s().creationWizard?.kind).toBe('goalTree');
  });

  it('reopen-creation-wizard toasts info on a non-wizard diagram type', async () => {
    // Session 136 — CRT joined the wizard club, so the non-wizard
    // case uses FRT now (the wizard family is goalTree + ec + crt).
    useDocumentStore.getState().newDocument('frt');
    await runCommand(findCommand(documentCommands, 'reopen-creation-wizard'));
    expect(s().creationWizard).toBeNull();
    expect(s().toasts.some((t) => /only available/i.test(t.message))).toBe(true);
  });

  it('toggle-ec-reading-guide flips the EC chrome state on an EC doc', async () => {
    useDocumentStore.getState().newDocument('ec');
    const before = s().ecChromeCollapsed;
    await runCommand(findCommand(documentCommands, 'toggle-ec-reading-guide'));
    expect(s().ecChromeCollapsed).toBe(!before);
  });

  it('toggle-ec-reading-guide toasts info on a non-EC doc', async () => {
    useDocumentStore.getState().newDocument('crt');
    const before = s().ecChromeCollapsed;
    await runCommand(findCommand(documentCommands, 'toggle-ec-reading-guide'));
    expect(s().ecChromeCollapsed).toBe(before);
    expect(s().toasts.some((t) => /only available/i.test(t.message))).toBe(true);
  });
});
