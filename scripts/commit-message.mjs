#!/usr/bin/env node
// Checks that a commit message or pull request title reads `type(scope): summary`.
// The rules are in CONTRIBUTING.md.
//
//   node scripts/commit-message.mjs --file <path>     a message file (the commit-msg hook)
//   node scripts/commit-message.mjs --title "<text>"  a pull request title
//   node scripts/commit-message.mjs --range a..b      every commit in a range
//
// The hook and CI only warn. Add --warn to always exit with 0.
import { execFileSync } from 'node:child_process';
import { readFileSync, realpathSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

export const TYPES = ['feat', 'fix', 'perf', 'refactor', 'test', 'docs', 'style', 'build', 'ci', 'chore', 'revert'];

// The part of the extension a change is about. The scope may also be left out.
export const SCOPES = [
  'grammar',
  'outline',
  'commands',
  'preview',
  'server',
  'config',
  'tests',
  'build',
  'docs',
  'deps',
  'ci',
];

const MAX_HEADER = 72;
const HEADER = /^([a-z]+)(?:\(([^)]*)\))?(!)?: (.*)$/;
const TRAILER = /^(co-authored-by|signed-off-by|reviewed-by|generated-by):/im;
const AUTOMATIC = /^(Merge |Revert "|fixup! |squash! )/;

// Returns a list of problems. An empty list means the message is fine.
export function checkMessage(message, { allowAutomatic = true } = {}) {
  const lines = message
    .split('\n')
    .filter((line) => !line.startsWith('#'))
    .join('\n')
    .trim()
    .split('\n');
  const header = lines[0].trim();
  if (!header) return ['The message is empty.'];
  if (allowAutomatic && AUTOMATIC.test(header)) return [];

  const problems = [];
  if (header.length > MAX_HEADER) {
    problems.push(`The first line has ${header.length} characters; keep it to ${MAX_HEADER}.`);
  }
  const match = HEADER.exec(header);
  if (!match) {
    problems.push(`The first line must look like "type(scope): summary", not "${header}".`);
    return problems;
  }
  const [, type, scope, , summary] = match;
  if (!TYPES.includes(type)) problems.push(`"${type}" is not a type. Use ${TYPES.join(', ')}.`);
  if (scope !== undefined && !SCOPES.includes(scope)) {
    problems.push(`"${scope}" is not a scope. Use ${SCOPES.join(', ')}, or none.`);
  }
  if (!summary.trim()) problems.push('Write a summary after the colon.');
  if (summary.endsWith('.')) problems.push('Do not end the summary with a period.');
  if (/^[A-Z]/.test(summary)) problems.push('Start the summary in lower case.');
  if (lines.length > 1 && lines[1].trim() !== '') {
    problems.push('Leave a blank line between the first line and the body.');
  }
  if (TRAILER.test(lines.slice(1).join('\n'))) {
    problems.push('Leave out trailer lines such as Co-authored-by.');
  }
  return problems;
}

function show(label, problems) {
  if (!problems.length) return true;
  console.error(`${label}`);
  for (const problem of problems) console.error(`  - ${problem}`);
  // On GitHub, also show it as a warning on the run.
  if (process.env.GITHUB_ACTIONS) {
    console.log(`::warning title=Commit message::${label} ${problems.join(' ')}`);
  }
  return false;
}

function run(args) {
  const [mode, value] = args;
  if (mode === '--file') {
    return show('Commit message:', checkMessage(readFileSync(value, 'utf8')));
  }
  if (mode === '--title') {
    return show('Pull request title:', checkMessage(value ?? '', { allowAutomatic: false }));
  }
  if (mode === '--range') {
    const revs = execFileSync('git', ['rev-list', '--no-merges', value], { encoding: 'utf8' })
      .split('\n')
      .filter(Boolean);
    let ok = true;
    for (const rev of revs) {
      const message = execFileSync('git', ['log', '-1', '--format=%B', rev], { encoding: 'utf8' });
      ok = show(`${rev.slice(0, 8)} ${message.split('\n')[0]}`, checkMessage(message)) && ok;
    }
    if (ok) console.log(`${revs.length} commit message(s) are fine.`);
    return ok;
  }
  console.error('Usage: commit-message.mjs --file <path> | --title <text> | --range <a..b> [--warn]');
  return false;
}

// True when this file is run directly and not imported by a test.
function isMain() {
  try {
    return realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url));
  } catch {
    return false;
  }
}

if (isMain()) {
  const args = process.argv.slice(2);
  const warnOnly = args.includes('--warn');
  const ok = run(args.filter((arg) => arg !== '--warn'));
  if (!ok) console.error('See CONTRIBUTING.md.');
  process.exit(ok || warnOnly ? 0 : 1);
}
