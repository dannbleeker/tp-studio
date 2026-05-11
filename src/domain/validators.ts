import type {
  ClrRuleId,
  Edge,
  Entity,
  EntityType,
  TPDocument,
  Warning,
  WarningTarget,
} from './types';

const warningId = (ruleId: ClrRuleId, target: WarningTarget): string =>
  `${ruleId}:${target.kind}:${target.id}`;

const makeWarning = (
  doc: TPDocument,
  ruleId: ClrRuleId,
  target: WarningTarget,
  message: string
): Warning => {
  const id = warningId(ruleId, target);
  return {
    id,
    ruleId,
    message,
    target,
    resolved: doc.resolvedWarnings[id] === true,
  };
};

const countWords = (s: string): number => {
  const trimmed = s.trim();
  if (trimmed === '') return 0;
  return trimmed.split(/\s+/).length;
};

const incomingEdges = (doc: TPDocument, entityId: string): Edge[] =>
  Object.values(doc.edges).filter((e) => e.targetId === entityId);

const outgoingEdges = (doc: TPDocument, entityId: string): Edge[] =>
  Object.values(doc.edges).filter((e) => e.sourceId === entityId);

const isAssumption = (entity: Entity): boolean => entity.type === 'assumption';

const structuralEntities = (doc: TPDocument): Entity[] =>
  Object.values(doc.entities).filter((e) => !isAssumption(e));

const levenshtein = (a: string, b: string): number => {
  const al = a.length;
  const bl = b.length;
  if (al === 0) return bl;
  if (bl === 0) return al;
  const prev: number[] = new Array(bl + 1);
  const curr: number[] = new Array(bl + 1);
  for (let j = 0; j <= bl; j++) prev[j] = j;
  for (let i = 1; i <= al; i++) {
    curr[0] = i;
    for (let j = 1; j <= bl; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(curr[j - 1] + 1, prev[j] + 1, prev[j - 1] + cost);
    }
    for (let j = 0; j <= bl; j++) prev[j] = curr[j];
  }
  return prev[bl];
};

const similarity = (a: string, b: string): number => {
  const max = Math.max(a.length, b.length);
  if (max === 0) return 1;
  return 1 - levenshtein(a.toLowerCase(), b.toLowerCase()) / max;
};

const SIMILARITY_THRESHOLD = 0.85;
const CLARITY_WORD_LIMIT = 25;
const DISCONNECTED_GRAPH_FLOOR = 3;

const clarityRule = (doc: TPDocument): Warning[] => {
  const out: Warning[] = [];
  for (const e of Object.values(doc.entities)) {
    if (countWords(e.title) > CLARITY_WORD_LIMIT) {
      out.push(
        makeWarning(
          doc,
          'clarity',
          { kind: 'entity', id: e.id },
          'Title is over 25 words — tighten to one statement.'
        )
      );
    } else if (e.title.trim().endsWith('?')) {
      out.push(
        makeWarning(
          doc,
          'clarity',
          { kind: 'entity', id: e.id },
          'Statements should be declarative, not questions.'
        )
      );
    }
  }
  return out;
};

const entityExistenceRule = (doc: TPDocument): Warning[] => {
  const out: Warning[] = [];
  const entities = Object.values(doc.entities);
  const total = entities.length;
  for (const e of entities) {
    if (e.title.trim() === '') {
      out.push(
        makeWarning(doc, 'entity-existence', { kind: 'entity', id: e.id }, 'Entity has no title.')
      );
      continue;
    }
    if (total > DISCONNECTED_GRAPH_FLOOR && !isAssumption(e)) {
      const incoming = incomingEdges(doc, e.id).length;
      const outgoing = outgoingEdges(doc, e.id).length;
      if (incoming + outgoing === 0) {
        out.push(
          makeWarning(
            doc,
            'entity-existence',
            { kind: 'entity', id: e.id },
            'Entity is disconnected from the graph.'
          )
        );
      }
    }
  }
  return out;
};

