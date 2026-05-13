/**
 * Public surface for the exporters module. The per-format split mirrors the
 * commands/, flyingLogic/, validators/ patterns — each file owns one
 * coherent format family (text, image, Flying Logic XML), with shared
 * helpers (`slug`, trigger-download primitives) in `shared.ts`.
 *
 * Adding a new export format: pick the right file (or create a new one if
 * the family is new), implement the function, re-export here. Consumers
 * still import from `@/services/exporters` and pick up the new symbol.
 */

export { exportFlyingLogic, pickFlyingLogic } from './flyingLogic';
export { exportJPEG, exportPNG, exportSVG } from './image';
export {
  exportDOT,
  exportMermaid,
  exportOPML,
  exportReasoningNarrativeMd,
  exportReasoningOutlineMd,
  exportVGL,
  pickMermaid,
} from './markup';
export { slug } from './shared';
export {
  exportAnnotationsMd,
  exportAnnotationsTxt,
  exportCSV,
  exportJSON,
  pickJSON,
} from './text';
