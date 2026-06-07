import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { documentCommands } from '@/components/command-palette/commands/document';
import { buildExampleCRT } from '@/domain/examples/crt';
import { createDocument } from '@/domain/factory';
import { resetStoreForTest, useDocumentStore } from '@/store';
import { seedEntity } from '../../../helpers/seedDoc';
import { findCommand, runCommand } from './helpers';

// ---------------------------------------------------------------------------
// Module-level mock for pickFile — must be declared at the top level so Vitest
// hoisting can replace it before any import of `document.ts` executes.
// ---------------------------------------------------------------------------
let pickFileResult: ReturnType<typeof buildExampleCRT> | null = null;
vi.mock('@/services/exporters/picker', async () => {
  const actual = await vi.importActual<typeof import('@/services/exporters/picker')>(
    '@/services/exporters/picker'
  );
  return {
    ...actual,
    pickFile: () => Promise.resolve(pickFileResult),
  };
});

beforeEach(resetStoreForTest);
afterEach(() => {
  resetStoreForTest();
  pickFileResult = null;
});

const s = () => useDocumentStore.getState();

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Stub `confirm` on the store, returning the given answer. */
const stubConfirm = (answer: boolean) => {
  const original = s().confirm;
  useDocumentStore.setState({ confirm: async () => answer });
  return () => useDocumentStore.setState({ confirm: original });
};

// ---------------------------------------------------------------------------
// Existing coverage — kept here so this file is the single source of truth
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// New coverage — branches not reached by the original 12 tests
// ---------------------------------------------------------------------------

describe('documentCommands — withWriteGuard (browse lock)', () => {
  it('blocks write-guarded commands when browseLocked is true', async () => {
    useDocumentStore.setState({ browseLocked: true });
    await runCommand(findCommand(documentCommands, 'new-diagram'));
    // picker must NOT open — the guard short-circuits before run()
    expect(s().diagramPickerOpen).toBeNull();
    // A toast is shown explaining why
    expect(s().toasts.some((t) => /browse lock/i.test(t.message))).toBe(true);
  });

  it('allows write-guarded commands when browseLocked is false', async () => {
    useDocumentStore.setState({ browseLocked: false });
    await runCommand(findCommand(documentCommands, 'open-quick-capture'));
    expect(s().quickCaptureOpen).toBe(true);
  });
});

describe('documentCommands — three-cloud-diagnosis', () => {
  it('opens the 3-cloud dialog', async () => {
    await runCommand(findCommand(documentCommands, 'three-cloud-diagnosis'));
    expect(s().threeCloudOpen).toBe(true);
  });
});

describe('documentCommands — toggle-comments-panel', () => {
  it('opens comments panel when it is currently closed', async () => {
    useDocumentStore.setState({ commentsPanelOpen: false });
    await runCommand(findCommand(documentCommands, 'toggle-comments-panel'));
    expect(s().commentsPanelOpen).toBe(true);
  });

  it('closes comments panel when it is currently open', async () => {
    useDocumentStore.setState({ commentsPanelOpen: true });
    await runCommand(findCommand(documentCommands, 'toggle-comments-panel'));
    expect(s().commentsPanelOpen).toBe(false);
  });
});

describe('documentCommands — add-comment-on-selection', () => {
  it('opens the comments panel', async () => {
    await runCommand(findCommand(documentCommands, 'add-comment-on-selection'));
    expect(s().commentsPanelOpen).toBe(true);
  });
});

