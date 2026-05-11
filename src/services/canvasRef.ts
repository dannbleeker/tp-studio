import type { Node, ReactFlowInstance } from '@xyflow/react';

// Stored as the most permissive instance type — concrete instances narrow at the call site.
// biome-ignore lint/suspicious/noExplicitAny: tracking a single shared instance across node-data types
type AnyFlow = ReactFlowInstance<any, any>;

let cached: AnyFlow | null = null;

export const setCanvasInstance = (instance: AnyFlow | null): void => {
  cached = instance;
};

export const getCanvasInstance = (): AnyFlow | null => cached;

export const getCanvasNodes = (): Node[] => {
  if (!cached) return [];
  return cached.getNodes() as Node[];
};
