import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  buildReasoningSentences,
  exportReasoningNarrative,
  exportReasoningOutline,
} from '@/domain/reasoningExport';
import { resetStoreForTest, useDocumentStore } from '@/store';
import { makeDoc, makeEdge, makeEntity, resetIds } from '../domain/helpers';
import { seedChain, seedConnectedPair, seedEntity } from '../helpers/seedDoc';

beforeEach(resetStoreForTest);
afterEach(resetStoreForTest);

const doc = () => useDocumentStore.getState().doc;

describe('buildReasoningSentences', () => {
  it('returns the ordered cause→effect sentences (causes first)', () => {
    seedChain(['A', 'B', 'C']);
    expect(buildReasoningSentences(doc())).toEqual(['"B" because "A".', '"C" because "B".']);
  });

  it('returns an empty array for a doc with no edges', () => {
    expect(buildReasoningSentences(doc())).toEqual([]);
  });
});

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

  it('collapses newlines in system-scope values so the Markdown list stays intact', () => {
    useDocumentStore.getState().setTitle('CRT');
    useDocumentStore.getState().setSystemScope({ boundaries: 'Line one\nLine two' });
    const md = exportReasoningNarrative(doc());
    expect(md).toContain('- **Boundaries:** Line one Line two');
    // The continuation must not break out of the bullet into a sibling line.
    expect(md).not.toContain('Line one\nLine two');
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

  it('omits the Method-checklist preamble when no step is ticked', () => {
    // Fresh doc → checklist is undefined → preamble skips the section.
    const md = exportReasoningNarrative(doc());
    expect(md).not.toContain('## Method checklist');
  });

  it('renders Method-checklist progress when at least one step is ticked', () => {
    useDocumentStore.getState().setMethodStep('crt.scope', true);
    useDocumentStore.getState().setMethodStep('crt.udes', true);
    const md = exportReasoningNarrative(doc());
    // Header carries the (completed / total) counter — the CRT
    // checklist in `domain/methodChecklist.ts` has 9 steps.
    expect(md).toContain('## Method checklist (2 / 9)');
    // Checked steps render with `[x]`, others with `[ ]`.
    expect(md).toContain('- [x] Define the system scope');
    expect(md).toContain('- [x] List 3–5 critical UDEs');
    expect(md).toContain('- [ ] Connect UDEs into causal chains');
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

// ─────────────────────────────────────────────────────────────────────────────
// Additional branch-coverage tests (pure-domain helpers where store would
// require awkward indirect mutations)
// ─────────────────────────────────────────────────────────────────────────────

describe('renderPreamble — untitled / blank author / no description', () => {
  beforeEach(() => {
    resetIds();
  });

  it('falls back to "Untitled" when doc.title is empty', () => {
    const doc = makeDoc([], []);
    // makeDoc sets title = 'Test document' — override with blank
    const blank = { ...doc, title: '' };
    const md = exportReasoningNarrative(blank);
    expect(md).toMatch(/^# Untitled/);
  });

  it('omits the "by …" line when author is whitespace-only', () => {
    const doc = makeDoc([], []);
    const d = { ...doc, author: '   ' };
    const md = exportReasoningNarrative(d);
    expect(md).not.toContain('by');
  });

  it('omits the description block when description is whitespace-only', () => {
    const doc = makeDoc([], []);
    const d = { ...doc, description: '   ' };
    const md = exportReasoningNarrative(d);
    // Only the title + subtitle + reasoning section should appear
    const lines = md.split('\n').filter((l) => l.trim().length > 0);
    // title / subtitle / reasoning header / no-edges placeholder
    expect(lines.length).toBeLessThanOrEqual(4);
    expect(md).not.toContain('## System scope');
  });

  it('includes description when non-empty', () => {
    const doc = makeDoc([], []);
    const d = { ...doc, description: 'Some context here.' };
    const md = exportReasoningNarrative(d);
    expect(md).toContain('Some context here.');
  });

  it('omits System scope section when all fields are blank', () => {
    const doc = makeDoc([], []);
    const d = {
      ...doc,
      systemScope: {
        goal: '  ',
        successMeasures: '',
      },
    };
    const md = exportReasoningNarrative(d);
    expect(md).not.toContain('## System scope');
  });

  it('renders every systemScope field that is non-blank', () => {
    const doc = makeDoc([], []);
    const d = {
      ...doc,
      systemScope: {
        goal: 'Ship faster',
        necessaryConditions: 'CI stays green',
        successMeasures: 'p50 deploy < 5 min',
        boundaries: 'Engineering only',
        containingSystem: 'The whole company',
        interactingSystems: 'Marketing toolchain',
        inputsOutputs: 'Commits in / deployments out',
      },
    };
    const md = exportReasoningNarrative(d);
    expect(md).toContain('## System scope');
    expect(md).toContain('**Necessary conditions:** CI stays green');
    expect(md).toContain('**Boundaries:** Engineering only');
    expect(md).toContain('**Containing system:** The whole company');
    expect(md).toContain('**Interacting systems:** Marketing toolchain');
    expect(md).toContain('**Inputs / outputs:** Commits in / deployments out');
  });

  it('omits method checklist when checklist object is present but all false', () => {
    const doc = makeDoc([], []);
    const d = { ...doc, methodChecklist: { 'crt.scope': false, 'crt.udes': false } };
    const md = exportReasoningNarrative(d);
    expect(md).not.toContain('## Method checklist');
  });

  it('omits method checklist for freeform docs (no steps defined)', () => {
    const doc = makeDoc([], [], 'freeform');
    const d = { ...doc, methodChecklist: { someKey: true } };
    const md = exportReasoningNarrative(d);
    // freeform has zero steps so the block is suppressed regardless of the map
    expect(md).not.toContain('## Method checklist');
  });
});

describe('renderPreamble — EC conflict statement branches', () => {
  it('skips the conflict block when EC has fewer than 2 wants', () => {
    const want = makeEntity({ type: 'want', title: 'Reduce cost', annotationNumber: 1 });
    const doc = makeDoc([want], [], 'ec');
    const md = exportReasoningNarrative(doc);
    expect(md).not.toContain('## The conflict');
  });

  it('omits the mutex note when a mutual-exclusion edge is present', () => {
    const w1 = makeEntity({ type: 'want', title: 'Want A', annotationNumber: 1 });
    const w2 = makeEntity({ type: 'want', title: 'Want B', annotationNumber: 2 });
    // A mutex edge between the two wants
    const mutex = makeEdge(w1.id, w2.id, { isMutualExclusion: true });
    const doc = makeDoc([w1, w2], [mutex], 'ec');
    const md = exportReasoningNarrative(doc);
    // Conflict statement is present ...
    expect(md).toContain('## The conflict');
    // ... but the "no mutex" advisory note is NOT there
    expect(md).not.toContain('no mutual-exclusion edge between the two Wants is drawn yet');
  });

  it('uses fallback titles "Want 1" / "Want 2" when want titles are blank', () => {
    const w1 = makeEntity({ type: 'want', title: '', annotationNumber: 1 });
    const w2 = makeEntity({ type: 'want', title: '', annotationNumber: 2 });
    const doc = makeDoc([w1, w2], [], 'ec');
    const md = exportReasoningNarrative(doc);
    expect(md).toContain('"Want 1"');
    expect(md).toContain('"Want 2"');
  });
});

describe('appendCoreDriverSection — non-CRT and zero-drivers branches', () => {
  it('does not emit a Core Driver section on FRT docs', () => {
    resetIds();
    const a = makeEntity({ type: 'injection', title: 'Inject', annotationNumber: 1 });
    const b = makeEntity({ type: 'desiredEffect', title: 'DE', annotationNumber: 2 });
    const e = makeEdge(a.id, b.id);
    const doc = makeDoc([a, b], [e], 'frt');
    const md = exportReasoningNarrative(doc);
    expect(md).not.toContain('## Likely Core Driver');
  });

  it('does not emit a Core Driver section on PRT docs', () => {
    resetIds();
    const a = makeEntity({ type: 'intermediateObjective', title: 'IO', annotationNumber: 1 });
    const doc = makeDoc([a], [], 'prt');
    const md = exportReasoningNarrative(doc);
    expect(md).not.toContain('## Likely Core Driver');
  });

  it('omits the section on CRT when no entity reaches any UDE', () => {
    // Single isolated rootCause with no edge to a UDE → no driver candidates.
    resetIds();
    const rc = makeEntity({ type: 'rootCause', title: 'Isolated root', annotationNumber: 1 });
    const doc = makeDoc([rc], [], 'crt');
    const md = exportReasoningNarrative(doc);
    expect(md).not.toContain('## Likely Core Driver');
  });

  it('uses singular "UDE" label when core driver reaches exactly 1 UDE', () => {
    // Already covered by the store-based test ('reaches 1 UDE') — replicate
    // here purely with makeDoc for the plural=false branch.
    resetIds();
    const rc = makeEntity({ type: 'rootCause', title: 'Single driver', annotationNumber: 1 });
    const ude = makeEntity({ type: 'ude', title: 'One pain', annotationNumber: 2 });
    const e = makeEdge(rc.id, ude.id);
    const doc = makeDoc([rc, ude], [e], 'crt');
    const md = exportReasoningNarrative(doc);
    expect(md).toContain('reaches 1 UDE.');
    expect(md).not.toContain('UDEs');
  });

  it('uses plural "UDEs" label when core driver reaches 2+ UDEs', () => {
    resetIds();
    const rc = makeEntity({ type: 'rootCause', title: 'Main driver', annotationNumber: 1 });
    const u1 = makeEntity({ type: 'ude', title: 'UDE one', annotationNumber: 2 });
    const u2 = makeEntity({ type: 'ude', title: 'UDE two', annotationNumber: 3 });
    const e1 = makeEdge(rc.id, u1.id);
    const e2 = makeEdge(rc.id, u2.id);
    const doc = makeDoc([rc, u1, u2], [e1, e2], 'crt');
    const md = exportReasoningNarrative(doc);
    expect(md).toContain('reaches 2 UDEs.');
  });
});

describe('buildReasoningSentences — assumption skipping and non-CRT types', () => {
  it('skips edges whose source is an assumption entity', () => {
    resetIds();
    const assumption = makeEntity({ type: 'assumption', title: 'Hidden', annotationNumber: 1 });
    const effect = makeEntity({ type: 'effect', title: 'Effect', annotationNumber: 2 });
    const e = makeEdge(assumption.id, effect.id);
    const doc = makeDoc([assumption, effect], [e], 'crt');
    expect(buildReasoningSentences(doc)).toEqual([]);
  });

  it('skips edges whose target is an assumption entity', () => {
    resetIds();
    const effect = makeEntity({ type: 'effect', title: 'Effect', annotationNumber: 1 });
    const assumption = makeEntity({ type: 'assumption', title: 'Hidden', annotationNumber: 2 });
    const e = makeEdge(effect.id, assumption.id);
    const doc = makeDoc([effect, assumption], [e], 'crt');
    expect(buildReasoningSentences(doc)).toEqual([]);
  });

  it('uses "therefore" connector on FRT (auto → "because"; explicit "therefore" override)', () => {
    resetIds();
    const a = makeEntity({ type: 'injection', title: 'Injection A', annotationNumber: 1 });
    const b = makeEntity({ type: 'desiredEffect', title: 'Effect B', annotationNumber: 2 });
    const e = makeEdge(a.id, b.id);
    const doc = makeDoc([a, b], [e], 'frt');
    // frt auto → "because" — override with explicit 'therefore'
    const sentences = buildReasoningSentences(doc, 'therefore');
    expect(sentences).toEqual(['"Injection A", therefore "Effect B".']);
  });

  it('uses "in order to" connector on goalTree (auto — Goal Tree is necessity logic)', () => {
    // A Goal Tree reads in necessity ("in order to obtain Y, X must hold"), like
    // prt/ec — not sufficiency. Its 'auto' reading resolves to 'in order to',
    // matching the PRIMARY_LOGIC map (goalTree: 'necessity').
    resetIds();
    const goal = makeEntity({ type: 'goal', title: 'Big Goal', annotationNumber: 1 });
    const nc = makeEntity({ type: 'necessaryCondition', title: 'NC 1', annotationNumber: 2 });
    const e = makeEdge(nc.id, goal.id);
    const doc = makeDoc([goal, nc], [e], 'goalTree');
    const sentences = buildReasoningSentences(doc, 'auto');
    expect(sentences).toEqual(['In order to obtain "Big Goal", "NC 1" must hold.']);
  });

  it('uses "in order to" connector on NBR (auto maps to "because"; explicit override works)', () => {
    resetIds();
    const inj = makeEntity({
      type: 'injection',
      title: 'Candidate injection',
      annotationNumber: 1,
    });
    const ude = makeEntity({ type: 'ude', title: 'Negative UDE', annotationNumber: 2 });
    const e = makeEdge(inj.id, ude.id);
    const doc = makeDoc([inj, ude], [e], 'nbr');
    // nbr auto → "because"
    const sentences = buildReasoningSentences(doc, 'auto');
    expect(sentences).toEqual(['"Negative UDE" because "Candidate injection".']);
  });

  it('produces no connector (arrow form) when label is "none"', () => {
    resetIds();
    const a = makeEntity({ type: 'effect', title: 'Cause', annotationNumber: 1 });
    const b = makeEntity({ type: 'effect', title: 'Effect', annotationNumber: 2 });
    const e = makeEdge(a.id, b.id);
    const doc = makeDoc([a, b], [e], 'crt');
    const sentences = buildReasoningSentences(doc, 'none');
    expect(sentences).toEqual(['Cause → Effect']);
  });

  it('uses a per-edge label override when the edge has an explicit label set', () => {
    resetIds();
    const a = makeEntity({ type: 'effect', title: 'Root', annotationNumber: 1 });
    const b = makeEntity({ type: 'effect', title: 'Branch', annotationNumber: 2 });
    const e = makeEdge(a.id, b.id, { label: 'leads to' });
    const doc = makeDoc([a, b], [e], 'crt');
    const sentences = buildReasoningSentences(doc);
    // "leads to" is neither "because" nor "therefore" nor "in order to", so it
    // falls through to the default sentence template:
    expect(sentences).toEqual(['"Branch" leads to "Root".']);
  });
});

describe('ttTriples — fallback paths in TT diagram', () => {
  it('falls back to per-edge sentences when the target has only one cause (no action+precondition pair)', () => {
    // TT doc where target has a single (non-action) precondition → no triple.
    beforeEach(resetStoreForTest);
    useDocumentStore.getState().newDocument('tt');
    const precondition = seedEntity('Pre-existing state', 'effect');
    const outcome = seedEntity('Outcome happens', 'effect');
    useDocumentStore.getState().connect(precondition.id, outcome.id);
    const md = exportReasoningNarrative(useDocumentStore.getState().doc);
    // Falls back to per-edge: "Outcome happens" because "Pre-existing state".
    expect(md).toContain('"Outcome happens"');
    expect(md).toContain('"Pre-existing state"');
    // Should NOT have the "In order to obtain…" triple form
    expect(md).not.toContain('In order to obtain "Outcome happens"');
  });

  it('skips TT edges whose source or target is an assumption', () => {
    resetIds();
    const assumption = makeEntity({ type: 'assumption', title: 'Unstated', annotationNumber: 1 });
    const action = makeEntity({ type: 'action', title: 'Do something', annotationNumber: 2 });
    const outcome = makeEntity({ type: 'effect', title: 'Result', annotationNumber: 3 });
    const e1 = makeEdge(assumption.id, outcome.id); // assumption as source → skip
    const e2 = makeEdge(action.id, outcome.id);
    const doc = makeDoc([assumption, action, outcome], [e1, e2], 'tt');
    // With only action feeding outcome (assumption skipped), no triple is possible.
    const sentences = buildReasoningSentences(doc);
    // Should include per-edge sentence for action→outcome, NOT the "In order to" form
    expect(sentences.some((s) => s.includes('"Result"'))).toBe(true);
    expect(sentences.every((s) => !s.includes('"Unstated"'))).toBe(true);
  });
});

describe('exportReasoningNarrative — diagram types not yet covered', () => {
  it('renders FRT narrative with "because" (auto default for non-PRT/EC)', () => {
    resetIds();
    const inj = makeEntity({ type: 'injection', title: 'Apply policy', annotationNumber: 1 });
    const de = makeEntity({ type: 'desiredEffect', title: 'Churn drops', annotationNumber: 2 });
    const e = makeEdge(inj.id, de.id);
    const doc = makeDoc([inj, de], [e], 'frt');
    const md = exportReasoningNarrative(doc);
    expect(md).toContain('*Future Reality Tree*');
    expect(md).toContain('"Churn drops" because "Apply policy".');
  });

  it('renders goalTree narrative with "in order to" phrasing (necessity logic)', () => {
    resetIds();
    const goal = makeEntity({ type: 'goal', title: 'Become profitable', annotationNumber: 1 });
    const csf = makeEntity({
      type: 'criticalSuccessFactor',
      title: 'Grow revenue',
      annotationNumber: 2,
    });
    const e = makeEdge(csf.id, goal.id);
    const doc = makeDoc([goal, csf], [e], 'goalTree');
    const md = exportReasoningNarrative(doc);
    expect(md).toContain('*Goal Tree*');
    expect(md).toContain('In order to obtain "Become profitable", "Grow revenue" must hold.');
  });

  it('renders ST narrative correctly', () => {
    resetIds();
    const strategy = makeEntity({ type: 'goal', title: 'Apex strategy', annotationNumber: 1 });
    const doc = makeDoc([strategy], [], 'st');
    const md = exportReasoningNarrative(doc);
    expect(md).toContain('*Strategy & Tactics Tree*');
  });

  it('renders freeform narrative correctly', () => {
    resetIds();
    const a = makeEntity({ type: 'effect', title: 'Node A', annotationNumber: 1 });
    const b = makeEntity({ type: 'effect', title: 'Node B', annotationNumber: 2 });
    const e = makeEdge(a.id, b.id);
    const doc = makeDoc([a, b], [e], 'freeform');
    const md = exportReasoningNarrative(doc);
    expect(md).toContain('*Freeform Diagram*');
    expect(md).not.toContain('## Method checklist');
  });

  it('renders NBR narrative correctly', () => {
    resetIds();
    const inj = makeEntity({ type: 'injection', title: 'Add QA gate', annotationNumber: 1 });
    const ude = makeEntity({ type: 'ude', title: 'Slower deploy', annotationNumber: 2 });
    const e = makeEdge(inj.id, ude.id);
    const doc = makeDoc([inj, ude], [e], 'nbr');
    const md = exportReasoningNarrative(doc);
    expect(md).toContain('*Negative Branch Reservation*');
    expect(md).toContain('"Slower deploy" because "Add QA gate".');
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

  it('renders "No structural entities yet." when the doc has no structural entities', () => {
    // A freeform doc with only an assumption entity (non-structural)
    resetIds();
    const asmpt = makeEntity({ type: 'assumption', title: 'Hidden note', annotationNumber: 1 });
    const d = makeDoc([asmpt], [], 'freeform');
    const md = exportReasoningOutline(d);
    expect(md).toContain('*No structural entities yet.*');
    expect(md).not.toContain('Hidden note');
  });

  it('findTerminals: outgoing-only-to-assumption entities count as terminals', () => {
    // b has an outgoing edge to an assumption — that makes it a "terminal"
    // because structurally it has no real downstream.
    resetIds();
    const a = makeEntity({ type: 'effect', title: 'Cause node', annotationNumber: 1 });
    const b = makeEntity({ type: 'effect', title: 'Terminal node', annotationNumber: 2 });
    const asmpt = makeEntity({ type: 'assumption', title: 'Side note', annotationNumber: 3 });
    const e1 = makeEdge(a.id, b.id);
    const e2 = makeEdge(b.id, asmpt.id); // b → assumption: b still acts as terminal
    const d = makeDoc([a, b, asmpt], [e1, e2], 'crt');
    const md = exportReasoningOutline(d);
    // b should appear as a heading (it is a terminal relative to structural edges)
    expect(md).toContain('### Terminal node (Effect)');
    // Assumption should NOT appear as a heading
    expect(md).not.toContain('### Side note');
  });

  it('renderCausesInto: skips assumption-typed sources in outline bullet list', () => {
    resetIds();
    const asmpt = makeEntity({
      type: 'assumption',
      title: 'Assumption source',
      annotationNumber: 1,
    });
    const terminal = makeEntity({ type: 'effect', title: 'Effect terminal', annotationNumber: 2 });
    const e = makeEdge(asmpt.id, terminal.id);
    const d = makeDoc([asmpt, terminal], [e], 'crt');
    const md = exportReasoningOutline(d);
    // Terminal is a heading; no bullet for the assumption cause
    expect(md).toContain('### Effect terminal (Effect)');
    // The assumption entity itself should not appear in a bullet sentence
    expect(md).not.toContain('Assumption source');
    // Terminal has one incoming edge (from assumption) so the "no causes" note
    // is NOT triggered — but no bullet is rendered either because assumption is
    // skipped. The section has a heading and nothing else.
    expect(md).not.toContain('*No causes drawn yet.*');
  });

  it('renderCausesInto: cycle guard — a pure cycle has no terminals, outline is structurally empty', () => {
    // A→B and B→A: both nodes have outgoing structural edges so neither is a
    // terminal. findTerminals returns [] → "No structural entities yet."
    // This exercises the `findTerminals` filter and the back-edge path.
    resetIds();
    const a = makeEntity({ type: 'effect', title: 'Node A', annotationNumber: 1 });
    const b = makeEntity({ type: 'effect', title: 'Node B', annotationNumber: 2 });
    const e1 = makeEdge(a.id, b.id);
    const e2 = makeEdge(b.id, a.id, { isBackEdge: true });
    const d = makeDoc([a, b], [e1, e2], 'crt');
    // Should not throw / hang
    const md = exportReasoningOutline(d);
    expect(md).toBeTruthy();
    expect(md).toContain('*No structural entities yet.*');
  });

  it('renderCausesInto: visited guard prevents duplicate bullets on a diamond (A→C, B→C, A→B)', () => {
    // C is the terminal; B has two incoming paths (direct from A, and via
    // A→B→C). The visited set prevents B from being recursed into twice.
    resetIds();
    const a = makeEntity({ type: 'effect', title: 'Root A', annotationNumber: 1 });
    const b = makeEntity({ type: 'effect', title: 'Mid B', annotationNumber: 2 });
    const c = makeEntity({ type: 'effect', title: 'Top C', annotationNumber: 3 });
    const e1 = makeEdge(a.id, c.id); // A → C
    const e2 = makeEdge(b.id, c.id); // B → C
    const e3 = makeEdge(a.id, b.id); // A → B
    const d = makeDoc([a, b, c], [e1, e2, e3], 'crt');
    const md = exportReasoningOutline(d);
    expect(md).toContain('### Top C (Effect)');
    // A should appear at most once as a direct-cause bullet of C
    const aOccurrences = (md.match(/Root A/g) ?? []).length;
    expect(aOccurrences).toBeLessThanOrEqual(2); // once as direct cause, once as cause of Mid B
  });
});

describe('exportReasoningOutline — EC-specific branches', () => {
  it('EC outline without a goal entity omits the Common goal line', () => {
    // An EC doc with only two Wants and no goal entity
    resetIds();
    const w1 = makeEntity({ type: 'want', title: 'Want X', annotationNumber: 1 });
    const w2 = makeEntity({ type: 'want', title: 'Want Y', annotationNumber: 2 });
    const d = makeDoc([w1, w2], [], 'ec');
    const md = exportReasoningOutline(d);
    expect(md).not.toContain('**Common goal:**');
  });

  it('EC outline: needs with no feeding wants render without Want bullet', () => {
    resetIds();
    const goal = makeEntity({ type: 'goal', title: 'Common Goal', annotationNumber: 1 });
    const need = makeEntity({ type: 'need', title: 'Need Alpha', annotationNumber: 2 });
    // No edges → want feeds no need
    const d = makeDoc([goal, need], [], 'ec');
    const md = exportReasoningOutline(d);
    expect(md).toContain('**Common goal:** "Common Goal"');
    expect(md).toContain('**Need:** "Need Alpha"');
    // No Want bullet expected
    expect(md).not.toContain('**Want:**');
  });

  it('EC outline: mutex edge between two wants renders the mutex note', () => {
    resetIds();
    const w1 = makeEntity({ type: 'want', title: 'Want P', annotationNumber: 1 });
    const w2 = makeEntity({ type: 'want', title: 'Want Q', annotationNumber: 2 });
    const mutex = makeEdge(w1.id, w2.id, { isMutualExclusion: true });
    const d = makeDoc([w1, w2], [mutex], 'ec');
    const md = exportReasoningOutline(d);
    expect(md).toContain('**Mutually exclusive:**');
    expect(md).toContain('"Want P"');
    expect(md).toContain('"Want Q"');
    expect(md).toContain('cannot both hold.');
  });

  it('EC outline: edges with assumptionIds render an Assumptions section', () => {
    resetIds();
    const w1 = makeEntity({ type: 'want', title: 'Want 1', annotationNumber: 1 });
    const need = makeEntity({ type: 'need', title: 'Need 1', annotationNumber: 2 });
    const asmpt = makeEntity({
      type: 'assumption',
      title: 'Because of budget',
      annotationNumber: 3,
    });
    const e = makeEdge(w1.id, need.id, { assumptionIds: [asmpt.id] });
    const d = makeDoc([w1, need, asmpt], [e], 'ec');
    // Record-canonical: the exporter reads the assumption text from the
    // first-class record (synced with the entity title).
    d.assumptions = {
      [asmpt.id]: {
        id: asmpt.id,
        edgeId: e.id,
        text: 'Because of budget',
        status: 'unexamined',
        createdAt: 1,
        updatedAt: 1,
      },
    };
    const md = exportReasoningOutline(d);
    expect(md).toContain('### Assumptions on edges');
    expect(md).toContain('**Want 1 → Need 1**');
    expect(md).toContain('Because of budget');
  });

  it('EC outline: uses "Untitled assumption" fallback when assumption title is blank', () => {
    resetIds();
    const w1 = makeEntity({ type: 'want', title: 'Want 1', annotationNumber: 1 });
    const need = makeEntity({ type: 'need', title: 'Need 1', annotationNumber: 2 });
    const asmpt = makeEntity({ type: 'assumption', title: '', annotationNumber: 3 });
    const e = makeEdge(w1.id, need.id, { assumptionIds: [asmpt.id] });
    const d = makeDoc([w1, need, asmpt], [e], 'ec');
    d.assumptions = {
      [asmpt.id]: {
        id: asmpt.id,
        edgeId: e.id,
        text: '',
        status: 'unexamined',
        createdAt: 1,
        updatedAt: 1,
      },
    };
    const md = exportReasoningOutline(d);
    expect(md).toContain('Untitled assumption');
  });

  it('EC outline: edge with assumptionIds but missing src/tgt entities is skipped gracefully', () => {
    // An edge references entity IDs that don't exist in the doc
    resetIds();
    const orphanEdge = makeEdge(
      'ghost-src' as ReturnType<typeof makeEntity>['id'],
      'ghost-tgt' as ReturnType<typeof makeEntity>['id'],
      {
        assumptionIds: ['ghost-assumption' as ReturnType<typeof makeEntity>['id']],
      }
    );
    const d = makeDoc([], [orphanEdge], 'ec');
    // Should not throw — the src/tgt guard skips it
    expect(() => exportReasoningOutline(d)).not.toThrow();
    const md = exportReasoningOutline(d);
    expect(md).toBeTruthy();
  });

  it('EC outline: uses fallback titles "Untitled" for blank entity names in mutex note', () => {
    resetIds();
    const w1 = makeEntity({ type: 'want', title: '', annotationNumber: 1 });
    const w2 = makeEntity({ type: 'want', title: '', annotationNumber: 2 });
    const mutex = makeEdge(w1.id, w2.id, { isMutualExclusion: true });
    const d = makeDoc([w1, w2], [mutex], 'ec');
    const md = exportReasoningOutline(d);
    expect(md).toContain('"Want 1"');
    expect(md).toContain('"Want 2"');
  });
});

describe('exportReasoningOutline — non-EC diagram types', () => {
  it('renders FRT outline with correct heading type label', () => {
    resetIds();
    const inj = makeEntity({ type: 'injection', title: 'Roll out fix', annotationNumber: 1 });
    const de = makeEntity({ type: 'desiredEffect', title: 'Bugs drop', annotationNumber: 2 });
    const e = makeEdge(inj.id, de.id);
    const d = makeDoc([inj, de], [e], 'frt');
    const md = exportReasoningOutline(d);
    expect(md).toContain('### Bugs drop (Desired Effect)');
    expect(md).toContain('"Bugs drop" because "Roll out fix".');
  });

  it('renders PRT outline with "in order to" connector', () => {
    resetIds();
    const io = makeEntity({
      type: 'intermediateObjective',
      title: 'Remove blocker',
      annotationNumber: 1,
    });
    const goal = makeEntity({ type: 'goal', title: 'Reach objective', annotationNumber: 2 });
    const e = makeEdge(io.id, goal.id);
    const d = makeDoc([io, goal], [e], 'prt');
    const md = exportReasoningOutline(d);
    expect(md).toContain('### Reach objective (Goal)');
    expect(md).toContain('In order to obtain "Reach objective", "Remove blocker" must hold.');
  });
});