describe('documentCommands — forget-closed-docs', () => {
  it('does nothing when the user cancels the confirm', async () => {
    const restore = stubConfirm(false);
    try {
      await runCommand(findCommand(documentCommands, 'forget-closed-docs'));
      // No toast should be shown when cancelled
      expect(s().toasts).toHaveLength(0);
    } finally {
      restore();
    }
  });

  it('shows success toast when docs were forgotten', async () => {
    // Plant a fake revision in localStorage for a doc that is not in tabOrder.
    // This is the lightest way to exercise the "docsForgotten > 0" branch
    // without relying on the persistence timing of openTab/closeTab.
    const orphanId = 'tp-studio-doc-orphan-test' as import('@/domain/types').DocumentId;
    const fakeRevisions = { [orphanId]: [{ id: 'rev1', docId: orphanId, capturedAt: 0 }] };
    localStorage.setItem('tp-studio:revisions:v1', JSON.stringify(fakeRevisions));

    const restore = stubConfirm(true);
    try {
      await runCommand(findCommand(documentCommands, 'forget-closed-docs'));
      expect(s().toasts.some((t) => t.kind === 'success' && /forgot/i.test(t.message))).toBe(true);
    } finally {
      restore();
      localStorage.removeItem('tp-studio:revisions:v1');
    }
  });

  it('shows info toast when no closed docs exist', async () => {
    // With a single open tab there are no closed docs to forget.
    const restore = stubConfirm(true);
    try {
      await runCommand(findCommand(documentCommands, 'forget-closed-docs'));
      expect(s().toasts.some((t) => t.kind === 'info' && /no closed/i.test(t.message))).toBe(true);
    } finally {
      restore();
    }
  });
});

describe('documentCommands — import-entity-from-doc', () => {
  it('does nothing when the user cancels the file picker (null returned)', async () => {
    pickFileResult = null; // simulate user cancel
    await runCommand(findCommand(documentCommands, 'import-entity-from-doc'));
    expect(s().importEntityPicker).toBeNull();
    expect(s().toasts).toHaveLength(0);
  });

  it('shows info toast when the picked file is the current document', async () => {
    // Make pickFile return a doc whose id matches the current active doc.
    const currentDocId = s().doc.id;
    const sameDoc = buildExampleCRT();
    // Override the id so it looks like the same doc.
    // We need a plain object cast since TPDocument.id is readonly.
    pickFileResult = { ...sameDoc, id: currentDocId } as ReturnType<typeof buildExampleCRT>;
    await runCommand(findCommand(documentCommands, 'import-entity-from-doc'));
    expect(s().importEntityPicker).toBeNull();
    expect(s().toasts.some((t) => t.kind === 'info' && /same document/i.test(t.message))).toBe(
      true
    );
  });

  it('opens the entity picker when a different doc is picked', async () => {
    const differentDoc = buildExampleCRT(); // gets a fresh unique id
    pickFileResult = differentDoc;
    await runCommand(findCommand(documentCommands, 'import-entity-from-doc'));
    expect(s().importEntityPicker).not.toBeNull();
    expect(s().importEntityPicker?.sourceDoc.id).toBe(differentDoc.id);
  });
});

describe('documentCommands — link-entity-cross-tab', () => {
  it('toasts info when no entity is selected', async () => {
    // selection defaults to { kind: 'none' }
    await runCommand(findCommand(documentCommands, 'link-entity-cross-tab'));
    expect(s().toasts.some((t) => /select a single entity/i.test(t.message))).toBe(true);
    expect(s().linkEntityPickerOpen).toBe(false);
  });

  it('toasts info when multiple entities are selected', async () => {
    const a = seedEntity('A');
    const b = seedEntity('B');
    useDocumentStore.getState().selectEntities([a.id, b.id]);
    await runCommand(findCommand(documentCommands, 'link-entity-cross-tab'));
    expect(s().toasts.some((t) => /select a single entity/i.test(t.message))).toBe(true);
    expect(s().linkEntityPickerOpen).toBe(false);
  });

  it('toasts info when only one tab is open', async () => {
    const e = seedEntity('Solo');
    useDocumentStore.getState().selectEntity(e.id);
    // Only one tab open by default
    expect(s().tabOrder.length).toBe(1);
    await runCommand(findCommand(documentCommands, 'link-entity-cross-tab'));
    expect(s().toasts.some((t) => /second tab/i.test(t.message))).toBe(true);
    expect(s().linkEntityPickerOpen).toBe(false);
  });

  it('opens the link-entity picker when exactly one entity is selected and a second tab exists', async () => {
    const e = seedEntity('Entity');
    useDocumentStore.getState().selectEntity(e.id);
    // Open a second tab using openTab so both tabs stay open
    const secondDoc = createDocument('frt');
    useDocumentStore.getState().openTab(secondDoc);
    // Switch back to first tab (entity lives there)
    const firstDocId = s().tabOrder[0]!;
    useDocumentStore.getState().switchTab(firstDocId);
    // switchTab resets selection; re-select the entity
    useDocumentStore.getState().selectEntity(e.id);
    // Confirm preconditions
    expect(s().tabOrder.length).toBe(2);
    expect(s().selection).toMatchObject({ kind: 'entities', ids: [e.id] });
    await runCommand(findCommand(documentCommands, 'link-entity-cross-tab'));
    expect(s().linkEntityPickerOpen).toBe(true);
  });
});

