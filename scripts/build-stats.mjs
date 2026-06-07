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

import { execSync } from "node:child_process";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join, basename } from "node:path";

const ROOT = process.cwd();
const sh = (cmd) =>
	execSync(cmd, { cwd: ROOT, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 }).trim();
const safe = (fn, dflt) => {
	try {
		return fn();
	} catch {
		return dflt;
	}
};

// --- tracked files (respects .gitignore; also gives the "tracked files" count) --
const tracked = sh("git ls-files").split("\n").filter(Boolean);

const countLines = (f) => {
	try {
		const s = readFileSync(join(ROOT, f), "utf8");
		if (s.length === 0) return 0;
		let n = 0;
		for (let i = 0; i < s.length; i++) if (s.charCodeAt(i) === 10) n++;
		return s.endsWith("\n") ? n : n + 1;
	} catch {
		return 0;
	}
};

const isTsx = (f) => /\.(ts|tsx)$/.test(f) && !f.endsWith(".d.ts");

// --- categorize every tracked file into one bucket -----------------------------
const cat = {
	app: (f) => f.startsWith("src/") && isTsx(f) && !/\.(test|spec)\.tsx?$/.test(f),
	unit: (f) => f.startsWith("tests/") && isTsx(f),
	e2e: (f) => f.startsWith("e2e/") && isTsx(f),
	scripts: (f) => f.startsWith("scripts/") && /\.(mjs|cjs|js)$/.test(f),
	styles: (f) => f.endsWith(".css"),
	docs: (f) => f.startsWith("docs/") && f.endsWith(".md"),
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
	{ category: "App code (src, excl. tests)", files: buckets.app.files, lines: buckets.app.lines },
	{ category: "Unit tests", files: buckets.unit.files, lines: buckets.unit.lines },
	{ category: "E2E tests (Playwright)", files: buckets.e2e.files, lines: buckets.e2e.lines },
	{ category: "Build scripts", files: buckets.scripts.files, lines: buckets.scripts.lines },
	{ category: "Styles (CSS)", files: buckets.styles.files, lines: buckets.styles.lines },
	{ category: "Docs (Markdown)", files: buckets.docs.files, lines: buckets.docs.lines },
];

const linesTsJs =
	buckets.app.lines + buckets.unit.lines + buckets.e2e.lines + buckets.scripts.lines;

