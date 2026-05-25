import { describe, expect, it } from 'vitest';
import {
  collapsedGroupAriaLabel,
  edgeAriaLabel,
  entityAriaLabel,
  groupAriaLabel,
} from '@/components/canvas/hooks/nodeAriaLabels';
import type { Group, GroupId } from '@/domain/types';
import { makeEntity, resetIds } from '../../domain/helpers';

/**
 * Session 135 — accessible-name contract for the canvas. React Flow's
 * focusable node wrapper announces these strings to screen readers, so
 * the shape is part of the public UX surface and worth pinning.
 */

const group = (id: string, overrides: Partial<Group> = {}): Group => ({
  id: id as GroupId,
  title: 'My group',
  color: 'slate',
  memberIds: [],
  collapsed: false,
  createdAt: 0,
  updatedAt: 0,
  ...overrides,
});

describe('entityAriaLabel', () => {
  it('starts with the human type label and the entity title', () => {
    resetIds();
    const e = makeEntity({ type: 'ude', title: 'Customers churn at renewal' });
    expect(entityAriaLabel(e)).toMatch(/Undesirable Effect: Customers churn at renewal/);
  });

  it('appends the ordering step when present', () => {
    resetIds();
    const e = makeEntity({ type: 'action', title: 'Do it', ordering: 3 });
    expect(entityAriaLabel(e)).toContain('step 3');
  });

  it('omits state when effective state is unknown', () => {
    resetIds();
    const e = makeEntity({ type: 'effect', title: 'Whatever' });
    expect(entityAriaLabel(e, { effectiveState: 'unknown' })).not.toContain('state');
  });

  it('appends "(speculative)" only when the state is from a what-if override', () => {
    resetIds();
    const e = makeEntity({ type: 'effect', title: 'Whatever' });
    expect(entityAriaLabel(e, { effectiveState: 'true' })).toContain('state true');
    expect(entityAriaLabel(e, { effectiveState: 'true' })).not.toContain('speculative');
    expect(entityAriaLabel(e, { effectiveState: 'false', speculated: true })).toContain(
      'state false (speculative)'
    );
  });

  it('appends action-eligibility when stamped', () => {
    resetIds();
    const e = makeEntity({ type: 'action', title: 'Send' });
    expect(entityAriaLabel(e, { eligibility: 'eligible' })).toContain('action eligible');
    expect(entityAriaLabel(e, { eligibility: 'blocked' })).toContain('action blocked');
    expect(entityAriaLabel(e, { eligibility: 'pending' })).toContain(
      'action pending preconditions'
    );
  });

  it('appends locus when set', () => {
    resetIds();
    const e = makeEntity({ type: 'effect', title: 'x', spanOfControl: 'control' });
    expect(entityAriaLabel(e)).toContain('locus control');
  });

  it('falls back to "untitled" when title is empty', () => {
    resetIds();
    const e = makeEntity({ type: 'effect', title: '' });
    expect(entityAriaLabel(e)).toContain('untitled');
  });
});

describe('groupAriaLabel', () => {
  it('reads "Group: title (N entities)"', () => {
    expect(groupAriaLabel(group('g-1', { title: 'Region A' }), 3)).toBe(
      'Group: Region A (3 entities)'
    );
  });

  it('uses the singular "1 entity"', () => {
    expect(groupAriaLabel(group('g-1'), 1)).toContain('1 entity');
  });

  it('appends collapsed / archived modifiers', () => {
    expect(groupAriaLabel(group('g-1', { collapsed: true }), 2)).toContain('collapsed');
    expect(groupAriaLabel(group('g-1', { archived: true }), 2)).toContain('archived');
    const both = groupAriaLabel(group('g-1', { collapsed: true, archived: true }), 2);
    expect(both).toContain('collapsed');
    expect(both).toContain('archived');
  });
});

describe('collapsedGroupAriaLabel', () => {
  it('reads "Collapsed group: title (N hidden)"', () => {
    expect(collapsedGroupAriaLabel(group('g-1', { title: 'NB' }), 4)).toBe(
      'Collapsed group: NB (4 entities hidden)'
    );
  });
});

describe('edgeAriaLabel', () => {
  it('reads "Edge from X to Y" by default', () => {
    expect(edgeAriaLabel({ sourceTitle: 'A', targetTitle: 'B' })).toBe('Edge from A to B');
  });

  it('reports the count for aggregated synthetic edges (no per-edge modifiers)', () => {
    expect(
      edgeAriaLabel({
        sourceTitle: 'A',
        targetTitle: 'B',
        aggregateCount: 3,
        isBackEdge: true,
      })
    ).toBe('3 aggregated edges from A to B');
  });

  it('appends back-edge / mutex modifiers + assumption count', () => {
    const label = edgeAriaLabel({
      sourceTitle: 'A',
      targetTitle: 'B',
      isBackEdge: true,
      isMutex: true,
      assumptionCount: 2,
    });
    expect(label).toBe('Edge from A to B, back-edge, mutually exclusive, 2 assumptions');
  });

  it('singularises 1 assumption', () => {
    expect(edgeAriaLabel({ sourceTitle: 'A', targetTitle: 'B', assumptionCount: 1 })).toContain(
      '1 assumption'
    );
  });

  it('handles empty endpoint titles', () => {
    expect(edgeAriaLabel({ sourceTitle: '', targetTitle: '' })).toBe(
      'Edge from untitled to untitled'
    );
  });
});
