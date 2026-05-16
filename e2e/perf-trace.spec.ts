import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { expect, test } from '@playwright/test';

/**
 * Session 106 — Chrome DevTools Protocol trace of a 100-entity
 * interaction sequence on the production build.
 *
 * Captures a real-world performance trace via Playwright's CDP
 * session. The trace is saved to `playwright-report/perf-trace.json`
 * (open in `chrome://tracing` or `perfetto.dev` for the full flame
 * chart) and a headline summary is printed to stdout for at-a-glance
 * numbers without a viewer.
 *
 * Not part of regular CI. Gated on `PERF_TRACE=1` env var so it
 * skips by default. Run with:
 *
 *     PERF_TRACE=1 pnpm exec playwright test e2e/perf-trace.spec.ts
 *
 * The scripted scenario:
 *   1. Seed a 100-entity CRT-ish doc via the existing `__TP_TEST__`
 *      hook.
 *   2. Pan and zoom the viewport.
 *   3. Drag a node.
 *   4. Edit an entity title.
 *   5. Add a new entity.
 *   6. Capture a revision.
 *
 * That's a representative slice of "what a user does in 30 seconds
 * on a real diagram." The trace lets us see, *categorically*, where
 * total time goes — JS, layout, paint — and surface long tasks
 * (>50ms) which are the main-thread jank moments.
 */

// Session 106 — written to `perf-trace-output/`, NOT
// `playwright-report/`. The HTML reporter wipes its own directory at
// the start of each run, deleting anything else we'd written there.
// `perf-trace-output/` is gitignored and uploaded as a workflow
// artifact.
const TRACE_PATH = 'perf-trace-output/perf-trace.json';
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

