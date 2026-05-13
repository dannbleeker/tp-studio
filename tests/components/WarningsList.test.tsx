import { WarningsList } from '@/components/inspector/WarningsList';
import type { Warning } from '@/domain/types';
import { resetStoreForTest } from '@/store';
import { cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

beforeEach(resetStoreForTest);
afterEach(cleanup);

/**
 * Block C / E5 — three-level tier grouping. WarningsList receives an
 * already-filtered slice of Warnings (for the selected entity / edge) and
 * groups them under CLARITY / EXISTENCE / SUFFICIENCY headers in that
 * order. Tiers with no warnings drop out — no empty headers.
 */

const w = (id: string, ruleId: string, tier: 'clarity' | 'existence' | 'sufficiency'): Warning => ({
  id,
  ruleId: ruleId as Warning['ruleId'],
  message: `${ruleId} message`,
  target: { kind: 'entity', id: 'e-1' },
  resolved: false,
  tier,
});

describe('WarningsList', () => {
  it('renders the empty-state when no warnings are present', () => {
    const { getByText } = render(<WarningsList warnings={[]} />);
    expect(getByText('No CLR concerns.')).toBeTruthy();
  });

  it('renders tier section headers in canonical order', () => {
    const warnings = [
      w('1', 'cause-sufficiency', 'sufficiency'),
      w('2', 'entity-existence', 'existence'),
      w('3', 'clarity', 'clarity'),
    ];
    const { container } = render(<WarningsList warnings={warnings} />);
    const headers = Array.from(container.querySelectorAll('section span'))
      .map((n) => n.textContent ?? '')
      .filter((t) => ['Clarity', 'Existence', 'Sufficiency'].includes(t));
    expect(headers).toEqual(['Clarity', 'Existence', 'Sufficiency']);
  });

  it('omits a header when its tier has no warnings', () => {
    // Only existence-tier warnings: clarity + sufficiency headers must not render.
    const warnings = [w('1', 'entity-existence', 'existence'), w('2', 'cycle', 'existence')];
    const { container } = render(<WarningsList warnings={warnings} />);
    const sectionHeaders = Array.from(container.querySelectorAll('section span')).map(
      (n) => n.textContent ?? ''
    );
    expect(sectionHeaders.some((t) => t === 'Clarity')).toBe(false);
    expect(sectionHeaders.some((t) => t === 'Existence')).toBe(true);
    expect(sectionHeaders.some((t) => t === 'Sufficiency')).toBe(false);
  });

  it('shows the open / resolved counter in the top header', () => {
    const warnings = [
      w('1', 'clarity', 'clarity'),
      { ...w('2', 'tautology', 'clarity'), resolved: true },
    ];
    const { container } = render(<WarningsList warnings={warnings} />);
    expect(container.textContent).toMatch(/CLR \(1 open, 1 resolved\)/);
  });
});
