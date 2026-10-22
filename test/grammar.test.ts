// Grammar tests: tokenize test/fixtures/syntax.md with the real TextMate engine and check the scopes of chosen tokens.
// The line numbers are 0-based positions in the fixture; `lineOf` finds them by text so editing the fixture is safe.
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { scopesOf, tokenize, type Token } from './grammar-helper.ts';
import { render, OUTPUT } from '../scripts/build-fences.mjs';

const fixture = readFileSync(new URL('./fixtures/syntax.md', import.meta.url), 'utf8');
const lines = fixture.split('\n');
const lineOf = (text: string, nth = 0) => {
  const hits = lines.map((l, i) => (l.includes(text) ? i : -1)).filter((i) => i >= 0);
  assert.ok(hits[nth] !== undefined, `fixture has no line with "${text}"`);
  return hits[nth];
};

let tokens: Token[][];
const has = (line: number, needle: string, scope: string) =>
  assert.ok(
    scopesOf(tokens, line, needle).includes(scope),
    `"${needle}" should have ${scope}, has ${scopesOf(tokens, line, needle).join(' ')}`,
  );
const hasNot = (line: number, needle: string, scope: string) =>
  assert.ok(!scopesOf(tokens, line, needle).includes(scope), `"${needle}" should not have ${scope}`);

test('load', async () => {
  tokens = await tokenize(fixture);
  assert.equal(tokens.length, lines.length);
});

test('slide separators and frontmatter YAML', () => {
  has(0, '---', 'punctuation.definition.separator.slide-ng');
  has(1, 'title', 'meta.embedded.block.frontmatter');
  has(1, 'title', 'entity.name.tag.yaml'); // the YAML grammar is really used
  const second = lineOf('layout: center');
  has(second - 1, '---', 'meta.slide-start.slide-ng');
  has(second, 'center', 'meta.embedded.block.frontmatter');
  has(second + 2, '---', 'punctuation.definition.separator.slide-ng');
  // the heading after the block is plain markdown again
  has(second + 4, 'Second', 'markup.heading.markdown');
});

test('a bare separator is not frontmatter', () => {
  const sep = lines.indexOf('---', lineOf('::right::'));
  has(sep, '---', 'punctuation.definition.separator.slide-ng');
  hasNot(sep, '---', 'meta.embedded.block.frontmatter');
  hasNot(sep + 2, '```', 'meta.embedded.block.frontmatter');
});

test('Angular control flow', () => {
  const l = lineOf('@if (total');
  has(l, '@if', 'keyword.control.flow.slide-ng');
  has(l, 'total', 'meta.control.flow.slide-ng');
  const elseIf = lineOf('@else if');
  has(elseIf, '@else if', 'keyword.control.flow.slide-ng');
  has(elseIf, '}', 'punctuation.definition.block.end.slide-ng');
  has(lineOf('@else {'), '@else', 'keyword.control.flow.slide-ng');
  has(lineOf('@for ('), '@for', 'keyword.control.flow.slide-ng');
  has(lineOf('@let total'), '@let', 'keyword.control.at-rule.slide-ng');
  has(lineOf('@let total'), 'total', 'variable.other.readwrite.slide-ng');
});

test('interpolation', () => {
  const l = lineOf('# Hello');
  has(l, '{{', 'punctuation.definition.interpolation.begin.slide-ng');
  has(l, 'n', 'meta.embedded.expression.slide-ng');
});

test('tags: bindings, events, refs, structural directives, click directives', () => {
  const tag = lineOf('<app-counter');
  has(tag, '[start]', 'entity.other.attribute-name.binding.slide-ng');
  has(tag, '(picked)', 'entity.other.attribute-name.binding.slide-ng');
  has(tag, 'c', 'variable.other.template-reference.slide-ng');
  has(tag, '$event', 'meta.embedded.expression.slide-ng');
  const star = lineOf('*ngIf');
  has(star, 'ngIf', 'keyword.control.structural-directive.slide-ng');
  has(star, 'visible', 'meta.embedded.expression.slide-ng');
  has(star, 'slide-ng-click', 'entity.other.attribute-name.directive.slide-ng');
  has(star, '+2', 'string.quoted.double.slide-ng');
  assert.ok(!tokens[star].some((t) => t.scopes.some((s) => s.startsWith('invalid'))), 'no token is marked invalid');
  const range = lineOf('[slide-ng-click]');
  has(range, '[slide-ng-click]', 'entity.other.attribute-name.binding.slide-ng');
  has(range, 'slide-ng-after', 'entity.other.attribute-name.directive.slide-ng');
  // click animation presets (2.0): modifiers on the attribute, also in a binding
  const preset = lineOf('slide-ng-click.fade.right');
  has(preset, 'slide-ng-click.fade.right', 'entity.other.attribute-name.directive.slide-ng');
  has(preset, '3', 'string.quoted.double.slide-ng');
  const bound = lineOf('[slide-ng-click.up]');
  has(bound, '[slide-ng-click.up]', 'entity.other.attribute-name.binding.slide-ng');
  has(bound, '4', 'meta.embedded.expression.slide-ng');
});

