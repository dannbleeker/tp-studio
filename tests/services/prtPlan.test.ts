import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { buildPrtPlanCsv, orderedIntermediateObjectives } from '@/services/exporters/prtPlan';
import { resetStoreForTest, useDocumentStore } from '@/store';
import { seedEntity } from '../helpers/seedDoc';

/**
 * Phase 3 #6 — PRT ordered-plan CSV export tests.
 *
 * Unlike the TT-task export (which sorts by an explicit step field), the PRT
 * plan derives its order from the dependency edges: a topological sort yields
 * the Intermediate Objectives prerequisite-first. Columns: step / objective /
 * overcomes / depends_on / owner / due_date / status / notes.
 */

const doc = () => useDocumentStore.getState().doc;
const connect = (a: string, b: string) => useDocumentStore.getState().connect(a, b);

beforeEach(resetStoreForTest);
afterEach(resetStoreForTest);

describe('buildPrtPlanCsv', () => {
  it('emits just the header when the doc has no intermediate objectives', () => {
    seedEntity('not an IO', 'effect');
    const csv = buildPrtPlanCsv(doc());
    const lines = csv.split('\n').filter((l) => l.length > 0);
    expect(lines).toHaveLength(1);
    expect(lines[0]).toBe('step,objective,overcomes,depends_on,owner,due_date,status,notes');
  });

  it('renders a single IO with neighbour placeholders and step 1', () => {
    seedEntity('Run a training sprint', 'intermediateObjective');
    const csv = buildPrtPlanCsv(doc());
    const lines = csv.split('\n').filter((l) => l.length > 0);
    expect(lines).toHaveLength(2);
    const row = lines[1]!;
    expect(row.startsWith('1,')).toBe(true);
    expect(row).toContain('Run a training sprint');
    expect(row).toContain('(no obstacle linked)');
    expect(row).toContain('(none)');
    expect(row).toContain(',open,'); // default status without attributes.implemented
  });

  it('shows the obstacle an IO overcomes (outgoing edge to an obstacle)', () => {
    const io = seedEntity('Submit a budget request', 'intermediateObjective');
    const obstacle = seedEntity('No purchasing approval', 'obstacle');
    connect(io.id, obstacle.id);
    expect(buildPrtPlanCsv(doc())).toContain('No purchasing approval');
  });

  it('orders IOs topologically — a prerequisite IO precedes its dependent', () => {
    const ioA = seedEntity('Set up the toolchain', 'intermediateObjective');
    const ioB = seedEntity('Train the team on it', 'intermediateObjective');
    // B depends on A: edge A -> B means "achieve A before B".
    connect(ioA.id, ioB.id);
    const csv = buildPrtPlanCsv(doc());
    expect(csv.indexOf('Set up the toolchain')).toBeLessThan(csv.indexOf('Train the team on it'));
    // B's depends_on cell names A.
    expect(csv).toMatch(/Train the team on it[\s\S]*?Set up the toolchain/);
  });

  it('reads owner / status / due date / notes from the IO entity', () => {
    const io = seedEntity('Hire two testers', 'intermediateObjective');
    const store = useDocumentStore.getState();
    store.updateEntity(io.id, {
      owner: 'Dana',
      description: 'Contract through the launch window.',
    });
    store.setEntityAttribute(io.id, 'implemented', { kind: 'bool', value: true });
    store.setEntityAttribute(io.id, 'dueDate', { kind: 'string', value: '2026-07-15' });
    const csv = buildPrtPlanCsv(doc());
    expect(csv).toContain('Dana');
    expect(csv).toContain('2026-07-15');
    expect(csv).toContain('done'); // implemented -> done
    expect(csv).toContain('Contract through the launch window.');
  });

  it('escapes cells containing commas / quotes per RFC 4180', () => {
    const io = seedEntity('Phase 1, rollout', 'intermediateObjective');
    useDocumentStore.getState().updateEntity(io.id, {
      description: 'Has a "quote" and a comma, here.',
    });
    const csv = buildPrtPlanCsv(doc());
    expect(csv).toContain('"Phase 1, rollout"');
    expect(csv).toContain('""quote""');
  });
});

describe('orderedIntermediateObjectives', () => {
  it('returns only IOs, in dependency order', () => {
    const ioA = seedEntity('A', 'intermediateObjective');
    const ioB = seedEntity('B', 'intermediateObjective');
    seedEntity('An obstacle', 'obstacle');
    connect(ioA.id, ioB.id);
    const order = orderedIntermediateObjectives(doc()).map((e) => e.title);
    expect(order).toEqual(['A', 'B']);
  });

  it('does not drop IOs caught in a dependency cycle', () => {
    const ioA = seedEntity('Cyclic A', 'intermediateObjective');
    const ioB = seedEntity('Cyclic B', 'intermediateObjective');
    connect(ioA.id, ioB.id);
    connect(ioB.id, ioA.id);
    const titles = orderedIntermediateObjectives(doc())
      .map((e) => e.title)
      .sort();
    expect(titles).toEqual(['Cyclic A', 'Cyclic B']);
  });
});
