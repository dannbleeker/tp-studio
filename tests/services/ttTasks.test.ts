import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { buildTtTasksCsv } from '@/services/exporters/ttTasks';
import { resetStoreForTest, useDocumentStore } from '@/store';
import { seedEntity } from '../helpers/seedDoc';

/**
 * Session 135 / spec major gap #7 — TT-task CSV export tests.
 *
 * Closes the first half of the spec's task / execution bridge:
 * one CSV row per `action` entity, with step / action /
 * precondition / outcome / owner / due_date / status /
 * success_criteria columns drop-in for Jira / Trello / Planner.
 *
 * Tests cover:
 *   - empty doc / no actions (header-only output)
 *   - one action with no neighbours (placeholders fill the
 *     precondition / outcome columns)
 *   - actions ordered by `ordering` field with annotation
 *     fallback
 *   - owner precedence (dedicated field beats legacy
 *     attribute) — matches the risk-register exporter's rule
 *   - status from `attributes.implemented`
 *   - due-date from `attributes.dueDate`
 *   - description-as-success-criteria with whitespace collapse
 *   - precondition / outcome strings from incoming / outgoing
 *     edges
 *   - RFC 4180 escaping (commas, embedded quotes)
 */

const doc = () => useDocumentStore.getState().doc;

beforeEach(resetStoreForTest);
afterEach(resetStoreForTest);

describe('buildTtTasksCsv', () => {
  it('emits just the header when the doc has no actions', () => {
    seedEntity('not an action', 'effect');
    const csv = buildTtTasksCsv(doc());
    const lines = csv.split('\n').filter((l) => l.length > 0);
    expect(lines).toHaveLength(1);
    expect(lines[0]).toBe(
      'step,action,precondition,outcome,owner,due_date,status,success_criteria'
    );
  });

  it('renders a single action with neighbour placeholders', () => {
    const action = seedEntity('Migrate the database', 'action');
    const csv = buildTtTasksCsv(doc());
    const lines = csv.split('\n').filter((l) => l.length > 0);
    expect(lines).toHaveLength(2);
    const row = lines[1]!;
    expect(row).toContain('Migrate the database');
    expect(row).toContain('(no precondition drawn)');
    expect(row).toContain('(no outcome drawn)');
    // Default status without `attributes.implemented`.
    expect(row).toContain(',open,');
    expect(action.id.length).toBeGreaterThan(0);
  });

  it('keeps an untitled precondition / outcome visible as a placeholder', () => {
    const pre = seedEntity('', 'effect');
    const action = seedEntity('Deploy the build', 'action');
    const outcome = seedEntity('', 'effect');
    useDocumentStore.getState().connect(pre.id, action.id);
    useDocumentStore.getState().connect(action.id, outcome.id);
    const row = buildTtTasksCsv(doc()).split('\n')[1]!;
    // Both blank-titled neighbours show "(untitled)" rather than collapsing to
    // "(no precondition drawn)" / "(no outcome drawn)" — the action HAS edges.
    expect(row.split('(untitled)').length - 1).toBe(2);
    expect(row).not.toContain('(no precondition drawn)');
    expect(row).not.toContain('(no outcome drawn)');
  });

  it('surfaces incoming edges as preconditions and outgoing as outcomes', () => {
    const pre = seedEntity('Backup taken', 'effect');
    const action = seedEntity('Migrate the database', 'action');
    const outcome = seedEntity('New schema active', 'effect');
    useDocumentStore.getState().connect(pre.id, action.id);
    useDocumentStore.getState().connect(action.id, outcome.id);
    const csv = buildTtTasksCsv(doc());
    expect(csv).toContain('Backup taken');
    expect(csv).toContain('New schema active');
  });

  it('orders rows by `ordering` with annotation-number fallback', () => {
    const a1 = seedEntity('First action', 'action');
    const a2 = seedEntity('Second action', 'action');
    const a3 = seedEntity('Third action', 'action');
    useDocumentStore.getState().updateEntity(a1.id, { ordering: 3 });
    useDocumentStore.getState().updateEntity(a2.id, { ordering: 1 });
    useDocumentStore.getState().updateEntity(a3.id, { ordering: 2 });
    const csv = buildTtTasksCsv(doc());
    // The action with ordering=1 should appear first in the CSV body.
    const i2 = csv.indexOf('Second action');
    const i3 = csv.indexOf('Third action');
    const i1 = csv.indexOf('First action');
    expect(i2).toBeLessThan(i3);
    expect(i3).toBeLessThan(i1);
  });

  it('prefers entity.owner over the legacy attributes.owner', () => {
    const action = seedEntity('Migrate', 'action');
    useDocumentStore.getState().updateEntity(action.id, { owner: 'Alice (current)' });
    useDocumentStore.getState().setEntityAttribute(action.id, 'owner', {
      kind: 'string',
      value: 'Bob (legacy)',
    });
    const csv = buildTtTasksCsv(doc());
    expect(csv).toContain('Alice (current)');
    expect(csv).not.toContain('Bob (legacy)');
  });

  it('falls back to attributes.owner.value when entity.owner is empty', () => {
    const action = seedEntity('Migrate', 'action');
    useDocumentStore.getState().setEntityAttribute(action.id, 'owner', {
      kind: 'string',
      value: 'Bob (legacy)',
    });
    const csv = buildTtTasksCsv(doc());
    expect(csv).toContain('Bob (legacy)');
  });

  it('derives status from attributes.implemented', () => {
    const a1 = seedEntity('First action', 'action');
    useDocumentStore.getState().setEntityAttribute(a1.id, 'implemented', {
      kind: 'bool',
      value: true,
    });
    const a2 = seedEntity('Second action', 'action');
    // Leave a2 without the flag — default 'open'.
    expect(a2.id.length).toBeGreaterThan(0);
    const csv = buildTtTasksCsv(doc());
    // `[\s\S]*?` instead of `[^]*?` so biome's
    // `noEmptyCharacterClassInRegex` rule is satisfied. Same
    // dot-all behaviour for cross-line matching.
    expect(csv).toMatch(/First action[\s\S]*?implemented/);
    expect(csv).toMatch(/Second action[\s\S]*?,open,/);
  });

  it('reads dueDate from attributes.dueDate.value', () => {
    const action = seedEntity('Migrate', 'action');
    useDocumentStore.getState().setEntityAttribute(action.id, 'dueDate', {
      kind: 'string',
      value: '2026-06-30',
    });
    const csv = buildTtTasksCsv(doc());
    expect(csv).toContain('2026-06-30');
  });

  it('collapses description newlines to single spaces in the success-criteria cell', () => {
    const action = seedEntity('Migrate', 'action');
    useDocumentStore.getState().updateEntity(action.id, {
      description: 'Database fully cut over.\n\nNo lingering reads from the legacy schema.',
    });
    const csv = buildTtTasksCsv(doc());
    expect(csv).toContain('Database fully cut over. No lingering reads from the legacy schema.');
    // Confirm the embedded blank-line was collapsed, not kept literal.
    expect(csv).not.toContain('cut over.\n');
  });

  it('escapes cells containing commas / quotes per RFC 4180', () => {
    const action = seedEntity('Roll-out, phase 1', 'action');
    useDocumentStore.getState().updateEntity(action.id, {
      description: 'Includes a "scare quote" and a comma, mid-line.',
    });
    const csv = buildTtTasksCsv(doc());
    expect(csv).toContain('"Roll-out, phase 1"');
    expect(csv).toContain('""scare quote""');
  });
});
