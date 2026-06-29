#!/usr/bin/env node
// scripts/build-stats.mjs
// -----------------------------------------------------------------------------
// Generates public/stats.json — the deep project metrics the GitHub API cannot
// compute on its own: lines of code by category, test counts, coverage, domain
// richness, footprint and the git story. The live dashboard reads this file
// through GitHub so those numbers refresh whenever CI regenerates it.
//
// Dependency-free: Node built-ins + the `git` CLI only.
// Run after coverage so coverage/coverage-summary.json exists, e.g.:
//   pnpm exec vitest run --coverage --coverage.reporter=json-summary
//   node ./scripts/build-stats.mjs
// -----------------------------------------------------------------------------

import { execSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, join } from 'node:path';
import { gzipSync } from 'node:zlib';

const ROOT = process.cwd();
const sh = (cmd) =>
  execSync(cmd, { cwd: ROOT, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }).trim();
const safe = (fn, dflt) => {
  try {
    return fn();
  } catch {
    return dflt;
  }
};

// --- tracked files (respects .gitignore; also gives the "tracked files" count) --
const tracked = sh('git ls-files').split('\n').filter(Boolean);

const countLines = (f) => {
  try {
    const s = readFileSync(join(ROOT, f), 'utf8');
    if (s.length === 0) return 0;
    let n = 0;
    for (let i = 0; i < s.length; i++) if (s.charCodeAt(i) === 10) n++;
    return s.endsWith('\n') ? n : n + 1;
  } catch {
    return 0;
  }
};

const isTsx = (f) => /\.(ts|tsx)$/.test(f) && !f.endsWith('.d.ts');

// --- categorize every tracked file into one bucket -----------------------------
const cat = {
  app: (f) => f.startsWith('src/') && isTsx(f) && !/\.(test|spec)\.tsx?$/.test(f),
  unit: (f) => f.startsWith('tests/') && isTsx(f),
  e2e: (f) => f.startsWith('e2e/') && isTsx(f),
  scripts: (f) => f.startsWith('scripts/') && /\.(mjs|cjs|js)$/.test(f),
  styles: (f) => f.endsWith('.css'),
  docs: (f) => f.startsWith('docs/') && f.endsWith('.md'),
};

const buckets = {};
for (const k of Object.keys(cat)) buckets[k] = { files: 0, lines: 0 };
for (const f of tracked) {
  for (const k of Object.keys(cat)) {
    if (cat[k](f)) {
      buckets[k].files++;
      buckets[k].lines += countLines(f);
      break;
    }
  }
}

const code = [
  { category: 'App code (src, excl. tests)', files: buckets.app.files, lines: buckets.app.lines },
  { category: 'Unit tests', files: buckets.unit.files, lines: buckets.unit.lines },
  { category: 'E2E tests (Playwright)', files: buckets.e2e.files, lines: buckets.e2e.lines },
  { category: 'Build scripts', files: buckets.scripts.files, lines: buckets.scripts.lines },
  { category: 'Styles (CSS)', files: buckets.styles.files, lines: buckets.styles.lines },
  { category: 'Docs (Markdown)', files: buckets.docs.files, lines: buckets.docs.lines },
];

const linesTsJs =
  buckets.app.lines + buckets.unit.lines + buckets.e2e.lines + buckets.scripts.lines;