// --- test counts (count it()/test() call sites) --------------------------------
const countTests = (prefix) => {
	let n = 0;
	for (const f of tracked) {
		if (!f.startsWith(prefix) || !isTsx(f)) continue;
		const s = safe(() => readFileSync(join(ROOT, f), "utf8"), "");
		const m = s.match(/(?:^|\s)(?:it|test)(?:\.\w+)?\s*\(/g);
		if (m) n += m.length;
	}
	return n;
};
const unitTests = countTests("tests/");
const e2eTests = countTests("e2e/");

// --- coverage (read the Istanbul/V8 json-summary if present) -------------------
let coverage = null;
for (const p of ["coverage/coverage-summary.json"]) {
	if (existsSync(join(ROOT, p))) {
		const c = safe(() => JSON.parse(readFileSync(join(ROOT, p), "utf8")), null);
		if (c?.total) {
			const pick = (k) => ({ pct: c.total[k].pct, covered: c.total[k].covered, total: c.total[k].total });
			coverage = {
				lines: pick("lines"),
				statements: pick("statements"),
				functions: pick("functions"),
				branches: pick("branches"),
			};
		}
	}
}

// --- domain richness (best-effort file-pattern counts) -------------------------
const inDir = (d) => tracked.filter((f) => f.startsWith(d));
const srcFiles = tracked.filter((f) => f.startsWith("src/") && isTsx(f));
const matchBase = (files, re) => files.filter((f) => re.test(basename(f))).length;

// Bonus — canonical constants read from the real source modules (not guessed):
// the diagram types (DiagramType union), the CLR categories (CLR_CATEGORIES),
// and the pattern-library registry (PATTERNS). Comments are stripped first, then
// each is counted from a stable marker so the numbers track the source as it
// grows; null if the shape ever moves so a stale guess never sneaks in.
const stripComments = (s) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
const readSrc = (rel) => safe(() => readFileSync(join(ROOT, rel), "utf8"), "");
const countDiagramTypes = safe(() => {
	const src = stripComments(readSrc("src/domain/types/clr.ts"));
	const at = src.indexOf("export type DiagramType");
	if (at === -1) return null;
	const m = src.slice(at, src.indexOf(";", at)).match(/'[a-zA-Z]+'/g);
	return m ? m.length : null;
}, null);
const countClrCategories = safe(() => {
	const src = stripComments(readSrc("src/domain/clrCategory.ts"));
	const at = src.indexOf("CLR_CATEGORIES");
	if (at === -1) return null;
	// Seek past the `: readonly ClrCategory[]` type annotation to the assignment,
	// then the array literal after it (otherwise the `[]` in the type is matched).
	const open = src.indexOf("[", src.indexOf("=", at));
	const m = src.slice(open, src.indexOf("]", open)).match(/'[a-z][\w-]*'/g);
	return m ? m.length : null;
}, null);
const countLibraryPatterns = safe(() => {
	const src = stripComments(readSrc("src/domain/patterns/index.ts"));
	const m = src.match(/\bid:\s*'/g);
	return m ? m.length : null;
}, null);

const domain = {
	components: inDir("src/components/").filter((f) => f.endsWith(".tsx")).length,
	hooks: matchBase(inDir("src/hooks/"), /^use.*\.tsx?$/),
	storeSlices: matchBase(inDir("src/store/"), /slice\.tsx?$/i),
	validators: matchBase(srcFiles, /validat(or|e).*\.tsx?$/i),
	exporters: matchBase(srcFiles, /export(er)?.*\.tsx?$/i),
	// Bonus — read from the canonical source modules, not file-name guesses.
	diagramTypes: countDiagramTypes,
	clrCategories: countClrCategories,
	libraryPatterns: countLibraryPatterns,
};

// --- footprint -----------------------------------------------------------------
const pkg = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8"));
const depsProd = Object.keys(pkg.dependencies || {}).length;
const depsDev = Object.keys(pkg.devDependencies || {}).length;

const biggestFiles = tracked
	.filter(cat.app)
	.map((f) => ({ name: f.replace(/^src\//, ""), lines: countLines(f) }))
	.sort((a, b) => b.lines - a.lines)
	.slice(0, 5);

// --- git story -----------------------------------------------------------------
const commits = Number(safe(() => sh("git rev-list --count HEAD"), "0")) || 0;
const born =
	safe(() => sh("git log --reverse --max-parents=0 --format=%aI").split("\n")[0], null) || null;
const ageDays = born ? Math.floor((Date.now() - new Date(born)) / 86400000) : null;
const commits7d = Number(safe(() => sh('git rev-list --count --since="7 days ago" HEAD'), "0")) || 0;

const authors = safe(
	() =>
		sh("git shortlog -sn --no-merges HEAD")
			.split("\n")
			.map((l) => {
				const m = l.trim().match(/^(\d+)\s+(.*)$/);
				return m ? { name: m[2], count: Number(m[1]) } : null;
			})
			.filter(Boolean),
	[],
);

const churn30d = { added: 0, removed: 0 };
safe(() => {
	const out = sh('git log --since="30 days ago" --numstat --format=tformat: HEAD');
	for (const line of out.split("\n")) {
		const m = line.trim().match(/^(\d+|-)\t(\d+|-)\t/);
		if (m) {
			if (m[1] !== "-") churn30d.added += Number(m[1]);
			if (m[2] !== "-") churn30d.removed += Number(m[2]);
		}
	}
});

let changelogEntries = null;
if (existsSync(join(ROOT, "CHANGELOG.md"))) {
	const m = readFileSync(join(ROOT, "CHANGELOG.md"), "utf8").match(/^##\s/gm);
	changelogEntries = m ? m.length : null;
}

const headSha = safe(() => sh("git rev-parse --short HEAD"), null);

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
	},
	code,
	coverage,
	tests: { unit: unitTests, e2e: e2eTests },
	domain,
	footprint: { depsProd, depsDev, biggestFiles },
	git: { born, ageDays, commits, commits7d, authors, churn30d, changelogEntries },
};

writeFileSync(join(ROOT, "public/stats.json"), `${JSON.stringify(stats, null, 2)}\n`);
console.log("Wrote public/stats.json —", JSON.stringify(stats.headline));
