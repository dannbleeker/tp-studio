import type { TPEdge, TPNode } from '@/components/canvas/flow-types';
import type { ReactFlowInstance } from '@xyflow/react';

// The active React Flow instance, parameterized with our concrete node and
// edge types. Set on RF onInit, cleared on canvas unmount. Lets command-palette
// actions and exporters reach into the live canvas from outside React.
type TPFlow = ReactFlowInstance<TPNode, TPEdge>;

let cached: TPFlow | null = null;

export const setCanvasInstance = (instance: TPFlow | null): void => {
  cached = instance;
};

export const getCanvasInstance = (): TPFlow | null => cached;

export const getCanvasNodes = (): TPNode[] => cached?.getNodes() ?? [];

export const getSelectedEdges = (): TPEdge[] =>
  cached?.getEdges().filter((e) => e.selected === true) ?? [];
