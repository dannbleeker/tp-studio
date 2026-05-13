import type { DiagramType, TPDocument } from '../types';
import { buildExampleCRT } from './crt';
import { buildExampleEC } from './ec';
import { buildExampleFreeform } from './freeform';
import { buildExampleFRT } from './frt';
import { buildExamplePRT } from './prt';
import { buildExampleST } from './st';
import { buildExampleTT } from './tt';

/**
 * Example-document builder per diagram type. Drives the "Load example …"
 * entries in the command palette and lets future diagram types opt in with
 * a single map entry. The `Record<DiagramType, _>` shape makes a missing
 * builder a compile error — adding a new diagram type that forgets to
 * register an example fails at type-check time.
 *
 * The monolithic `examples.ts` (281 lines) split into one file per diagram
 * type plus a small `shared.ts` for the `buildEntity` / `buildEdge`
 * helpers (Session 39, #3 from the next-batch top-10). Pattern mirrors the
 * commands/, validators/, exporters/, and flyingLogic/ splits that
 * preceded it.
 */
export const EXAMPLE_BY_DIAGRAM: Record<DiagramType, () => TPDocument> = {
  crt: buildExampleCRT,
  frt: buildExampleFRT,
  prt: buildExamplePRT,
  tt: buildExampleTT,
  ec: buildExampleEC,
  st: buildExampleST,
  freeform: buildExampleFreeform,
};
