/// <reference types="vite/client" />

// Session 84 (optimization pass) — type the Playwright test hook on
// `window` so `src/services/testHook.ts` doesn't need an `as any`
// cast when installing it. The runtime install is guarded by `?test=1`
// (production users never see the property); the type is `optional` so
// every read site still has to narrow before use.
//
// The matching declaration in `e2e/global.d.ts` mirrors this shape for
// the Playwright test suite's TypeScript pass — both files agree on
// the contract so the test-side reads and the src-side write don't
// drift apart.
import type { TpTestHook } from '@/services/testHook';

declare global {
  interface Window {
    __TP_TEST__?: TpTestHook;
  }
}

// Required so TypeScript treats this file as a module (which `declare
// global` augmentation requires). `vite/client` reference + the
// re-export below give the file module status.
export {};