describe('documentCommands — mark-core-problem', () => {
  it('toasts info when no entity is selected', async () => {
    await runCommand(findCommand(documentCommands, 'mark-core-problem'));
    expect(s().toasts.some((t) => /select a single entity/i.test(t.message))).toBe(true);
  });

  it('toasts info when multiple entities are selected', async () => {
    const a = seedEntity('A');
    const b = seedEntity('B');
    useDocumentStore.getState().selectEntities([a.id, b.id]);
    await runCommand(findCommand(documentCommands, 'mark-core-problem'));
    expect(s().toasts.some((t) => /select a single entity/i.test(t.message))).toBe(true);
  });

  it('toggles the core-problem flag when a single entity is selected', async () => {
    const e = seedEntity('Core');
    useDocumentStore.getState().selectEntity(e.id);
    const before = s().doc.entities[e.id]?.coreProblem ?? false;
    await runCommand(findCommand(documentCommands, 'mark-core-problem'));
    expect(s().doc.entities[e.id]?.coreProblem).toBe(!before);
  });
});

describe('documentCommands — create-core-cloud', () => {
  it('calls createCoreCloudFromSelection without error (guarded by withWriteGuard)', async () => {
    // The action itself is tested in uShapeHelpers; here we just confirm
    // the command delegates to it and does not throw.
    await expect(
      runCommand(findCommand(documentCommands, 'create-core-cloud'))
    ).resolves.toBeUndefined();
  });
});

describe('documentCommands — carry-injection-to-frt', () => {
  it('calls carryInjectionToFRT without error', async () => {
    await expect(
      runCommand(findCommand(documentCommands, 'carry-injection-to-frt'))
    ).resolves.toBeUndefined();
  });
});

describe('documentCommands — reopen-creation-wizard (ec and crt branches)', () => {
  it('opens the wizard with kind "ec" on an EC diagram', async () => {
    useDocumentStore.getState().newDocument('ec');
    await runCommand(findCommand(documentCommands, 'reopen-creation-wizard'));
    expect(s().creationWizard).not.toBeNull();
    expect(s().creationWizard?.kind).toBe('ec');
  });

  it('opens the wizard with kind "crt" on a CRT diagram', async () => {
    useDocumentStore.getState().newDocument('crt');
    await runCommand(findCommand(documentCommands, 'reopen-creation-wizard'));
    expect(s().creationWizard).not.toBeNull();
    expect(s().creationWizard?.kind).toBe('crt');
  });
});

describe('documentCommands — toggle-ec-reading-guide (toast message variants)', () => {
  it('toasts "hidden" when collapsing the guide', async () => {
    useDocumentStore.getState().newDocument('ec');
    // Ensure guide is currently visible (not collapsed)
    useDocumentStore.setState({ ecChromeCollapsed: false });
    await runCommand(findCommand(documentCommands, 'toggle-ec-reading-guide'));
    expect(s().toasts.some((t) => /hidden/i.test(t.message))).toBe(true);
  });

  it('toasts "shown" when expanding the guide', async () => {
    useDocumentStore.getState().newDocument('ec');
    // Ensure guide is currently collapsed (hidden)
    useDocumentStore.setState({ ecChromeCollapsed: true });
    await runCommand(findCommand(documentCommands, 'toggle-ec-reading-guide'));
    expect(s().toasts.some((t) => /shown/i.test(t.message))).toBe(true);
  });
});
