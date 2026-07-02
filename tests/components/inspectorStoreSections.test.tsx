import { act, cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { AssumptionWell } from '@/components/inspector/AssumptionWell';
import { EvidenceList } from '@/components/inspector/EvidenceList';
import { GroupInspector } from '@/components/inspector/GroupInspector';
import { assumptionsForEdge } from '@/domain/graph';
import { GROUP_COLORS_ORDER } from '@/domain/groupColors';
import { GROUP_PRESETS } from '@/domain/groupPresets';
import { resetStoreForTest, useDocumentStore } from '@/store';
import { currentDoc } from '@/store/selectors';
import { seedEntity } from '../helpers/seedDoc';

/**
 * Session 177 — store-connected render tests for two inspector sections that
 * read/write the store directly (so they need the real store, not just
 * props): EvidenceList (add / edit / pick source+strength / validate /
 * remove, plus the "entity gone away" toast) and GroupInspector (rename,
 * recolor, preset, collapse, archive-auto-reveal).
 */

beforeEach(resetStoreForTest);
afterEach(cleanup);

const s = () => useDocumentStore.getState();
const doc = () => currentDoc(s());

describe('EvidenceList', () => {
  const evidenceOf = (entityId: string) => doc().entities[entityId]?.evidence ?? [];

  it('adds a new evidence row through the store on "Add evidence"', () => {
    const e = seedEntity('Effect');
    const { getByText } = render(
      <EvidenceList entityId={e.id} evidence={undefined} ownerHint={undefined} />
    );
    act(() => fireEvent.click(getByText('Add evidence').closest('button') as HTMLButtonElement));
    expect(evidenceOf(e.id)).toHaveLength(1);
  });

  it('surfaces a toast when adding to an entity that has gone away', () => {
    seedEntity('Effect');
    const before = s().toasts.length;
    const { getByText } = render(
      <EvidenceList entityId="missing-entity" evidence={undefined} ownerHint={undefined} />
    );
    act(() => fireEvent.click(getByText('Add evidence').closest('button') as HTMLButtonElement));
    expect(evidenceOf('missing-entity')).toHaveLength(0);
    expect(s().toasts.length).toBe(before + 1);
  });

  it('edits the description, picks source + strength directly, and validates a row', () => {
    const e = seedEntity('Effect');
    act(() => {
      s().addEvidence(e.id);
    });
    const item = evidenceOf(e.id)[0]!;
    const { getByPlaceholderText, getByLabelText, getByText } = render(
      <EvidenceList entityId={e.id} evidence={[item]} ownerHint="Dann" />
    );

    act(() =>
      fireEvent.change(getByPlaceholderText(/What's the evidence/), {
        target: { value: 'Survey n=200' },
      })
    );
    expect(evidenceOf(e.id)[0]?.description).toBe('Survey n=200');

    // Session 193 — source + strength are now direct-pick <select>s, not
    // forward-only cycle chips: any value in one change, no intermediate steps.
    act(() =>
      fireEvent.change(getByLabelText(/Evidence source/), { target: { value: 'stakeholder' } })
    );
    expect(evidenceOf(e.id)[0]?.source).toBe('stakeholder');

    act(() =>
      fireEvent.change(getByLabelText(/Evidence strength/), { target: { value: 'strong' } })
    );
    expect(evidenceOf(e.id)[0]?.strength).toBe('strong');

    act(() => fireEvent.click(getByText(/Mark validated/).closest('button') as HTMLButtonElement));
    expect(evidenceOf(e.id)[0]?.validatedAt).toBeTypeOf('number');
    expect(evidenceOf(e.id)[0]?.validatedBy).toBe('Dann');
  });

  it('removes a row via the × button', () => {
    const e = seedEntity('Effect');
    act(() => {
      s().addEvidence(e.id);
    });
    const item = evidenceOf(e.id)[0]!;
    const { getByLabelText } = render(
      <EvidenceList entityId={e.id} evidence={[item]} ownerHint={undefined} />
    );
    act(() => fireEvent.click(getByLabelText('Remove evidence')));
    expect(evidenceOf(e.id)).toHaveLength(0);
  });

  it('renders the citation link only for a safe URL scheme (live-edit XSS guard)', () => {
    // The URL field's live-edit path writes the raw input straight to state,
    // bypassing the import-time validator — so EvidenceList must itself refuse
    // to render a `javascript:`/`data:` URL as a clickable href.
    const e = seedEntity('Effect');
    act(() => {
      s().addEvidence(e.id);
    });
    const item = evidenceOf(e.id)[0]!;

    const safe = render(
      <EvidenceList
        entityId={e.id}
        evidence={[{ ...item, url: 'https://example.com' }]}
        ownerHint={undefined}
      />
    );
    expect(safe.queryByLabelText('Open citation in new tab')).not.toBeNull();
    safe.unmount();

    const hostile = render(
      <EvidenceList
        entityId={e.id}
        evidence={[{ ...item, url: 'javascript:alert(1)' }]}
        ownerHint={undefined}
      />
    );
    expect(hostile.queryByLabelText('Open citation in new tab')).toBeNull();
  });
});

describe('GroupInspector', () => {
  const makeGroup = () => {
    const a = seedEntity('A');
    const b = seedEntity('B');
    const g = s().createGroupFromSelection([a.id, b.id]);
    if (!g) throw new Error('group not created');
    return g;
  };
  const grp = (id: string) => doc().groups[id];

  it('renders nothing for an unknown group id', () => {
    const { container } = render(<GroupInspector groupId="missing" />);
    expect(container.firstChild).toBeNull();
  });

  it('renames the group via the Title field', () => {
    const g = makeGroup();
    const { getByRole } = render(<GroupInspector groupId={g.id} />);
    act(() => fireEvent.change(getByRole('textbox'), { target: { value: 'Conflict cloud' } }));
    expect(grp(g.id)?.title).toBe('Conflict cloud');
  });

  it('recolors the group from the swatch row', () => {
    const g = makeGroup();
    const target = GROUP_COLORS_ORDER.find((c) => c !== grp(g.id)?.color)!;
    const { getByLabelText } = render(<GroupInspector groupId={g.id} />);
    act(() => fireEvent.click(getByLabelText(target)));
    expect(grp(g.id)?.color).toBe(target);
  });

  it('applies a preset, setting title + color in one click', () => {
    const g = makeGroup();
    const preset = GROUP_PRESETS[0]!;
    const { getByText } = render(<GroupInspector groupId={g.id} />);
    act(() => fireEvent.click(getByText(preset.title).closest('button') as HTMLButtonElement));
    expect(grp(g.id)?.title).toBe(preset.title);
    expect(grp(g.id)?.color).toBe(preset.color);
  });

  it('toggles the collapsed state', () => {
    const g = makeGroup();
    const before = grp(g.id)?.collapsed ?? false;
    const { getByText } = render(<GroupInspector groupId={g.id} />);
    const label = before ? 'Expand' : 'Collapse';
    act(() => fireEvent.click(getByText(label).closest('button') as HTMLButtonElement));
    expect(grp(g.id)?.collapsed).toBe(!before);
  });

  it('archives the group and auto-reveals archived groups', () => {
    const g = makeGroup();
    const { getByText } = render(<GroupInspector groupId={g.id} />);
    act(() =>
      fireEvent.click(getByText(/Archive \(preserve/).closest('button') as HTMLButtonElement)
    );
    expect(grp(g.id)?.archived).toBe(true);
    expect(s().showArchivedGroups).toBe(true);
  });
});

describe('AssumptionWell — direct-pick status + kind (Session 193)', () => {
  it('picks status + kind in one change; kind round-trips the untyped state', () => {
    const a = seedEntity('Cause');
    const b = seedEntity('Effect');
    let edgeId = '';
    act(() => {
      edgeId = s().connect(a.id, b.id)?.id ?? '';
    });
    expect(edgeId).not.toBe('');
    let assumptionId = '';
    act(() => {
      assumptionId = s().addAssumptionToEdge(edgeId)?.id ?? '';
    });
    const { getByLabelText } = render(<AssumptionWell edgeId={edgeId} />);
    expect(assumptionsForEdge(doc(), edgeId)).toHaveLength(1);

    // Status: jump straight to 'invalid' (no intermediate cycle steps).
    act(() =>
      fireEvent.change(getByLabelText(/Assumption status/), { target: { value: 'invalid' } })
    );
    expect(doc().assumptions?.[assumptionId]?.status).toBe('invalid');

    // Kind: pick 'sufficient', then return to untyped via the '' sentinel.
    act(() =>
      fireEvent.change(getByLabelText(/Assumption kind/), { target: { value: 'sufficient' } })
    );
    expect(doc().assumptions?.[assumptionId]?.kind).toBe('sufficient');
    act(() => fireEvent.change(getByLabelText(/Assumption kind/), { target: { value: '' } }));
    expect(doc().assumptions?.[assumptionId]?.kind).toBeUndefined();
  });
});
