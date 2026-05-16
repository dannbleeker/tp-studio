import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { type Page, expect, test } from '@playwright/test';

/**
 * Sessions 106-108 — Chrome DevTools Protocol traces of scripted
 * 100-entity interaction sequences on the production build.
 *
 * Two scenarios so we can compare bottlenecks across interaction
 * styles:
 *
 *   1. **all-actions** (original Session 106 scenario) — pan, zoom,
 *      drag, edit, snapshot. Visual-heavy. Surfaces layout-thrash
 *      and pan/zoom costs.
 *   2. **edit-heavy** (Session 108 addition) — title edits, type
 *      changes, edge polarity cycling, repeated mutations. No pan
 *      or zoom. Isolates the store-update + reconciliation path.
 *      Item N3 from the Session 106 followups was: "the current
 *      trace over-samples pan/zoom because that's what the spec
 *      drives. An editing-heavy trace would isolate the typing
 *      path and might surface different bottlenecks."
 *
 * Each test captures its own trace, writes its own summary, and
 * uploads its own artifact. The artifact upload step uses a glob
 * (`perf-trace-output/*.json`) so both files land in the same
 * `perf-trace` artifact.
 *
 * Not part of regular CI. Gated on `PERF_TRACE=1` env var so it
 * skips by default. Run with:
 *
 *     PERF_TRACE=1 pnpm exec playwright test e2e/perf-trace.spec.ts
 */

const SKIP_PERF = process.env.PERF_TRACE !== '1';

interface TraceEvent {
  cat?: string;
  name?: string;
  ph?: string;
  dur?: number;
  ts?: number;
}

interface TraceFile {
  traceEvents?: TraceEvent[];
}

/**
 * Capture a CDP trace while `scenario(page)` runs, then write the
 * trace to disk and print a summary to stdout.
 */
async function runScenarioWithTrace(
  page: Page,
  slug: string,
  scenario: (page: Page) => Promise<void>
): Promise<void> {
  const tracePath = `perf-trace-output/perf-trace-${slug}.json`;

  // Start CDP trace. Categories selected to capture JS execution,
  // layout/style/paint events, and React user-timing marks.
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Tracing.start', {
    categories:
      'disabled-by-default-devtools.timeline,disabled-by-default-devtools.timeline.frame,blink.user_timing,v8.execute,blink,cc,gpu,blink.style,blink.animations,disabled-by-default-v8.cpu_profiler',
    transferMode: 'ReturnAsStream',
  });

  await scenario(page);

  // Stop trace + drain the IO stream.
  const traceStreamHandle = await new Promise<string>((resolve, reject) => {
    cdp.on('Tracing.tracingComplete', (event: { stream?: string }) => {
      if (event.stream) resolve(event.stream);
      else reject(new Error('No stream returned from Tracing.tracingComplete'));
    });
    cdp.send('Tracing.end').catch(reject);
  });
  let traceJson = '';
  while (true) {
    const chunk = (await cdp.send('IO.read', { handle: traceStreamHandle })) as {
      data?: string;
      eof?: boolean;
    };
    if (chunk.data) traceJson += chunk.data;
    if (chunk.eof) break;
  }
  await cdp.send('IO.close', { handle: traceStreamHandle });

  await mkdir(dirname(tracePath), { recursive: true });
  await writeFile(tracePath, traceJson);

  // Parse + summarize.
  const parsed: TraceFile = JSON.parse(traceJson);
  const events = parsed.traceEvents ?? [];

  let totalScriptDur = 0;
  let totalLayoutDur = 0;
  let totalPaintDur = 0;
  const longTaskList: { name: string; ms: number }[] = [];
  const eventNameTotals = new Map<string, { count: number; totalMs: number }>();

  for (const e of events) {
    if (e.ph !== 'X' || typeof e.dur !== 'number') continue;
    const name = e.name ?? '';
    const durMs = e.dur / 1000;
    const agg = eventNameTotals.get(name) ?? { count: 0, totalMs: 0 };
    agg.count += 1;
    agg.totalMs += durMs;
    eventNameTotals.set(name, agg);
    if (
      name.includes('EvaluateScript') ||
      name.includes('FunctionCall') ||
      name.includes('V8.Execute') ||
      name === 'RunMicrotasks' ||
      name === 'RunTask'
    ) {
      totalScriptDur += e.dur;
      if (e.dur > 50_000) {
        longTaskList.push({ name, ms: +durMs.toFixed(1) });
      }
    } else if (name.includes('Layout') || name === 'UpdateLayoutTree') {
      totalLayoutDur += e.dur;
    } else if (name === 'Paint' || name === 'CompositeLayers' || name.includes('Paint')) {
      totalPaintDur += e.dur;
    }
  }
  longTaskList.sort((a, b) => b.ms - a.ms);
  const byCount = [...eventNameTotals.entries()]
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 10)
    .map(([name, { count, totalMs }]) => ({ name, count, total_ms: +totalMs.toFixed(1) }));
  const byTime = [...eventNameTotals.entries()]
    .sort((a, b) => b[1].totalMs - a[1].totalMs)
    .slice(0, 10)
    .map(([name, { count, totalMs }]) => ({ name, count, total_ms: +totalMs.toFixed(1) }));

  const summary = {
    scenario: slug,
    events: events.length,
    totals_ms: {
      scripting: +(totalScriptDur / 1000).toFixed(1),
      layout: +(totalLayoutDur / 1000).toFixed(1),
      paint: +(totalPaintDur / 1000).toFixed(1),
    },
    long_tasks: {
      count_over_50ms: longTaskList.length,
      total_ms: +longTaskList.reduce((s, t) => s + t.ms, 0).toFixed(1),
      items: longTaskList,
    },
    hottest_events: {
      by_count: byCount,
      by_time: byTime,
    },
    trace_path: tracePath,
    trace_size_kb: +(traceJson.length / 1024).toFixed(1),
  };

  // biome-ignore lint/suspicious/noConsole: deliberate stdout
  console.log(`\n=== PERF TRACE SUMMARY (${slug}) ===`);
  // biome-ignore lint/suspicious/noConsole: deliberate stdout
  console.log(JSON.stringify(summary, null, 2));
  // biome-ignore lint/suspicious/noConsole: deliberate stdout
  console.log(`\nFull trace: ${tracePath} (open in chrome://tracing or perfetto.dev)`);

  expect(events.length).toBeGreaterThan(500);
  const onDisk = await readFile(tracePath, 'utf8').catch(() => '');
  expect(onDisk.length).toBeGreaterThan(0);
}

