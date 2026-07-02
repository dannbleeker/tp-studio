import { act, cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { PromptDialogHost } from '@/components/PromptDialogHost';
import { resetStoreForTest, useDocumentStore } from '@/store';

beforeEach(resetStoreForTest);
afterEach(cleanup);

/**
 * `PromptDialogHost` bridges the store's `prompt(): Promise<string | null>`
 * action to the store-free `<PromptDialog>` shell — the in-app replacement for
 * `window.prompt`. Submit resolves the entered string; Cancel resolves `null`.
 */

const getInput = (c: HTMLElement) => c.querySelector('input') as HTMLInputElement;
const btn = (c: HTMLElement, text: string) =>
  Array.from(c.querySelectorAll('button')).find((b) => b.textContent === text);

describe('PromptDialogHost', () => {
  it('renders nothing when no prompt is pending', () => {
    const { container } = render(<PromptDialogHost />);
    expect(container.querySelector('input')).toBeNull();
  });

  it('shows the message + seeds the default value when a prompt opens', async () => {
    const { container } = render(<PromptDialogHost />);
    void useDocumentStore.getState().prompt('Branch name?', { defaultValue: 'experiment' });
    await new Promise((r) => setTimeout(r, 0));
    expect(container.textContent).toContain('Branch name?');
    expect(getInput(container).value).toBe('experiment');
  });

  it('submitting resolves the Promise with the entered value and closes', async () => {
    const { container } = render(<PromptDialogHost />);
    const promise = useDocumentStore.getState().prompt('Branch name?', { confirmLabel: 'Branch' });
    await new Promise((r) => setTimeout(r, 0));
    act(() => fireEvent.change(getInput(container), { target: { value: 'my-fork' } }));
    act(() => fireEvent.click(btn(container, 'Branch')!));
    expect(await promise).toBe('my-fork');
    expect(useDocumentStore.getState().promptDialog).toBeNull();
  });

  it('cancelling resolves the Promise with null', async () => {
    const { container } = render(<PromptDialogHost />);
    const promise = useDocumentStore.getState().prompt('Branch name?');
    await new Promise((r) => setTimeout(r, 0));
    act(() => fireEvent.click(btn(container, 'Cancel')!));
    expect(await promise).toBeNull();
  });

  it('opening a second prompt resolves the first as null', async () => {
    render(<PromptDialogHost />);
    const first = useDocumentStore.getState().prompt('First?');
    useDocumentStore.getState().prompt('Second?');
    expect(await first).toBeNull();
    act(() => useDocumentStore.getState().resolvePrompt('second-value'));
    // (second promise settles via resolvePrompt above)
  });
});
