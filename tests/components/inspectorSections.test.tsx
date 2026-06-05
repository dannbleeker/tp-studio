import { cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ActionFields } from '@/components/inspector/ActionFields';
import { EntityLinksSection } from '@/components/inspector/EntityLinksSection';
import { StFacetsSection } from '@/components/inspector/StFacetsSection';
import type { ActionEligibility, Precondition } from '@/domain/actionEligibility';
import { ST_FACET_KEYS } from '@/domain/graph';
import type { DocumentId } from '@/domain/types';
import { makeDoc, makeEntity } from '../domain/helpers';

/**
 * Session 177 — direct render tests for the three lowest-coverage
 * EntityInspector sections. Each was extracted verbatim from
 * EntityInspector and is prop-driven with plain callbacks, so they test in
 * isolation without the store: the S&T 5-facet inputs (was 0%), the
 * cross-document Links chips, and the Transition-Tree Action fields +
 * eligibility callout.
 */

afterEach(cleanup);

describe('StFacetsSection', () => {
  const facetEntity = (value?: string) =>
    value === undefined
      ? {}
      : { attributes: { [ST_FACET_KEYS.strategy]: { kind: 'string', value } } };

  it('renders the four S&T facet fields and reads an existing value', () => {
    const { getByLabelText } = render(
      <StFacetsSection
        entity={facetEntity('Grow share')}
        locked={false}
        onSet={vi.fn()}
        onClear={vi.fn()}
      />
    );
    expect((getByLabelText('Strategy') as HTMLTextAreaElement).value).toBe('Grow share');
    expect(getByLabelText('Necessary Assumption')).toBeTruthy();
    expect(getByLabelText('Parallel Assumption')).toBeTruthy();
    expect(getByLabelText('Sufficiency Assumption')).toBeTruthy();
  });

  it('calls onSet when a facet receives text', () => {
    const onSet = vi.fn();
    const { getByLabelText } = render(
      <StFacetsSection entity={{}} locked={false} onSet={onSet} onClear={vi.fn()} />
    );
    fireEvent.change(getByLabelText('Parallel Assumption'), { target: { value: 'Because X' } });
    expect(onSet).toHaveBeenCalledWith(ST_FACET_KEYS.parallelAssumption, 'Because X');
  });

  it('calls onClear when a facet is emptied', () => {
    const onClear = vi.fn();
    const { getByLabelText } = render(
      <StFacetsSection
        entity={facetEntity('old')}
        locked={false}
        onSet={vi.fn()}
        onClear={onClear}
      />
    );
    fireEvent.change(getByLabelText('Strategy'), { target: { value: '' } });
    expect(onClear).toHaveBeenCalledWith(ST_FACET_KEYS.strategy);
  });

  it('disables the fields when locked', () => {
    const { getByLabelText } = render(
      <StFacetsSection entity={{}} locked onSet={vi.fn()} onClear={vi.fn()} />
    );
    expect((getByLabelText('Strategy') as HTMLTextAreaElement).disabled).toBe(true);
  });
});

