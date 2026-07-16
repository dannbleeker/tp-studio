import { act, cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { DocumentInspector } from '@/components/settings/DocumentInspector';
import { resetStoreForTest, useDocumentStore } from '@/store';

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
    expect(details.textContent).toContain('7 steps');
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

describe('DocumentInspector — Cloud type (EC only)', () => {
  const cloudSelect = (root: ParentNode): HTMLSelectElement | null =>
    root.querySelector('select[aria-label="Cloud type"]');

  it('does not render the cloud-type select for a non-EC doc', () => {
    open(); // default doc is CRT
    const { container } = render(<DocumentInspector />);
    expect(cloudSelect(container)).toBeNull();
  });

  it('renders the select on an EC doc and writes the choice through setCloudType', () => {
    act(() => useDocumentStore.getState().newDocument('ec'));
    open();
    const { container } = render(<DocumentInspector />);
    const select = cloudSelect(container) as HTMLSelectElement;
    expect(select).toBeTruthy();
    expect(select.value).toBe(''); // untyped by default
    act(() => fireEvent.change(select, { target: { value: 'core' } }));
    expect(useDocumentStore.getState().doc.cloudType).toBe('core');
    // Selecting "untyped" again clears the field.
    act(() => fireEvent.change(select, { target: { value: '' } }));
    expect(useDocumentStore.getState().doc.cloudType).toBeUndefined();
  });
});

// Session 206 — Cohen's per-type "best arrow to break" hint was rendered ONLY by
// the creation wizard's completion panel, so it disappeared when the wizard
// closed. Breaking the cloud happens afterwards, while working the assumptions —
// exactly when the hint was unavailable. It now rides the Document Inspector,
// derived from `cloudType` (the same fix Session 197 applied to the guiding
// questions). These tests pin the gap, not just the render: the hint must be
// reachable with NO wizard mounted.
describe('DocumentInspector — per-type break hint (backlog D re-scope)', () => {
  const breakHint = (root: ParentNode): HTMLElement | null =>
    root.querySelector('[data-component="ec-break-hint"]');

  it('shows Cohen’s break hint for a typed cloud, with no wizard on screen', () => {
    act(() => useDocumentStore.getState().newDocument('ec'));
    act(() => useDocumentStore.getState().setCloudType('firefighting'));
    open();
    const { container } = render(<DocumentInspector />);
    const hint = breakHint(container);
    expect(hint).toBeTruthy();
    // The real per-type copy, not a placeholder — this is the whole point.
    expect(hint?.textContent).toContain('fold the emergency action into the procedure');
  });

  it('is absent on an untyped cloud (there is no per-type hint to give)', () => {
    act(() => useDocumentStore.getState().newDocument('ec'));
    open();
    const { container } = render(<DocumentInspector />);
    expect(breakHint(container)).toBeNull();
  });

  it('is absent on a non-EC diagram even if a stale cloudType lingers', () => {
    // `cloudType` is only meaningful on an EC; a doc that changed type shouldn't
    // leak an EC break hint into, say, a Transition Tree.
    act(() => useDocumentStore.getState().newDocument('ec'));
    act(() => useDocumentStore.getState().setCloudType('core'));
    act(() => useDocumentStore.getState().newDocument('tt'));
    open();
    const { container } = render(<DocumentInspector />);
    expect(breakHint(container)).toBeNull();
  });

  it('tracks the selected type — switching type switches the hint', () => {
    act(() => useDocumentStore.getState().newDocument('ec'));
    open();
    const { container } = render(<DocumentInspector />);
    const select = container.querySelector('select[aria-label="Cloud type"]') as HTMLSelectElement;

    act(() => fireEvent.change(select, { target: { value: 'dilemma' } }));
    expect(breakHint(container)?.textContent).toContain('C–D′ or D–D′');

    act(() => fireEvent.change(select, { target: { value: 'consolidated' } }));
    expect(breakHint(container)?.textContent).toContain('then each source cloud for specifics');

    // Back to untyped — the hint goes away rather than sticking at the last type.
    act(() => fireEvent.change(select, { target: { value: '' } }));
    expect(breakHint(container)).toBeNull();
  });
});

describe('DocumentInspector — Performance frame (Phase 3 #5)', () => {
  const perfDetails = (root: ParentNode): HTMLDetailsElement =>
    Array.from(root.querySelectorAll('details')).find((d) =>
      d.textContent?.includes('Performance frame')
    ) as HTMLDetailsElement;

  it('renders two anchor textareas with a 0/2 summary by default', () => {
    open(); // default doc is CRT — the frame is diagram-agnostic
    const { container } = render(<DocumentInspector />);
    const details = perfDetails(container);
    expect(details).toBeTruthy();
    expect(details.textContent).toContain('0/2 anchors');
    act(() => {
      details.open = true;
    });
    expect(details.querySelectorAll('textarea').length).toBe(2);
  });

  it('typing into the anchors writes through the setters', () => {
    open();
    const { container } = render(<DocumentInspector />);
    const details = perfDetails(container);
    act(() => {
      details.open = true;
    });
    const [low, high] = Array.from(details.querySelectorAll('textarea')) as HTMLTextAreaElement[];
    act(() => fireEvent.change(low!, { target: { value: 'At 60%' } }));
    act(() => fireEvent.change(high!, { target: { value: 'Reach 98%' } }));
    expect(useDocumentStore.getState().doc.performanceLow).toBe('At 60%');
    expect(useDocumentStore.getState().doc.performanceHigh).toBe('Reach 98%');
  });

  it('auto-opens and shows an accurate count when an anchor is already filled', () => {
    act(() => useDocumentStore.getState().setPerformanceLow('Existing'));
    open();
    const { container } = render(<DocumentInspector />);
    const details = perfDetails(container);
    expect(details.open).toBe(true);
    expect(details.textContent).toContain('1/2 anchors');
  });
});