const causalityExistenceRule = (doc: TPDocument): Warning[] =>
  Object.values(doc.edges).map((edge) =>
    makeWarning(
      doc,
      'causality-existence',
      { kind: 'edge', id: edge.id },
      'Does the cause inevitably produce the effect?'
    )
  );

const causeSufficiencyRule = (doc: TPDocument): Warning[] => {
  const out: Warning[] = [];
  for (const e of structuralEntities(doc)) {
    const incoming = incomingEdges(doc, e.id);
    if (incoming.length === 1) {
      const single = incoming[0];
      if (!single.andGroupId) {
        out.push(
          makeWarning(
            doc,
            'cause-sufficiency',
            { kind: 'edge', id: single.id },
            'Is this cause alone enough? Consider grouping with another as an AND.'
          )
        );
      }
    }
  }
  return out;
};

const additionalCauseRule = (doc: TPDocument): Warning[] => {
  const out: Warning[] = [];
  const terminalType: EntityType = doc.diagramType === 'crt' ? 'ude' : 'desiredEffect';
  for (const e of Object.values(doc.entities)) {
    if (e.type === terminalType && incomingEdges(doc, e.id).length === 0) {
      out.push(
        makeWarning(
          doc,
          'additional-cause',
          { kind: 'entity', id: e.id },
          'No causes captured. Are there causes you haven’t added?'
        )
      );
    }
  }
  return out;
};

const causeEffectReversalRule = (doc: TPDocument): Warning[] => {
  if (doc.diagramType !== 'crt') return [];
  const out: Warning[] = [];
  for (const e of Object.values(doc.entities)) {
    if (e.type === 'rootCause' && incomingEdges(doc, e.id).length > 0) {
      out.push(
        makeWarning(
          doc,
          'cause-effect-reversal',
          { kind: 'entity', id: e.id },
          'A Root Cause should not have incoming causes — possible cause/effect reversal.'
        )
      );
    }
    if (e.type === 'ude' && outgoingEdges(doc, e.id).length > 0) {
      out.push(
        makeWarning(
          doc,
          'cause-effect-reversal',
          { kind: 'entity', id: e.id },
          'A UDE should not have outgoing effects — possible cause/effect reversal.'
        )
      );
    }
  }
  return out;
};

const predictedEffectExistenceRule = (doc: TPDocument): Warning[] => {
  if (doc.diagramType !== 'frt') return [];
  const out: Warning[] = [];
  for (const e of Object.values(doc.entities)) {
    if (e.type === 'injection' && outgoingEdges(doc, e.id).length === 0) {
      out.push(
        makeWarning(
          doc,
          'predicted-effect-existence',
          { kind: 'entity', id: e.id },
          'If this injection holds, what other effects follow? None captured yet.'
        )
      );
    }
  }
  return out;
};

const tautologyRule = (doc: TPDocument): Warning[] => {
  const out: Warning[] = [];
  for (const e of structuralEntities(doc)) {
    const outgoing = outgoingEdges(doc, e.id);
    if (outgoing.length !== 1) continue;
    const child = doc.entities[outgoing[0].targetId];
    if (!child) continue;
    if (similarity(e.title, child.title) >= SIMILARITY_THRESHOLD) {
      out.push(
        makeWarning(
          doc,
          'tautology',
          { kind: 'entity', id: e.id },
          'This statement is nearly identical to its effect — possible tautology.'
        )
      );
    }
  }
  return out;
};

export const RULES: ReadonlyArray<(doc: TPDocument) => Warning[]> = [
  clarityRule,
  entityExistenceRule,
  causalityExistenceRule,
  causeSufficiencyRule,
  additionalCauseRule,
  causeEffectReversalRule,
  predictedEffectExistenceRule,
  tautologyRule,
];

export const validate = (doc: TPDocument): Warning[] => RULES.flatMap((rule) => rule(doc));