test.describe('perf-trace — 100-entity interaction', () => {
  test('captures a CDP trace + prints summary', async ({ page }) => {
    test.skip(SKIP_PERF, 'Manual perf run — set PERF_TRACE=1 to enable.');

    await page.goto('/?test=1');
    await page.waitForSelector('.react-flow__viewport');

    // Seed 100 entities + chain edges.
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

    // Start CDP trace. Categories selected to capture JS execution,
    // layout/style/paint events, and React user-timing marks. The
    // default trace categories were too verbose; this subset gives
    // useful flame-chart data without bloating the file.
    const cdp = await page.context().newCDPSession(page);
    await cdp.send('Tracing.start', {
      categories:
        'disabled-by-default-devtools.timeline,disabled-by-default-devtools.timeline.frame,blink.user_timing,v8.execute,blink,cc,gpu,blink.style,blink.animations,disabled-by-default-v8.cpu_profiler',
      transferMode: 'ReturnAsStream',
    });

    // ── The scripted scenario ───────────────────────────────────────
    const viewport = page.viewportSize();
    const cx = (viewport?.width ?? 1280) / 2;
    const cy = (viewport?.height ?? 720) / 2;

    // Pan
    await page.mouse.move(cx, cy);
    await page.mouse.down({ button: 'middle' });
    for (let i = 0; i < 10; i++) {
      await page.mouse.move(cx + i * 20, cy + i * 20);
      await page.waitForTimeout(30);
    }
    await page.mouse.up({ button: 'middle' });

    // Zoom in via keyboard (`+` is bound)
    for (let i = 0; i < 3; i++) {
      await page.keyboard.press('=');
      await page.waitForTimeout(150);
    }
    // Reset to fit
    await page.keyboard.press('0');
    await page.waitForTimeout(300);

    // Drag a node
    const firstNode = page.locator('[data-component="tp-node"]').first();
    const box = await firstNode.boundingBox();
    if (box) {
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
      await page.mouse.down();
      await page.mouse.move(box.x + box.width / 2 + 80, box.y + box.height / 2 + 60, {
        steps: 12,
      });
      await page.mouse.up();
    }
    await page.waitForTimeout(300);

    // Edit a title via test hook (faster + deterministic than the
    // double-click + type gesture; we're measuring the store ->
    // render path, not the keystroke handling).
    await page.evaluate(() => {
      const hook = window.__TP_TEST__;
      if (!hook) throw new Error('test hook not installed');
      // Add 5 entities in a tight loop — exercises the immutable-
      // update path plus persistence debouncing.
      hook.seed({ titles: ['Late add A', 'Late add B', 'Late add C'], clear: false });
    });
    await page.waitForTimeout(300);

    // Capture a revision.
    await page.evaluate(() => {
      const hook = window.__TP_TEST__;
      if (!hook) throw new Error('test hook not installed');
      hook.takeRevision('perf-trace snapshot');
    });
    await page.waitForTimeout(300);

    // ── Stop the trace ──────────────────────────────────────────────
    const traceStreamHandle = await new Promise<string>((resolve, reject) => {
      cdp.on('Tracing.tracingComplete', (event: { stream?: string }) => {
        if (event.stream) resolve(event.stream);
        else reject(new Error('No stream returned from Tracing.tracingComplete'));
      });
      cdp.send('Tracing.end').catch(reject);
    });

    // Drain the stream. Tracing.tracingComplete returns a handle to
    // an IO stream that we read in chunks until EOF.
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

    await mkdir(dirname(TRACE_PATH), { recursive: true });
    await writeFile(TRACE_PATH, traceJson);

    // ── Parse + summarize ───────────────────────────────────────────
    const parsed: TraceFile = JSON.parse(traceJson);
    const events = parsed.traceEvents ?? [];

    let totalScriptDur = 0;
    let totalLayoutDur = 0;
    let totalPaintDur = 0;
    let longTaskCount = 0;
    let longTaskTotalDur = 0;
    const seenCategories = new Set<string>();

    for (const e of events) {
      if (e.cat) {
        for (const c of e.cat.split(',')) seenCategories.add(c);
      }
      if (e.ph !== 'X' || typeof e.dur !== 'number') continue;
      const name = e.name ?? '';
      // Heuristic categorization — Chrome's trace categories don't
      // map 1:1 to "scripting/layout/paint" the way the
      // Performance panel labels them, but the event NAME is
      // standard.
      if (
        name.includes('EvaluateScript') ||
        name.includes('FunctionCall') ||
        name.includes('V8.Execute') ||
        name === 'RunMicrotasks' ||
        name === 'RunTask'
      ) {
        totalScriptDur += e.dur;
        if (e.dur > 50_000) {
          longTaskCount += 1;
          longTaskTotalDur += e.dur;
        }
      } else if (name.includes('Layout') || name === 'UpdateLayoutTree') {
        totalLayoutDur += e.dur;
      } else if (name === 'Paint' || name === 'CompositeLayers' || name.includes('Paint')) {
        totalPaintDur += e.dur;
      }
    }

    const summary = {
      events: events.length,
      categories: [...seenCategories].sort(),
      totals_ms: {
        scripting: +(totalScriptDur / 1000).toFixed(1),
        layout: +(totalLayoutDur / 1000).toFixed(1),
        paint: +(totalPaintDur / 1000).toFixed(1),
      },
      long_tasks: {
        count_over_50ms: longTaskCount,
        total_ms: +(longTaskTotalDur / 1000).toFixed(1),
      },
      trace_path: TRACE_PATH,
      trace_size_kb: +(traceJson.length / 1024).toFixed(1),
    };

    // Print summary as JSON so it's machine-parseable. Also human-
    // readable enough — keys ordered roughly by relevance.
    // biome-ignore lint/suspicious/noConsole: deliberate stdout
    console.log('\n=== PERF TRACE SUMMARY ===');
    // biome-ignore lint/suspicious/noConsole: deliberate stdout
    console.log(JSON.stringify(summary, null, 2));
    // biome-ignore lint/suspicious/noConsole: deliberate stdout
    console.log(`\nFull trace: ${TRACE_PATH} (open in chrome://tracing or perfetto.dev)`);

    // Sanity assertions so the test fails if the trace is suspect.
    expect(events.length).toBeGreaterThan(500);
    // The trace file does in fact write to disk.
    const onDisk = await readFile(TRACE_PATH, 'utf8').catch(() => '');
    expect(onDisk.length).toBeGreaterThan(0);
  });
});
