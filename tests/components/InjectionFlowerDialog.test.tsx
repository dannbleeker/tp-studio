import { act, cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { InjectionFlowerDialog } from '@/components/inspector/InjectionFlowerDialog';
import { importFromJSON } from '@/domain/persistence';
import type { DocumentId, EntityId, TPDocument } from '@/domain/types';
import { resetStoreForTest, useDocumentStore } from '@/store';

const s = () => useDocumentStore.getState();
const did = (id: string): DocumentId => id as unknown as DocumentId;
const eid = (id: string): EntityId => id as unknown as EntityId;

const buildDoc = (
  docId: string,
  diagramType: string,
  entityId: string,
  entityType: string,
  title: string
): TPDocument =>
  importFromJSON(
    JSON.stringify({
      schemaVersion: 9,
      id: docId,
      diagramType,
      title: `Doc ${docId}`,
      nextAnnotationNumber: 2,
      entities: {
        [entityId]: {
          id: entityId,
          type: entityType,
          title,
          annotationNumber: 1,
          createdAt: 1,
          updatedAt: 1,
        },
      },
      edges: {},
      groups: {},
      resolvedWarnings: {},
      createdAt: 1,
      updatedAt: 1,
    })
  );

beforeEach(resetStoreForTest);
afterEach(cleanup);

/**
 * Phase 3 #3 — the Injection Flower dialog. Groups one injection's cross-doc
 * links into Cohen's petals (Desired Effects / Negative Branch / Plan).
 */
describe('InjectionFlowerDialog', () => {
  it('renders nothing when no injection is being viewed', () => {
    const { container } = render(<InjectionFlowerDialog />);
    expect(container.firstChild).toBeNull();
  });

  it('prompts for each missing petal when the injection has no links', () => {
    const inj = s().addEntity({ type: 'injection', title: 'Run a bootcamp' });
    act(() => s().openInjectionFlower(inj.id));
    const { container } = render(<InjectionFlowerDialog />);
    expect(container.textContent).toContain('0 of 3 sides developed');
    expect(container.textContent).toContain('No desired effects linked yet');
    expect(container.textContent).toContain('No negative branch linked yet');
    expect(container.textContent).toContain('No plan linked yet');
  });

  it('groups a linked FRT entity under Desired effects', () => {
    // doc-a holds the injection; doc-frt is a separate tab with a desired effect.
    s().setDocument(buildDoc('doc-a', 'crt', 'inj', 'injection', 'Run a bootcamp'));
    s().openTab(buildDoc('doc-frt', 'frt', 'de1', 'desiredEffect', 'Faster onboarding'));
    s().switchTab(did('doc-a'));
    s().selectEntity(eid('inj'));
    act(() => s().linkSelectedEntityTo(did('doc-frt'), eid('de1')));
    act(() => s().openInjectionFlower(eid('inj')));
    const { container } = render(<InjectionFlowerDialog />);
    expect(container.textContent).toContain('1 of 3 sides developed');
    expect(container.textContent).toContain('Faster onboarding');
  });

  it('navigating a petal link switches tab, selects the target, and closes', () => {
    s().setDocument(buildDoc('doc-a', 'crt', 'inj', 'injection', 'Run a bootcamp'));
    s().openTab(buildDoc('doc-frt', 'frt', 'de1', 'desiredEffect', 'Faster onboarding'));
    s().switchTab(did('doc-a'));
    s().selectEntity(eid('inj'));
    act(() => s().linkSelectedEntityTo(did('doc-frt'), eid('de1')));
    act(() => s().openInjectionFlower(eid('inj')));
    const { container } = render(<InjectionFlowerDialog />);
    const link = Array.from(container.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Faster onboarding')
    ) as HTMLButtonElement;
    act(() => fireEvent.click(link));
    expect(s().doc.id).toBe(did('doc-frt'));
    expect(s().injectionFlowerEntityId).toBeNull();
  });

  it('shows a dismissible shell when the injection has vanished', () => {
    act(() => s().openInjectionFlower(eid('ghost')));
    const { container } = render(<InjectionFlowerDialog />);
    expect(container.textContent).toContain('no longer exists');
  });
});