// --- test counts (count it()/test() call sites) --------------------------------
const countTests = (prefix) => {
  let n = 0;
  for (const f of tracked) {
    if (!f.startsWith(prefix) || !isTsx(f)) continue;
    const s = safe(() => readFileSync(join(ROOT, f), 'utf8'), '');
    const m = s.match(/(?:^|\s)(?:it|test)(?:\.\w+)?\s*\(/g);
    if (m) n += m.length;
  }
  return n;
};
const unitTests = countTests('tests/');
const e2eTests = countTests('e2e/');

// --- coverage (read the Istanbul/V8 json-summary if present) -------------------
let coverage = null;
for (const p of ['coverage/coverage-summary.json']) {
  if (existsSync(join(ROOT, p))) {
    const c = safe(() => JSON.parse(readFileSync(join(ROOT, p), 'utf8')), null);
    if (c?.total) {
      const pick = (k) => ({
        pct: c.total[k].pct,
        covered: c.total[k].covered,
        total: c.total[k].total,
      });
      coverage = {
        lines: pick('lines'),
        statements: pick('statements'),
        functions: pick('functions'),
        branches: pick('branches'),
      };
    }
  }
}

// --- domain richness (best-effort file-pattern counts) -------------------------
const inDir = (d) => tracked.filter((f) => f.startsWith(d));
const srcFiles = tracked.filter((f) => f.startsWith('src/') && isTsx(f));
const matchBase = (files, re) => files.filter((f) => re.test(basename(f))).length;

// Bonus — canonical constants read from the real source modules (not guessed):
// the diagram types (DiagramType union), the CLR categories (CLR_CATEGORIES),
// and the pattern-library registry (PATTERNS). Comments are stripped first, then
// each is counted from a stable marker so the numbers track the source as it
// grows; null if the shape ever moves so a stale guess never sneaks in.
const stripComments = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
const readSrc = (rel) => safe(() => readFileSync(join(ROOT, rel), 'utf8'), '');
const countDiagramTypes = safe(() => {
  const src = stripComments(readSrc('src/domain/types/clr.ts'));
  const at = src.indexOf('export type DiagramType');
  if (at === -1) return null;
  const m = src.slice(at, src.indexOf(';', at)).match(/'[a-zA-Z]+'/g);
  return m ? m.length : null;
}, null);
const countClrCategories = safe(() => {
  const src = stripComments(readSrc('src/domain/clrCategory.ts'));
  const at = src.indexOf('CLR_CATEGORIES');
  if (at === -1) return null;
  // Seek past the `: readonly ClrCategory[]` type annotation to the assignment,
  // then the array literal after it (otherwise the `[]` in the type is matched).
  const open = src.indexOf('[', src.indexOf('=', at));
  const m = src.slice(open, src.indexOf(']', open)).match(/'[a-z][\w-]*'/g);
  return m ? m.length : null;
}, null);
const countLibraryPatterns = safe(() => {
  const src = stripComments(readSrc('src/domain/patterns/index.ts'));
  const m = src.match(/\bid:\s*'/g);
  return m ? m.length : null;
}, null);
// Command-palette commands: count the `id:` entries across the per-group command
// files (COMMANDS is assembled from these). Best-effort static count — a handful
// of commands are generated from a `.map()` template and so count as one.
const countCommands = safe(() => {
  const cmdFiles = tracked.filter(
    (f) =>
      f.startsWith('src/components/command-palette/commands/') &&
      f.endsWith('.ts') &&
      !f.endsWith('/index.ts') &&
      !f.endsWith('/types.ts')
  );
  let n = 0;
  for (const f of cmdFiles) {
    const m = readSrc(f).match(/^\s*id:\s*['`]/gm);
    if (m) n += m.length;
  }
  return n || null;
}, null);

const domain = {
  components: inDir('src/components/').filter((f) => f.endsWith('.tsx')).length,
  hooks: matchBase(inDir('src/hooks/'), /^use.*\.tsx?$/),
  storeSlices: matchBase(inDir('src/store/'), /slice\.tsx?$/i),
  validators: matchBase(srcFiles, /validat(or|e).*\.tsx?$/i),
  exporters: matchBase(srcFiles, /export(er)?.*\.tsx?$/i),
  // Bonus — read from the canonical source modules, not file-name guesses.
  diagramTypes: countDiagramTypes,
  clrCategories: countClrCategories,
  libraryPatterns: countLibraryPatterns,
  commands: countCommands,
};

// --- footprint -----------------------------------------------------------------
const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'));
const depsProd = Object.keys(pkg.dependencies || {}).length;
const depsDev = Object.keys(pkg.devDependencies || {}).length;

const biggestFiles = tracked
  .filter(cat.app)
  .map((f) => ({ name: f.replace(/^src\//, ''), lines: countLines(f) }))
  .sort((a, b) => b.lines - a.lines)
  .slice(0, 5);

// --- git story -----------------------------------------------------------------
const commits = Number(safe(() => sh('git rev-list --count HEAD'), '0')) || 0;
const born =
  safe(() => sh('git log --reverse --max-parents=0 --format=%aI').split('\n')[0], null) || null;
const ageDays = born ? Math.floor((Date.now() - new Date(born)) / 86400000) : null;
const commits7d =
  Number(safe(() => sh('git rev-list --count --since="7 days ago" HEAD'), '0')) || 0;

const authors = safe(
  () =>
    sh('git shortlog -sn --no-merges HEAD')
      .split('\n')
      .map((l) => {
        const m = l.trim().match(/^(\d+)\s+(.*)$/);
        return m ? { name: m[2], count: Number(m[1]) } : null;
      })
      .filter(Boolean),
  []
);

const churn30d = { added: 0, removed: 0 };
safe(() => {
  const out = sh('git log --since="30 days ago" --numstat --format=tformat: HEAD');
  for (const line of out.split('\n')) {
    const m = line.trim().match(/^(\d+|-)\t(\d+|-)\t/);
    if (m) {
      if (m[1] !== '-') churn30d.added += Number(m[1]);
      if (m[2] !== '-') churn30d.removed += Number(m[2]);
    }
  }
});

let changelogEntries = null;
if (existsSync(join(ROOT, 'CHANGELOG.md'))) {
  const m = readFileSync(join(ROOT, 'CHANGELOG.md'), 'utf8').match(/^##\s/gm);
  changelogEntries = m ? m.length : null;
}

const headSha = safe(() => sh('git rev-parse --short HEAD'), null);

// --- per-file coverage (drives leastCovered + risky) --------------------------
// Reads the per-file entries in coverage-summary.json (paths are absolute and
// platform-specific, so we slice from the last `/src/`). Test files and files
// with no executable lines are excluded.
const perFileCov = safe(() => {
  const c = JSON.parse(readFileSync(join(ROOT, 'coverage/coverage-summary.json'), 'utf8'));
  const out = [];
  for (const [k, v] of Object.entries(c)) {
    if (k === 'total' || !v?.lines) continue;
    const rel = k.replace(/\\/g, '/');
    const i = rel.lastIndexOf('/src/');
    if (i === -1) continue;
    const file = rel.slice(i + 5);
    if (/\.(test|spec)\.tsx?$/.test(file)) continue;
    if (v.lines.total === 0) continue;
    out.push({ file, pct: v.lines.pct });
  }
  return out;
}, []);

// --- bundle size (sum gzip of built dist/ assets) ------------------------------
const round1 = (n) => Math.round((n / 1024) * 10) / 10;
const bundle = safe(
  () => {
    const distDir = join(ROOT, 'dist');
    if (!existsSync(distDir)) {
      return {
        jsGzipKb: null,
        cssGzipKb: null,
        totalGzipKb: null,
        budgetKb: null,
        withinBudget: true,
      };
    }
    let jsBytes = 0;
    let cssBytes = 0;
    for (const e of readdirSync(distDir, { recursive: true })) {
      const rel = String(e).replace(/\\/g, '/');
      if (!/\.(js|css)$/.test(rel)) continue;
      const buf = safe(() => readFileSync(join(distDir, rel)), null);
      if (!buf) continue;
      const gz = gzipSync(buf).length;
      if (rel.endsWith('.css')) cssBytes += gz;
      else jsBytes += gz;
    }
    // budgetKb / withinBudget mirror scripts/check-bundle-size.mjs: budgetKb is the
    // sum of the per-chunk ceilings in bundle-budget.json, and withinBudget is
    // whether every BUDGETED chunk is under its ceiling (unbudgeted vendor chunks
    // count toward the totals but aren't gated — same as the CI bundle-size job).
    let budgetKb = null;
    let withinBudget = true;
    const bb = safe(() => JSON.parse(readFileSync(join(ROOT, 'bundle-budget.json'), 'utf8')), null);
    if (bb?.chunks) {
      budgetKb = round1(Object.values(bb.chunks).reduce((a, b) => a + b, 0));
      const slop = (bb.slopPercent ?? 10) / 100;
      const keys = Object.keys(bb.chunks);
      const matchKey = (name) => {
        const parts = name.replace(/\.js$/, '').split('-');
        for (let i = parts.length; i >= 1; i--) {
          const candidate = parts.slice(0, i).join('-');
          if (keys.includes(candidate)) return candidate;
        }
        return null;
      };
      const assets = safe(
        () => readdirSync(join(distDir, 'assets')).filter((f) => f.endsWith('.js')),
        []
      );
      for (const a of assets) {
        const k = matchKey(a);
        if (!k) continue;
        const gz = gzipSync(readFileSync(join(distDir, 'assets', a))).length;
        if (gz > bb.chunks[k] * (1 + slop)) withinBudget = false;
      }
    }
    return {
      jsGzipKb: round1(jsBytes),
      cssGzipKb: round1(cssBytes),
      totalGzipKb: round1(jsBytes + cssBytes),
      budgetKb,
      withinBudget,
    };
  },
  { jsGzipKb: null, cssGzipKb: null, totalGzipKb: null, budgetKb: null, withinBudget: true }
);

// --- quality (mutation score, least-covered, churn hotspots, risky) ------------
// mutationScore: read the committed mutation summary. The weekly mutation.yml
// (.github/workflows/mutation.yml) runs Stryker over src/domain/validators against
// the fast domain-only test set (stryker.mutation.config.mjs + vitest.mutation.
// config.ts) and commits a tiny reports/mutation/score.json ({ mutationScore }) —
// distilled from the large (gitignored) Stryker report by scripts/mutation-score.mjs.
// Falls back to a full Stryker JSON report if present; null when neither exists.
const mutationScore = safe(() => {
  for (const p of [
    'reports/mutation/score.json',
    'reports/mutation/mutation.json',
    'reports/mutation/mutation-report.json',
  ]) {
    if (!existsSync(join(ROOT, p))) continue;
    const r = JSON.parse(readFileSync(join(ROOT, p), 'utf8'));
    if (typeof r.mutationScore === 'number') return r.mutationScore;
    if (r.files) {
      let killed = 0;
      let total = 0;
      for (const f of Object.values(r.files)) {
        for (const m of f.mutants ?? []) {
          if (['Ignored', 'CompileError', 'RuntimeError'].includes(m.status)) continue;
          total++;
          if (m.status === 'Killed' || m.status === 'Timeout') killed++;
        }
      }
      return total > 0 ? Math.round((killed / total) * 10000) / 100 : null;
    }
  }
  return null;
}, null);

const leastCovered = perFileCov
  .filter((f) => f.pct < 100)
  .sort((a, b) => a.pct - b.pct)
  .slice(0, 5);

// Commit count per src file over the last 90 days (top of list = churn hotspot).
const churn = safe(() => {
  const out = sh('git log --since="90 days ago" --name-only --format= -- src');
  const counts = new Map();
  for (const line of out.split('\n')) {
    const f = line.trim();
    if (!f.startsWith('src/')) continue;
    const file = f.replace(/^src\//, '');
    counts.set(file, (counts.get(file) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([file, commits]) => ({ file, commits }))
    .sort((a, b) => b.commits - a.commits);
}, []);
const churnHotspots = churn.slice(0, 5);

// risky = high-change × low-coverage: files in the churn top-15 whose line
// coverage is under 70%. The "test these next" list.
const lowCov = new Set(perFileCov.filter((f) => f.pct < 70).map((f) => f.file));
const covByFile = new Map(perFileCov.map((f) => [f.file, f.pct]));
const risky = churn
  .slice(0, 15)
  .filter((c) => lowCov.has(c.file))
  .map((c) => ({ file: c.file, pct: covByFile.get(c.file) ?? null, commits: c.commits }))
  .slice(0, 5);

const quality = { mutationScore, leastCovered, churnHotspots, risky };

// --- code hygiene (escape-hatch + marker counts over src) ----------------------
const hygiene = safe(() => {
  const h = {
    todo: 0,
    fixme: 0,
    hack: 0,
    anyCount: 0,
    tsIgnore: 0,
    tsExpectError: 0,
    biomeIgnore: 0,
    nonNull: 0,
  };
  const n = (s, re) => (s.match(re) || []).length;
  for (const f of srcFiles) {
    const s = safe(() => readFileSync(join(ROOT, f), 'utf8'), '');
    h.todo += n(s, /TODO/gi);
    h.fixme += n(s, /FIXME/gi);
    h.hack += n(s, /HACK/gi);
    h.anyCount += n(s, /:\s*any\b/g) + n(s, /\bas\s+any\b/g);
    h.tsIgnore += n(s, /@ts-ignore/g);
    h.tsExpectError += n(s, /@ts-expect-error/g);
    h.biomeIgnore += n(s, /biome-ignore/g);
    // Best-effort: a `!` non-null assertion after an identifier / `)` / `]`, not
    // part of `!=`. Approximate — may catch a stray `!` in a string or regex.
    h.nonNull += n(s, /[\w)\]]!(?!=)/g);
  }
  return h;
}, null);

// --- docs: book size vs app code ----------------------------------------------
// The manuscript is docs/guide/*.md (chapters + appendices); README / AUTHORING
// are scaffolding, excluded.
const guideFiles = tracked.filter(
  (f) => f.startsWith('docs/guide/') && f.endsWith('.md') && !/\/(README|AUTHORING)\.md$/.test(f)
);
const docs = safe(
  () => {
    let words = 0;
    for (const f of guideFiles) {
      const s = safe(() => readFileSync(join(ROOT, f), 'utf8'), '').trim();
      if (s) words += s.split(/\s+/).length;
    }
    const appLoc = buckets.app.lines;
    return {
      bookWords: words,
      chapters: guideFiles.length,
      appLoc,
      docToCodeRatio: appLoc > 0 ? Math.round((words / appLoc) * 100) / 100 : null,
    };
  },
  { bookWords: null, chapters: guideFiles.length, appLoc: buckets.app.lines, docToCodeRatio: null }
);

// --- test-suite timing (Vitest JSON report from the run, if present) -----------
const timing = safe(
  () => {
    const r = JSON.parse(readFileSync(join(ROOT, '.tmp/vitest-report.json'), 'utf8'));
    const results = Array.isArray(r.testResults) ? r.testResults : [];
    if (results.length === 0) return { durationMs: null, slowest: [] };
    const ends = results.map((t) => t.endTime).filter((x) => typeof x === 'number');
    const starts = results.map((t) => t.startTime).filter((x) => typeof x === 'number');
    const durationMs =
      ends.length && starts.length ? Math.round(Math.max(...ends) - Math.min(...starts)) : null;
    const slowest = results
      .map((t) => ({
        file: String(t.name || '')
          .replace(/\\/g, '/')
          .replace(/^.*\/((?:tests|e2e)\/)/, '$1'),
        ms: Math.round((t.endTime ?? 0) - (t.startTime ?? 0)),
      }))
      .sort((a, b) => b.ms - a.ms)
      .slice(0, 5);
    return { durationMs, slowest };
  },
  { durationMs: null, slowest: [] }
);

// --- feature coverage (reads docs/features.json) -------------------------------
// The user-facing-feature catalogue + how much of it the docs cover. `manual` =
// documented in USER_GUIDE.md; `book` = documented in a docs/guide chapter;
// `bookExample` = that chapter carries a worked example. Catalogue is curated
// (one row per capability); coverage flags are maintained alongside it.
const featureCoverage = safe(() => {
  const reg = JSON.parse(readFileSync(join(ROOT, 'docs/features.json'), 'utf8'));
  const feats = Array.isArray(reg.features) ? reg.features : [];
  const total = feats.length;
  const pct = (n) => (total ? Math.round((n / total) * 1000) / 10 : 0);
  const manual = feats.filter((f) => f.manual).length;
  const book = feats.filter((f) => f.book).length;
  const bookExample = feats.filter((f) => f.bookExample).length;
  const byArea = {};
  for (const f of feats) {
    byArea[f.area] ??= { total: 0, manual: 0, book: 0 };
    const a = byArea[f.area];
    a.total++;
    if (f.manual) a.manual++;
    if (f.book) a.book++;
  }
  const newestFirst = (arr) => [...arr].sort((a, b) => (b.since ?? 0) - (a.since ?? 0));
  const gap = (pred) =>
    newestFirst(feats.filter(pred)).map((f) => ({ id: f.id, name: f.name, since: f.since }));
  return {
    total,
    manual,
    manualPct: pct(manual),
    book,
    bookPct: pct(book),
    bookExample,
    bookExamplePct: pct(bookExample),
    byArea,
    gaps: { noManual: gap((f) => !f.manual), noBook: gap((f) => !f.book) },
  };
}, null);

// --- assemble + write ----------------------------------------------------------
const stats = {
  generatedAt: new Date().toISOString(),
  commit: headSha,
  headline: {
    linesTsJs,
    tests: unitTests + e2eTests,
    lineCoveragePct: coverage ? coverage.lines.pct : null,
    commits,
    ageDays,
    trackedFiles: tracked.length,
    featureManualPct: featureCoverage ? featureCoverage.manualPct : null,
    featureBookPct: featureCoverage ? featureCoverage.bookPct : null,
    featureExamplePct: featureCoverage ? featureCoverage.bookExamplePct : null,
  },
  code,
  coverage,
  tests: { unit: unitTests, e2e: e2eTests, durationMs: timing.durationMs, slowest: timing.slowest },
  domain,
  footprint: { depsProd, depsDev, biggestFiles },
  quality,
  hygiene,
  bundle,
  docs,
  featureCoverage,
  git: { born, ageDays, commits, commits7d, authors, churn30d, changelogEntries },
};

writeFileSync(join(ROOT, 'public/stats.json'), `${JSON.stringify(stats, null, 2)}\n`);

// --- trends: append today's point to public/stats-history.json -----------------
// One entry per calendar day (today overwrites today's existing point), capped to
// the most recent 180 entries. The dashboard reads this for sparkline trends.
const histPath = join(ROOT, 'public/stats-history.json');
let history = safe(() => JSON.parse(readFileSync(histPath, 'utf8')), []);
if (!Array.isArray(history)) history = [];
const today = new Date().toISOString().slice(0, 10);
const point = {
  date: today,
  linesTsJs,
  coveragePct: coverage ? coverage.lines.pct : null,
  tests: unitTests + e2eTests,
  bundleKb: bundle.totalGzipKb,
  mutationScore: quality.mutationScore,
  featureManualPct: featureCoverage ? featureCoverage.manualPct : null,
  featureBookPct: featureCoverage ? featureCoverage.bookPct : null,
  featureExamplePct: featureCoverage ? featureCoverage.bookExamplePct : null,
};
history = history.filter((h) => h.date !== today);
history.push(point);
if (history.length > 180) history = history.slice(-180);
writeFileSync(histPath, `${JSON.stringify(history, null, 2)}\n`);

console.log('Wrote public/stats.json —', JSON.stringify(stats.headline));
console.log('Wrote public/stats-history.json —', `${history.length} points`);