describe('EntityLinksSection', () => {
  const linkedDocId = 'doc-target' as DocumentId;
  const buildTarget = () => {
    const targetEntity = makeEntity({ title: 'Core problem' });
    const targetDoc = { ...makeDoc([targetEntity], []), id: linkedDocId, title: 'CRT' };
    const link = { docId: linkedDocId, entityId: targetEntity.id };
    return { targetEntity, targetDoc, link };
  };

  it('renders nothing when the entity has no links', () => {
    const { container } = render(
      <EntityLinksSection
        entity={makeEntity()}
        docs={{}}
        locked={false}
        onNavigate={vi.fn()}
        onUnlink={vi.fn()}
      />
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders a reachable link and navigates on click', () => {
    const { targetEntity, targetDoc, link } = buildTarget();
    const onNavigate = vi.fn();
    const { getByText } = render(
      <EntityLinksSection
        entity={makeEntity({ links: [link] })}
        docs={{ [linkedDocId]: targetDoc }}
        locked={false}
        onNavigate={onNavigate}
        onUnlink={vi.fn()}
      />
    );
    expect(getByText('Core problem')).toBeTruthy();
    fireEvent.click(getByText('Core problem').closest('button') as HTMLButtonElement);
    expect(onNavigate).toHaveBeenCalledWith(linkedDocId, targetEntity.id);
  });

  it('shows a disabled, muted chip when the target tab is closed', () => {
    const { link } = buildTarget();
    const onNavigate = vi.fn();
    const { getByText } = render(
      <EntityLinksSection
        entity={makeEntity({ links: [link] })}
        docs={{}}
        locked={false}
        onNavigate={onNavigate}
        onUnlink={vi.fn()}
      />
    );
    const btn = getByText(/tab closed/).closest('button') as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
    fireEvent.click(btn);
    expect(onNavigate).not.toHaveBeenCalled();
  });

  it('hides a dead link when the target tab is open but the entity was deleted', () => {
    const { targetDoc, link } = buildTarget();
    // Target doc OPEN but its entity is gone (deleted) — the link is dead and
    // must be dropped, not shown as a misleading "tab closed" chip.
    const emptied = { ...targetDoc, entities: {} };
    const { container, queryByText } = render(
      <EntityLinksSection
        entity={makeEntity({ links: [link] })}
        docs={{ [linkedDocId]: emptied }}
        locked={false}
        onNavigate={vi.fn()}
        onUnlink={vi.fn()}
      />
    );
    expect(queryByText(/tab closed/)).toBeNull();
    expect(container.firstChild).toBeNull();
  });

  it('removes a link via the × button, and hides it when locked', () => {
    const { targetDoc, link } = buildTarget();
    const onUnlink = vi.fn();
    const { getByLabelText, rerender, queryByLabelText } = render(
      <EntityLinksSection
        entity={makeEntity({ links: [link] })}
        docs={{ [linkedDocId]: targetDoc }}
        locked={false}
        onNavigate={vi.fn()}
        onUnlink={onUnlink}
      />
    );
    fireEvent.click(getByLabelText('Remove link'));
    expect(onUnlink).toHaveBeenCalledWith(link);

    rerender(
      <EntityLinksSection
        entity={makeEntity({ links: [link] })}
        docs={{ [linkedDocId]: targetDoc }}
        locked
        onNavigate={vi.fn()}
        onUnlink={onUnlink}
      />
    );
    expect(queryByLabelText('Remove link')).toBeNull();
  });
});

describe('ActionFields', () => {
  const action = (over: Parameters<typeof makeEntity>[0] = {}) =>
    makeEntity({ type: 'action', ...over });
  const pre = (over: Partial<Precondition> = {}): Precondition => ({
    id: 'p1',
    title: 'Pre',
    state: 'true',
    ...over,
  });
  const elig = (
    status: ActionEligibility['status'],
    over: Partial<ActionEligibility> = {}
  ): ActionEligibility => ({ status, preconditions: [], ...over });

  it('renders Step #, Need, and Working assumption for an action', () => {
    const { getByText } = render(
      <ActionFields entity={action()} locked={false} eligibility={null} onUpdate={vi.fn()} />
    );
    expect(getByText('Step #')).toBeTruthy();
    expect(getByText('Need')).toBeTruthy();
    expect(getByText('Working assumption')).toBeTruthy();
  });

  it('updates the ordering from the Step # field', () => {
    const onUpdate = vi.fn();
    const { getByRole } = render(
      <ActionFields entity={action()} locked={false} eligibility={null} onUpdate={onUpdate} />
    );
    fireEvent.change(getByRole('spinbutton'), { target: { value: '3' } });
    expect(onUpdate).toHaveBeenCalledWith({ ordering: 3 });
  });

  it('clears the ordering when the Step # field is emptied', () => {
    const onUpdate = vi.fn();
    const { getByRole } = render(
      <ActionFields
        entity={action({ ordering: 2 })}
        locked={false}
        eligibility={null}
        onUpdate={onUpdate}
      />
    );
    fireEvent.change(getByRole('spinbutton'), { target: { value: '' } });
    expect(onUpdate).toHaveBeenCalledWith({ ordering: undefined });
  });

  it('updates the Need field', () => {
    const onUpdate = vi.fn();
    const { getByPlaceholderText } = render(
      <ActionFields entity={action()} locked={false} eligibility={null} onUpdate={onUpdate} />
    );
    fireEvent.change(getByPlaceholderText(/Why is this step needed/), {
      target: { value: 'to ship' },
    });
    expect(onUpdate).toHaveBeenCalledWith({ need: 'to ship' });
  });

  it('shows the eligible callout', () => {
    const { getByText } = render(
      <ActionFields
        entity={action()}
        locked={false}
        eligibility={elig('eligible', { preconditions: [pre()] })}
        onUpdate={vi.fn()}
      />
    );
    expect(getByText('Eligible')).toBeTruthy();
  });

  it('shows the blocked callout naming the offending precondition', () => {
    const { getByText } = render(
      <ActionFields
        entity={action()}
        locked={false}
        eligibility={elig('blocked', {
          preconditions: [pre({ state: 'false', title: 'Funding' })],
          blockedBy: pre({ state: 'false', title: 'Funding' }),
        })}
        onUpdate={vi.fn()}
      />
    );
    expect(getByText('Blocked')).toBeTruthy();
    expect(getByText('Funding')).toBeTruthy();
  });

  it('shows the pending callout', () => {
    const { getByText } = render(
      <ActionFields
        entity={action()}
        locked={false}
        eligibility={elig('pending', { preconditions: [pre({ state: 'unknown' })] })}
        onUpdate={vi.fn()}
      />
    );
    expect(getByText('Pending')).toBeTruthy();
  });

  it('renders no action fields or callout for a non-action / na entity', () => {
    const { queryByText } = render(
      <ActionFields
        entity={makeEntity({ type: 'effect' })}
        locked={false}
        eligibility={elig('na')}
        onUpdate={vi.fn()}
      />
    );
    expect(queryByText('Step #')).toBeNull();
    expect(queryByText('Eligible')).toBeNull();
  });
});
