#!/usr/bin/env node
/* eslint-disable */

// Preinstall guard. Reads the `engines.node` semver range from package.json
// and exits non-zero if the running Node doesn't satisfy it. Saves a
// contributor on Node 18 a confusing build failure later (we use
// import.meta.dirname which is Node 20+).

const fs = require('node:fs');
const path = require('node:path');

const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'package.json'), 'utf8'));
const required = pkg.engines && pkg.engines.node;
if (!required) process.exit(0);

const current = process.versions.node;
const currentMajor = parseInt(current.split('.')[0], 10);

// We only need a simple >=N check; full semver parsing would be overkill for
// a guard script with one supported range pattern.
const match = required.match(/^>=\s*(\d+)/);
if (!match) {
  console.error(`[check-node-version] Unsupported engines.node format: "${required}".`);
  process.exit(1);
}
const requiredMajor = parseInt(match[1], 10);

if (currentMajor < requiredMajor) {
  console.error('');
  console.error(`  This project requires Node ${required}.`);
  console.error(`  You are running Node ${current}.`);
  console.error(`  See .nvmrc or run \`nvm use\`.`);
  console.error('');
  process.exit(1);
}