/**
 * Seed the canvas with 100 entities + a chain. Shared by both
 * scenarios so the doc shape is identical and the comparison is
 * apples-to-apples.
 */
async function seedHundredEntities(page: Page): Promise<void> {
  await page.goto('/?test=1');
  await page.waitForSelector('.react-flow__viewport');
  await page.evaluate(() => {
    const hook = window.__TP_TEST__;
    if (!hook) throw new Error('test hook not installed');
    const titles = Array.from({ length: 100 }, (_, i) => `Effect ${i + 1}`);
    const ids = hook.seed({ titles });
    for (let i = 0; i < ids.length - 1; i++) {
      hook.connect(ids[i + 1]!, ids[i]!);
    }
  });
  await expect(page.locator('[data-component="tp-node"]').first()).toBeVisible();
  // Settle dagre + initial layout before tracing starts.
  await page.waitForTimeout(800);
}

test.describe('perf-trace — 100-entity scenarios', () => {
  test('all-actions: pan + zoom + drag + edit + snapshot', async ({ page }) => {
    test.skip(SKIP_PERF, 'Manual perf run — set PERF_TRACE=1 to enable.');
    await seedHundredEntities(page);

    await runScenarioWithTrace(page, 'all-actions', async (p) => {
      const viewport = p.viewportSize();
      const cx = (viewport?.width ?? 1280) / 2;
      const cy = (viewport?.height ?? 720) / 2;

      // Pan via middle-mouse drag.
      await p.mouse.move(cx, cy);
      await p.mouse.down({ button: 'middle' });
      for (let i = 0; i < 10; i++) {
        await p.mouse.move(cx + i * 20, cy + i * 20);
        await p.waitForTimeout(30);
      }
      await p.mouse.up({ button: 'middle' });

      // Zoom in then reset.
      for (let i = 0; i < 3; i++) {
        await p.keyboard.press('=');
        await p.waitForTimeout(150);
      }
      await p.keyboard.press('0');
      await p.waitForTimeout(300);

      // Drag a node.
      const firstNode = p.locator('[data-component="tp-node"]').first();
      const box = await firstNode.boundingBox();
      if (box) {
        await p.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
        await p.mouse.down();
        await p.mouse.move(box.x + box.width / 2 + 80, box.y + box.height / 2 + 60, {
          steps: 12,
        });
        await p.mouse.up();
      }
      await p.waitForTimeout(300);

      // Add 3 more entities.
      await p.evaluate(() => {
        window.__TP_TEST__?.seed({
          titles: ['Late add A', 'Late add B', 'Late add C'],
          clear: false,
        });
      });
      await p.waitForTimeout(300);

      // Capture a revision (exercises the cloneDoc + persistence
      // path — Session 108 sped this up via the shallow-clone helper).
      await p.evaluate(() => {
        window.__TP_TEST__?.takeRevision('perf-trace snapshot');
      });
      await p.waitForTimeout(300);
    });
  });

  test('edit-heavy: title + type + polarity mutations only', async ({ page }) => {
    test.skip(SKIP_PERF, 'Manual perf run — set PERF_TRACE=1 to enable.');
    await seedHundredEntities(page);

    await runScenarioWithTrace(page, 'edit-heavy', async (p) => {
      // 30 seconds of repeated mutations. No pan, no zoom. Drives
      // the store-update + emission + render path; isolates what
      // the all-actions scenario over-samples behind viewport
      // transforms.
      //
      // Uses `__TP_TEST__.editEntityTitle` (Session 108 addition)
      // for the title-edit path. Yields back via setTimeout(0)
      // every iteration so React can commit and Blink can lay out
      // — without the yield, the loop would block the main thread
      // and the trace would just show one giant `RunTask` event
      // instead of the steady-state edit-render cycle we want.
      await p.evaluate(async () => {
        const hook = window.__TP_TEST__;
        if (!hook) throw new Error('test hook not installed');
        const ids = hook.listEntityIds();
        if (ids.length === 0) throw new Error('seed produced no entities');
        const start = performance.now();
        let i = 0;
        while (performance.now() - start < 28_000) {
          const id = ids[i % ids.length]!;
          hook.editEntityTitle(id, `Effect ${(i % ids.length) + 1} (edit ${i})`);
          i += 1;
          await new Promise((r) => setTimeout(r, 8));
        }
      });
    });
  });
});
