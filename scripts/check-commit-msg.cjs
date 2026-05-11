#!/usr/bin/env node
/* eslint-disable */

// commit-msg hook. Validates that the first line of every commit follows
// Conventional Commits: `type(scope)?!?: subject`. Merge commits are skipped.
// Path to the message file is git's standard $1 argument.

const fs = require('node:fs');

const msgPath = process.argv[2];
if (!msgPath) {
  console.error('[check-commit-msg] no commit-msg path provided');
  process.exit(2);
}

const raw = fs.readFileSync(msgPath, 'utf8');
const firstLine = raw.split(/\r?\n/, 1)[0] || '';

// Skip merges, reverts (when git-generated), fixups, squashes.
if (/^(Merge|Revert|fixup!|squash!|amend!)\b/.test(firstLine)) {
  process.exit(0);
}

// type(scope)?!?: subject
// type is one of the conventional allowlist.
const pattern =
  /^(feat|fix|docs|refactor|test|chore|build|ci|perf|style|revert)(\([\w./-]+\))?!?:\s.+/;

if (!pattern.test(firstLine)) {
  console.error('');
  console.error('  Commit message must follow Conventional Commits.');
  console.error('  Format:   <type>(<scope>)?: <subject>');
  console.error('  Allowed types: feat, fix, docs, refactor, test, chore,');
  console.error('                  build, ci, perf, style, revert');
  console.error('');
  console.error('  Examples:');
  console.error('    feat(canvas): add minimap toggle');
  console.error('    fix: handle empty selection in confirmAndDeleteEntity');
  console.error('    docs(prd): switch markdown lib to micromark');
  console.error('');
  console.error('  Your message: "' + firstLine + '"');
  console.error('');
  process.exit(1);
}

process.exit(0);
