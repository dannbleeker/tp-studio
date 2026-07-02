import { cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { TitleBadge } from '@/components/toolbar/TitleBadge';
import { __resetHandleStoreForTests, linkFile } from '@/services/storage/fileHandles';
import { resetStoreForTest, useDocumentStore } from '@/store';
import { currentDoc } from '@/store/selectors';
import { seedEntity } from '../helpers/seedDoc';

/**
 * Session 193 — the linked-file "unsaved since last save" chip. The dirty
 * derivation itself is unit-tested in `linkedFileStaleness.test`; this pins the
 * rendered chip (amber + "· unsaved" vs. emerald).
 */

const fakeHandle = (name: string): FileSystemFileHandle =>
  ({ name }) as unknown as FileSystemFileHandle;
const s = () => useDocumentStore.getState();
const docId = () => currentDoc(s()).id;
const updatedAt = () => currentDoc(s()).updatedAt;

beforeEach(() => {
  resetStoreForTest();
  __resetHandleStoreForTests();
  // An edit bumps the doc's updatedAt to "now" so the saved-at comparisons below
  // are unambiguous regardless of the reset's initial timestamp.
  seedEntity('x');
});
afterEach(cleanup);

describe('TitleBadge — linked-file dirty chip', () => {
  it('shows the amber "unsaved" chip when the doc changed since the last save', async () => {
    await linkFile(docId(), fakeHandle('budget.tps.json'), 1000); // saved long before "now"
    const { findByText, container } = render(<TitleBadge />);
    await findByText(/unsaved/);
    const chip = container.querySelector('[title*="Unsaved changes"]');
    expect(chip?.className).toMatch(/amber/);
  });

  it('shows the clean emerald chip (no "unsaved") when saved after the last edit', async () => {
    await linkFile(docId(), fakeHandle('budget.tps.json'), updatedAt() + 5000);
    const { findByText, queryByText, container } = render(<TitleBadge />);
    await findByText('budget.tps.json');
    expect(queryByText(/unsaved/)).toBeNull();
    const chip = container.querySelector('[title*="Linked to"]');
    expect(chip?.className).toMatch(/emerald/);
  });
});
