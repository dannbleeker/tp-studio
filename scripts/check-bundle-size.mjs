// Bundle-size guard. Runs after `vite build`; reads gzip-size of every
// chunk in dist/assets and compares against the per-chunk budgets in
// bundle-budget.json. Fails (exit 1) if any chunk exceeds its budget by
// more than slopPercent. Keeps CI honest about bundle growth.
//
// The check is opt-in per chunk — bundle-budget.json.chunks lists
// chunk-name *prefixes* (e.g. "flow" matches "flow-BERk-wwa.js"). Chunks
// without a budget entry are reported but don't fail the build, so a new
// dynamic-import doesn't break CI before you've sized its ceiling.

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const DIST_ASSETS = join(ROOT, 'dist', 'assets');
const BUDGET_PATH = join(ROOT, 'bundle-budget.json');

const budget = JSON.parse(readFileSync(BUDGET_PATH, 'utf8'));
const slop = (budget.slopPercent ?? 10) / 100;

let files;
try {
  files = readdirSync(DIST_ASSETS);
} catch (err) {
  console.error(`Cannot read ${DIST_ASSETS}: ${err.message}`);
  console.error('Run `vite build` before this script.');
  process.exit(2);
}

const jsFiles = files.filter((f) => f.endsWith('.js'));

const measurements = jsFiles.map((f) => {
  const full = join(DIST_ASSETS, f);
  const raw = readFileSync(full);
  const gz = gzipSync(raw);
  return { name: f, rawSize: statSync(full).size, gzSize: gz.length };
});

// Match each measured chunk against the budget by name prefix. Vite emits
// hashed names like `flow-BERk-wwa.js` (the hash can include a dash for
// base64-style encoding). We try every dash-bounded prefix from longest to
// shortest and pick the first one that matches a budget key. This way the
// budget file's keys (e.g. "flow", "index", "markdown-table") drive
// matching — we don't have to guess what's a hash and what's content.
const matchBudgetKey = (name, budgetKeys) => {
  const stem = name.replace(/\.js$/, '');
  const parts = stem.split('-');
  for (let i = parts.length; i >= 1; i--) {
    const candidate = parts.slice(0, i).join('-');
    if (budgetKeys.includes(candidate)) return candidate;
  }
  // No match. Return the leftmost segment so the report shows a stable
  // label per chunk family.
  return parts[0] ?? stem;
};
const budgetKeys = Object.keys(budget.chunks);

let failed = false;
const rows = [];
for (const m of measurements) {
  const prefix = matchBudgetKey(m.name, budgetKeys);
  const budgetBytes = budget.chunks[prefix];
  let status = 'unbudgeted';
  let pctOver = 0;
  if (typeof budgetBytes === 'number') {
    const ceiling = budgetBytes * (1 + slop);
    if (m.gzSize > ceiling) {
      status = 'OVER';
      pctOver = ((m.gzSize - budgetBytes) / budgetBytes) * 100;
      failed = true;
    } else if (m.gzSize > budgetBytes) {
      status = 'within slop';
      pctOver = ((m.gzSize - budgetBytes) / budgetBytes) * 100;
    } else {
      status = 'ok';
    }
  }
  rows.push({ name: m.name, gz: m.gzSize, prefix, budget: budgetBytes, status, pctOver });
}

const fmt = (n) => (n >= 1024 ? `${(n / 1024).toFixed(1)} KB` : `${n} B`);

console.log('Chunk                                gzip        budget      status');
console.log('-----                                ----        ------      ------');
for (const r of rows.sort((a, b) => b.gz - a.gz)) {
  const budgetStr = r.budget ? fmt(r.budget) : '—';
  const extra = r.status === 'OVER' ? `  (+${r.pctOver.toFixed(1)}%)` : '';
  console.log(
    `${r.name.padEnd(36)} ${fmt(r.gz).padEnd(11)} ${budgetStr.padEnd(11)} ${r.status}${extra}`
  );
}

if (failed) {
  console.error('\nBundle-size budget exceeded for one or more chunks.');
  console.error('Either reduce the bundle or update bundle-budget.json deliberately.');
  process.exit(1);
}

console.log('\nAll budgeted chunks within ceiling.');
