#!/usr/bin/env node
import fs from 'node:fs/promises';
import process from 'node:process';

function arg(name) {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : null;
}
const planPath = arg('--plan');
const dryRun = process.argv.includes('--dry-run');
if (!planPath) {
  console.error('Usage: node executor/runner.mjs --plan ./chat-organizer-plan.json --dry-run');
  process.exit(1);
}
const plan = JSON.parse(await fs.readFile(planPath, 'utf8'));
const executable = plan.actions.filter(a => ['move','archive'].includes(a.action));
const review = plan.actions.filter(a => a.action === 'review');

console.log(`Plan: ${plan.actions.length} total actions`);
console.log(`Executable candidates: ${executable.length}`);
console.log(`Manual review: ${review.length}`);
console.log('');
for (const item of executable) {
  console.log(`[${item.action.toUpperCase()}] ${item.title}${item.project ? ` -> ${item.project}` : ''}`);
}

if (!dryRun) {
  console.error('\nExecution is intentionally disabled in the MVP.');
  console.error('Validate the current ChatGPT UI and implement the Playwright adapter before enabling write actions.');
  process.exit(2);
}
