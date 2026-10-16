// Runs after `npm install` (the `prepare` script). Turns on the repository's git hooks and
// commit template, but only when you have not set those options yourself.
// It never fails: no git, no .git folder (a zip) or an error just means nothing is set.
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

function git(...args) {
  return execFileSync('git', args, {
    cwd: root,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore'],
  });
}

function setIfUnset(key, value) {
  let current = '';
  try {
    current = git('config', '--get', key).trim();
  } catch {
    // git exits with 1 when the key is not set.
  }
  if (!current) git('config', '--local', key, value);
}

try {
  if (existsSync(join(root, '.git'))) {
    setIfUnset('core.hooksPath', '.githooks');
    setIfUnset('commit.template', '.gitmessage');
  }
} catch {
  // Not a git checkout, or git is missing. The hooks are optional.
}
