import { exportReasoningNarrative, exportReasoningOutline } from '@/domain/reasoningExport';
import { resetStoreForTest, useDocumentStore } from '@/store';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { seedChain, seedConnectedPair, seedEntity } from '../helpers/seedDoc';

beforeEach(resetStoreForTest);
afterEach(resetStoreForTest);

const doc = () => useDocumentStore.getState().doc;

describe('exportReasoningNarrative — common shape', () => {
  it('renders the title + diagram-type subtitle in the preamble', () => {
    useDocumentStore.getState().setTitle('Customer churn CRT');
    const md = exportReasoningNarrative(doc());
    expect(md).toMatch(/^# Customer churn CRT/);
    expect(md).toContain('*Current Reality Tree*');
  });

  it('includes the author when set', () => {
    useDocumentStore.getState().setTitle('CRT');
    useDocumentStore.getState().setDocumentMeta({ author: 'Alice' });
    const md = exportReasoningNarrative(doc());
    expect(md).toContain('by Alice');
  });

  it('renders one sentence per edge in topological order (causes first)', () => {
    seedChain(['A', 'B', 'C']);
    const md = exportReasoningNarrative(doc());
    // CRT default 'auto' resolves to "because" → sentences read effect-first.
    const idxBecauseA = md.indexOf('"B" because "A".');
    const idxBecauseB = md.indexOf('"C" because "B".');
    expect(idxBecauseA).toBeGreaterThan(-1);
    expect(idxBecauseB).toBeGreaterThan(idxBecauseA);
  });

  it('renders an empty-doc placeholder when no edges exist', () => {
    const md = exportReasoningNarrative(doc());
    expect(md).toContain('No edges drawn yet.');
  });

  it('emits System Scope as bullets when filled', () => {
    useDocumentStore.getState().setSystemScope({
      goal: 'Reduce wait time',
      successMeasures: 'p90 < 4h',
    });
    const md = exportReasoningNarrative(doc());
    expect(md).toContain('## System scope');
    expect(md).toContain('**System goal:** Reduce wait time');
    expect(md).toContain('**Success measures:** p90 < 4h');
  });
});

describe('exportReasoningNarrative — diagram-specific shaping', () => {
  it('CRT appends a "Likely Core Driver(s)" section when one exists', () => {
    // rc → effect → ude
    const rc = seedEntity('Manual order entry', 'rootCause');
    const mid = seedEntity('Sales reps swamped', 'effect');
    const ude = seedEntity('Customers churn', 'ude');
    const s = useDocumentStore.getState();
    s.connect(rc.id, mid.id);
    s.connect(mid.id, ude.id);
    const md = exportReasoningNarrative(doc());
    expect(md).toContain('## Likely Core Driver(s)');
    expect(md).toContain('Manual order entry');
    expect(md).toContain('reaches 1 UDE');
  });

  it('EC renders the conflict statement in the preamble', () => {
    useDocumentStore.getState().newDocument('ec');
    // EC starter doc already has the 5 boxes via INITIAL_DOC_BY_DIAGRAM.
    const md = exportReasoningNarrative(doc());
    expect(md).toContain('## The conflict');
    expect(md).toMatch(/On the one hand, we want/);
  });

  it('EC notes when no mutex edge is drawn yet', () => {
    useDocumentStore.getState().newDocument('ec');
    const md = exportReasoningNarrative(doc());
    expect(md).toContain('no mutual-exclusion edge between the two Wants is drawn yet');
  });

  it('TT renders the Action+Precondition triple form', () => {
    useDocumentStore.getState().newDocument('tt');
    const action = seedEntity('Draft the rubric', 'action');
    const precondition = seedEntity('Support lead is available', 'effect');
    const outcome = seedEntity('Rubric exists', 'effect');
    const s = useDocumentStore.getState();
    s.connect(action.id, outcome.id);
    s.connect(precondition.id, outcome.id);
    const md = exportReasoningNarrative(doc());
    expect(md).toContain(
      'In order to obtain "Rubric exists", do "Draft the rubric" given "Support lead is available".'
    );
  });

  it('uses "in order to" framing for PRT regardless of explicit causality preference', () => {
    useDocumentStore.getState().newDocument('prt');
    seedConnectedPair('Get authorization', 'Launch the program');
    const md = exportReasoningNarrative(doc());
    // PRT auto-resolves to "in order to" — sentences read necessity-style.
    expect(md).toContain('In order to obtain "Launch the program", "Get authorization" must hold.');
  });
});

describe('exportReasoningOutline — common shape', () => {
  it('renders one ### heading per terminal entity', () => {
    // a → b (b has no outgoing edges → terminal)
    seedConnectedPair('A', 'B');
    const md = exportReasoningOutline(doc());
    expect(md).toContain('### B (Effect)');
    expect(md).toContain('- "B" because "A".');
  });

  it('recurses into causes for multi-level chains', () => {
    seedChain(['Root', 'Mid', 'Top']);
    const md = exportReasoningOutline(doc());
    expect(md).toContain('### Top (Effect)');
    // Two nested indent levels.
    expect(md).toMatch(/^- "Top" because "Mid"\./m);
    expect(md).toMatch(/^ {2}- "Mid" because "Root"\./m);
  });

  it('notes terminals with no causes drawn yet', () => {
    seedEntity('Solo terminal', 'effect');
    const md = exportReasoningOutline(doc());
    expect(md).toContain('No causes drawn yet.');
  });

  it('skips assumption-typed entities entirely', () => {
    seedEntity('Real terminal', 'effect');
    seedEntity('Side note', 'assumption');
    const md = exportReasoningOutline(doc());
    expect(md).toContain('Real terminal');
    expect(md).not.toContain('Side note');
  });

  it('EC outline renders the 5-box structure as a description', () => {
    useDocumentStore.getState().newDocument('ec');
    const md = exportReasoningOutline(doc());
    expect(md).toContain('**Common goal:**');
    expect(md).toContain('**Need:**');
    expect(md).toContain('**Want:**');
  });

  it('CRT outline appends Likely Core Driver section', () => {
    const rc = seedEntity('Strong root', 'rootCause');
    const u1 = seedEntity('UDE 1', 'ude');
    const u2 = seedEntity('UDE 2', 'ude');
    const s = useDocumentStore.getState();
    s.connect(rc.id, u1.id);
    s.connect(rc.id, u2.id);
    const md = exportReasoningOutline(doc());
    expect(md).toContain('## Likely Core Driver(s)');
    expect(md).toContain('Strong root');
    expect(md).toContain('reaches 2 UDEs');
  });
});
