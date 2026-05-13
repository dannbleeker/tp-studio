import { DocumentInspector } from '@/components/settings/DocumentInspector';
import { resetStoreForTest, useDocumentStore } from '@/store';
import { act, cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

beforeEach(resetStoreForTest);
afterEach(cleanup);

const open = (): void => {
  act(() => useDocumentStore.getState().openDocSettings());
};

describe('DocumentInspector — title / author / description (regression)', () => {
  it('renders the existing meta fields when opened', () => {
    open();
    const { container } = render(<DocumentInspector />);
    // Title input has the doc's current title.
    const inputs = container.querySelectorAll('input[type="text"]');
    expect(inputs.length).toBeGreaterThanOrEqual(2);
  });

  it('typing into the title input writes through setTitle', () => {
    open();
    const { container } = render(<DocumentInspector />);
    const titleInput = container.querySelectorAll('input[type="text"]')[0] as HTMLInputElement;
    act(() => fireEvent.change(titleInput, { target: { value: 'New title' } }));
    expect(useDocumentStore.getState().doc.title).toBe('New title');
  });
});

describe('DocumentInspector — System Scope section', () => {
  it('renders all seven CRT-Step-1 prompts', () => {
    open();
    const { container } = render(<DocumentInspector />);
    // The summary line shows "0/7 answered" before any scope is filled.
    expect(container.textContent).toContain('0/7 answered');
    // The section is collapsed by default, but the textareas should mount
    // when expanded. Force open via the details element.
    const details = Array.from(container.querySelectorAll('details')).find((d) =>
      d.textContent?.includes('System Scope')
    ) as HTMLDetailsElement;
    expect(details).toBeTruthy();
    act(() => {
      details.open = true;
    });
    const textareas = details.querySelectorAll('textarea');
    expect(textareas.length).toBe(7);
  });

  it('typing into a scope field writes through setSystemScope', () => {
    open();
    const { container } = render(<DocumentInspector />);
    const details = Array.from(container.querySelectorAll('details')).find((d) =>
      d.textContent?.includes('System Scope')
    ) as HTMLDetailsElement;
    act(() => {
      details.open = true;
    });
    const firstTextarea = details.querySelector('textarea') as HTMLTextAreaElement;
    act(() => fireEvent.change(firstTextarea, { target: { value: 'Drive down wait time' } }));
    expect(useDocumentStore.getState().doc.systemScope?.goal).toBe('Drive down wait time');
  });

  it('auto-opens the scope section when at least one field is already filled', () => {
    act(() => useDocumentStore.getState().setSystemScope({ goal: 'Existing answer' }));
    open();
    const { container } = render(<DocumentInspector />);
    const details = Array.from(container.querySelectorAll('details')).find((d) =>
      d.textContent?.includes('System Scope')
    ) as HTMLDetailsElement;
    expect(details.open).toBe(true);
  });

  it('summary shows accurate count after filling fields', () => {
    act(() =>
      useDocumentStore.getState().setSystemScope({ goal: 'A', boundaries: 'B', inputsOutputs: 'C' })
    );
    open();
    const { container } = render(<DocumentInspector />);
    expect(container.textContent).toContain('3/7 answered');
  });
});

describe('DocumentInspector — Method Checklist section', () => {
  it('renders the CRT canonical 9 steps when the doc is CRT', () => {
    open();
    const { container } = render(<DocumentInspector />);
    const details = Array.from(container.querySelectorAll('details')).find((d) =>
      d.textContent?.includes('Method checklist')
    ) as HTMLDetailsElement;
    expect(details).toBeTruthy();
    expect(details.textContent).toContain('9 steps');
    act(() => {
      details.open = true;
    });
    const checkboxes = details.querySelectorAll('input[type="checkbox"]');
    expect(checkboxes.length).toBe(9);
  });

  it('clicking a checkbox writes through setMethodStep', () => {
    open();
    const { container } = render(<DocumentInspector />);
    const details = Array.from(container.querySelectorAll('details')).find((d) =>
      d.textContent?.includes('Method checklist')
    ) as HTMLDetailsElement;
    act(() => {
      details.open = true;
    });
    const firstCheckbox = details.querySelector('input[type="checkbox"]') as HTMLInputElement;
    act(() => fireEvent.click(firstCheckbox));
    expect(useDocumentStore.getState().doc.methodChecklist?.['crt.scope']).toBe(true);
    act(() => fireEvent.click(firstCheckbox));
    expect(useDocumentStore.getState().doc.methodChecklist?.['crt.scope']).toBeUndefined();
  });

  it('swaps to TT-specific step list when the doc is TT', () => {
    act(() => useDocumentStore.getState().newDocument('tt'));
    open();
    const { container } = render(<DocumentInspector />);
    const details = Array.from(container.querySelectorAll('details')).find((d) =>
      d.textContent?.includes('Method checklist')
    ) as HTMLDetailsElement;
    expect(details).toBeTruthy();
    expect(details.textContent).toContain('6 steps');
    expect(details.textContent).toContain('Transition Tree');
  });

  it('shows accurate completed count in the summary', () => {
    const s = useDocumentStore.getState();
    act(() => s.setMethodStep('crt.scope', true));
    act(() => s.setMethodStep('crt.udes', true));
    open();
    const { container } = render(<DocumentInspector />);
    const details = Array.from(container.querySelectorAll('details')).find((d) =>
      d.textContent?.includes('Method checklist')
    ) as HTMLDetailsElement;
    expect(details.textContent).toContain('2/9 steps');
  });

  it('Browse Lock disables checkbox + scope textareas', () => {
    act(() => useDocumentStore.getState().setBrowseLocked(true));
    open();
    const { container } = render(<DocumentInspector />);
    const scopeDetails = Array.from(container.querySelectorAll('details')).find((d) =>
      d.textContent?.includes('System Scope')
    ) as HTMLDetailsElement;
    const methodDetails = Array.from(container.querySelectorAll('details')).find((d) =>
      d.textContent?.includes('Method checklist')
    ) as HTMLDetailsElement;
    act(() => {
      scopeDetails.open = true;
      methodDetails.open = true;
    });
    const textareas = scopeDetails.querySelectorAll('textarea');
    const checkboxes = methodDetails.querySelectorAll('input[type="checkbox"]');
    expect(textareas.length).toBeGreaterThan(0);
    expect(checkboxes.length).toBeGreaterThan(0);
    for (const t of Array.from(textareas)) expect((t as HTMLTextAreaElement).disabled).toBe(true);
    for (const c of Array.from(checkboxes)) expect((c as HTMLInputElement).disabled).toBe(true);
  });
});
