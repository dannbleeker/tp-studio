import { act, cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { EdgeScrutinyDialog } from '@/components/inspector/EdgeScrutinyDialog';
import { CLR_SCRUTINY } from '@/domain/clrScrutiny';
import { resetStoreForTest, useDocumentStore } from '@/store';
import { seedConnectedPair } from '../helpers/seedDoc';

beforeEach(resetStoreForTest);
afterEach(cleanup);

const s = () => useDocumentStore.getState();
const TOTAL = CLR_SCRUTINY.length;

/**
 * Phase 3 #7 — the guided per-edge CLR-scrutiny dialog. It walks the eight
 * canonical reservation questions for one selected edge; ephemeral review
 * surface, no doc mutation.
 */
describe('EdgeScrutinyDialog', () => {
  it('renders nothing when no edge is being scrutinized', () => {
    const { container } = render(<EdgeScrutinyDialog />);
    expect(container.firstChild).toBeNull();
  });

  it('shows the first CLR question and the cause→effect titles', () => {
    const { edge } = seedConnectedPair('Cause A', 'Effect B');
    act(() => s().openEdgeScrutiny(edge.id));
    const { container } = render(<EdgeScrutinyDialog />);
    expect(container.textContent).toContain('Cause A');
    expect(container.textContent).toContain('Effect B');
    expect(container.textContent).toContain(CLR_SCRUTINY[0]?.label ?? '');
    expect(container.textContent).toContain(`Question 1 of ${TOTAL}`);
  });

  it('Next advances through the questions', () => {
    const { edge } = seedConnectedPair();
    act(() => s().openEdgeScrutiny(edge.id));
    const { container } = render(<EdgeScrutinyDialog />);
    const next = Array.from(container.querySelectorAll('button')).find(
      (b) => b.textContent?.trim() === 'Next'
    ) as HTMLButtonElement;
    act(() => fireEvent.click(next));
    expect(container.textContent).toContain(`Question 2 of ${TOTAL}`);
    expect(container.textContent).toContain(CLR_SCRUTINY[1]?.label ?? '');
  });

  it('the reviewed checkbox bumps the reviewed count', () => {
    const { edge } = seedConnectedPair();
    act(() => s().openEdgeScrutiny(edge.id));
    const { container } = render(<EdgeScrutinyDialog />);
    expect(container.textContent).toContain(`0 of ${TOTAL} reviewed`);
    const checkbox = container.querySelector('input[type="checkbox"]') as HTMLInputElement;
    act(() => fireEvent.click(checkbox));
    expect(container.textContent).toContain(`1 of ${TOTAL} reviewed`);
  });

  it('jumping to the last question shows Finish, which closes the dialog', () => {
    const { edge } = seedConnectedPair();
    act(() => s().openEdgeScrutiny(edge.id));
    const { container } = render(<EdgeScrutinyDialog />);
    const lastDot = Array.from(container.querySelectorAll('button')).find((b) =>
      b.getAttribute('aria-label')?.startsWith(`Question ${TOTAL}:`)
    ) as HTMLButtonElement;
    act(() => fireEvent.click(lastDot));
    const finish = Array.from(container.querySelectorAll('button')).find(
      (b) => b.textContent?.trim() === 'Finish'
    ) as HTMLButtonElement;
    expect(finish).toBeTruthy();
    act(() => fireEvent.click(finish));
    expect(s().edgeScrutinyId).toBeNull();
  });

  it('shows a dismissible shell when the edge has vanished', () => {
    const { edge } = seedConnectedPair();
    act(() => s().openEdgeScrutiny(edge.id));
    act(() => s().deleteEdge(edge.id));
    const { container } = render(<EdgeScrutinyDialog />);
    expect(container.textContent).toContain('no longer exists');
  });
});