test('slot markers', () => {
  const l = lineOf('::right::');
  has(l, 'right', 'entity.name.slot.slide-ng');
  has(l, '::', 'meta.slot.slide-ng');
});

test('code fence options', () => {
  const monaco = lineOf('{monaco}');
  has(monaco, 'monaco', 'keyword.other.monaco.slide-ng');
  has(monaco + 1, 'const', 'meta.embedded.block.typescript'); // the code is still highlighted as TypeScript
  const ranges = lineOf('[title.ts]');
  has(ranges, '[title.ts]', 'string.other.code-title.slide-ng');
  has(ranges, '2', 'constant.numeric.line-range.slide-ng');
  has(ranges, 'all', 'constant.language.line-range.slide-ng');
  assert.ok(
    tokens[ranges].some((t) => t.text === '|' && t.scopes.includes('punctuation.separator.click-step.slide-ng')),
  );
  has(ranges, 'lines', 'meta.embedded.block.code-options.slide-ng'); // {lines:true, ...} is read as an object
  has(lineOf('magic-move'), 'magic-move', 'keyword.other.code-flag.slide-ng');
});

test('a fence without options is left to the markdown grammar', () => {
  const l = lines.indexOf('```ts'); // the fence inside the magic-move block
  assert.ok(l > 0);
  has(l, 'ts', 'fenced_code.block.language.markdown');
  hasNot(l, 'ts', 'meta.code-options.slide-ng');
});

test('snippet imports', () => {
  const l = lineOf('<<<');
  has(l, '<<<', 'punctuation.definition.snippet.slide-ng');
  has(l, './snippets/example.ts#greet', 'string.unquoted.path.snippet.slide-ng');
  has(l, '1', 'constant.numeric.line-range.slide-ng');
  has(l, 'ts', 'fenced_code.block.language.snippet.slide-ng');
  // 2.0: the language after the path, then a title with spaces and an icon
  const titled = lineOf('<<< ./snippets/greet.py');
  has(titled, './snippets/greet.py', 'string.unquoted.path.snippet.slide-ng');
  has(titled, 'python', 'fenced_code.block.language.snippet.slide-ng');
  has(titled, '[greet.py', 'string.other.code-title.slide-ng');
  has(titled, '~i-carbon:code~', 'constant.other.icon.slide-ng');
  has(titled, '2', 'constant.numeric.line-range.slide-ng');
  has(titled, 'lines', 'meta.embedded.block.code-options.slide-ng');
});

test('an icon in a code block title', () => {
  const l = lineOf('[npm ~i-carbon:terminal~]');
  has(l, 'npm', 'string.other.code-title.slide-ng');
  has(l, '~i-carbon:terminal~', 'constant.other.icon.slide-ng');
  has(l + 1, 'npm', 'meta.embedded.block.shellscript');
});

test('nothing slide.ng-specific inside code', () => {
  const inline = lineOf('Inline `{{');
  hasNot(inline, '{{ not.a.binding }}', 'meta.interpolation.slide-ng');
  const fenced = lineOf('@if (nope)');
  assert.ok(!tokens[fenced].some((t) => t.scopes.includes('keyword.control.flow.slide-ng')));
  assert.ok(!tokens[fenced + 1].some((t) => t.scopes.includes('meta.interpolation.slide-ng')));
});

test('click markers in speaker notes', () => {
  const l = lineOf('Speaker note');
  has(l, '[click]', 'keyword.other.click-marker.slide-ng');
  has(l, '[click:3]', 'keyword.other.click-marker.slide-ng');
  has(l, 'Speaker note', 'comment.block.html');
});

test('the generated fence grammar is up to date', () => {
  assert.equal(readFileSync(OUTPUT, 'utf8'), render(), 'run: node scripts/build-fences.mjs');
});
