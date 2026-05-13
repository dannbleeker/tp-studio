import type { AnyTPNode, TPEdge, TPNode } from '@/components/canvas/flow-types';
import type { ReactFlowInstance } from '@xyflow/react';

// The active React Flow instance, parameterized with our concrete node and
// edge types. Set on RF onInit, cleared on canvas unmount. Lets command-palette
// actions and exporters reach into the live canvas from outside React.
type TPFlow = ReactFlowInstance<AnyTPNode, TPEdge>;

let cached: TPFlow | null = null;

export const setCanvasInstance = (instance: TPFlow | null): void => {
  cached = instance;
};

export const getCanvasInstance = (): TPFlow | null => cached;

/** Returns only entity (`tp`) nodes — group nodes are filtered out. */
export const getCanvasNodes = (): TPNode[] =>
  (cached?.getNodes() ?? []).filter((n): n is TPNode => n.type === 'tp');

export const getSelectedEdges = (): TPEdge[] =>
  cached?.getEdges().filter((e) => e.selected === true) ?? [];
