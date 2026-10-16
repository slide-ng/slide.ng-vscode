import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { checkMessage, SCOPES, TYPES } from '../scripts/commit-message.mjs';

describe('checkMessage', () => {
  it('accepts a type, a scope and a summary', () => {
    assert.deepEqual(checkMessage('feat(grammar): add the first thing'), []);
  });

  it('accepts a message without a scope, and a body after a blank line', () => {
    assert.deepEqual(checkMessage('fix: keep the value on reload\n\nIt was reset before.'), []);
  });

  it('accepts every listed type and scope', () => {
    for (const type of TYPES) assert.deepEqual(checkMessage(`${type}: do something`), []);
    for (const scope of SCOPES) assert.deepEqual(checkMessage(`chore(${scope}): do something`), []);
  });

  it('ignores comment lines, as git does', () => {
    assert.deepEqual(checkMessage('docs: explain the hooks\n# Please enter the message'), []);
  });

  it('lets git merge and fixup messages through, but not in a title', () => {
    assert.deepEqual(checkMessage('Merge branch "x"'), []);
    assert.deepEqual(checkMessage('fixup! feat: add a thing'), []);
    assert.notDeepEqual(checkMessage('Merge branch "x"', { allowAutomatic: false }), []);
  });

  it('rejects an empty message', () => {
    assert.deepEqual(checkMessage('  \n'), ['The message is empty.']);
  });

  it('rejects a first line without the type', () => {
    assert.match(checkMessage('Add a thing')[0], /type\(scope\): summary/);
  });

  it('rejects an unknown type and an unknown scope', () => {
    assert.match(checkMessage('feature: add a thing')[0], /not a type/);
    assert.match(checkMessage('feat(banana): add a thing')[0], /not a scope/);
  });

  it('rejects a trailing period, a capital letter and a long first line', () => {
    assert.equal(checkMessage('fix: add a thing.').length, 1);
    assert.equal(checkMessage('fix: Add a thing').length, 1);
    assert.match(checkMessage(`fix: ${'a'.repeat(80)}`)[0], /characters/);
  });

  it('needs a blank line before the body', () => {
    assert.match(checkMessage('fix: a thing\nbody right away')[0], /blank line/);
  });

  it('rejects trailer lines', () => {
    const message = 'fix: a thing\n\nWhy.\n\nCo-authored-by: Someone <a@example.com>';
    assert.match(checkMessage(message)[0], /trailer/);
  });
});
