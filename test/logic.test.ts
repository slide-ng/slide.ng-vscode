// Tests for the helpers that need no editor: clicks, outline, command lines, entry rules, status text, server probe.
import { readFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { estimateClicks } from '../src/clicks.ts';
import { resolveEntry } from '../src/entry.ts';
import { buildOutline, describe } from '../src/outline.ts';
import { parseSlides } from '../src/parser.ts';
import { isSlideNg, probe } from '../src/probe.ts';
import { previewUrl } from '../src/preview-url.ts';
import { commandLine, exportOptions, pathArg, portOption } from '../src/shell.ts';
import { statusText } from '../src/status-text.ts';

const deck = readFileSync(new URL('./fixtures/deck.md', import.meta.url), 'utf8');

test('clicks: v-click forms', () => {
  assert.equal(estimateClicks('<div v-click>a</div>\n<div v-click>b</div>').count, 2);
  assert.equal(estimateClicks('<div v-click="5">a</div>').count, 5);
  assert.equal(estimateClicks('<div v-click>a</div>\n<div v-click="+2">b</div>').count, 3);
  assert.equal(estimateClicks('<div [v-click]="[2, 4]">a</div>').count, 4);
  assert.equal(estimateClicks('<div v-click>a</div>\n<div v-after>b</div>').count, 1);
  assert.equal(estimateClicks('<div v-click="2" v-click-hide>a</div>').count, 2);
  assert.equal(estimateClicks('<v-click-gap size="2" />\n<div v-click>a</div>').count, 3);
  assert.equal(estimateClicks('# No clicks\n\ntext').count, 0);
});

test('clicks: <v-clicks> lists', () => {
  const list = '<v-clicks>\n\n- a\n- b\n  - nested\n- c\n\n</v-clicks>';
  assert.equal(estimateClicks(list).count, 3);
  assert.equal(estimateClicks(list.replace('<v-clicks>', '<v-clicks depth="2">')).count, 4);
  assert.equal(estimateClicks(list.replace('<v-clicks>', '<v-clicks every="2">')).count, 2);
});

test('clicks: code ranges count, code text does not', () => {
  assert.equal(estimateClicks('```ts {1|3-4|all}\nconst a = 1;\n```').count, 2);
  assert.equal(estimateClicks('```html\n<div v-click>not markup</div>\n```').count, 0);
  assert.equal(estimateClicks('```ts {lines:true}\nx\n```').count, 0);
  assert.equal(estimateClicks('```ts {1|2}\nx\n```\n\n<div v-click>a</div>').count, 2);
});

test('clicks: frontmatter clicks wins and is exact', () => {
  assert.deepEqual(estimateClicks('<div v-click>a</div>', { clicks: 7 }), { count: 7, fixed: true });
  assert.deepEqual(estimateClicks('<div v-click>a</div>', { clicks: 'x' }), { count: 1, fixed: false });
});

test('outline of the fixture deck', async () => {
  const outline = buildOutline(await parseSlides(deck, '/deck/slides.md'));
  assert.deepEqual(
    outline.map((o) => [o.no, o.title, o.layout, o.clicks]),
    [
      [1, 'Demo deck', 'cover', 0],
      [2, 'Plain slide', 'default', 0],
      [3, 'Centered', 'center', 5],
      [4, 'import ./pages/intro.md', 'default', 0],
      [5, 'Two columns', 'two-cols', 0],
      [6, 'Hidden one', 'default', 0],
      [7, 'Fixed clicks', 'default', 7],
    ],
  );
  assert.equal(outline[3].src, './pages/intro.md');
  assert.equal(outline[5].hidden, true);
  assert.equal(outline[6].clicksFixed, true);
  assert.equal(outline[1].hasNote, true);
  // `line` is where the editor jumps to: the first line of content
  const lines = deck.split('\n');
  assert.equal(lines[outline[2].line], '# Centered');
  assert.equal(lines[outline[1].line], '# Plain slide');
  assert.equal(lines[outline[3].line], '---'); // no text: the slide's own first line
});

test('outline: titles lose HTML, empty slides get a number, a bad YAML block does not stop the outline', async () => {
  const outline = buildOutline(
    await parseSlides('# One <b>bold</b>\n\n---\n\n---\nlayout: [oops\n---\n\ntext\n', '/d/slides.md'),
  );
  assert.equal(outline[0].title, 'One bold');
  assert.equal(outline[1].title, 'Slide 2');
  assert.equal(outline.length, 3);
});

test('outline: describe', async () => {
  const outline = buildOutline(await parseSlides(deck, '/deck/slides.md'));
  assert.equal(describe(outline[2]), 'center · ~5 clicks');
  assert.equal(describe(outline[6]), 'default · 7 clicks');
  assert.equal(describe(outline[5]), 'default · hidden');
  assert.equal(describe(outline[2], false), 'center');
});

test('command lines: quoting and refusal', () => {
  assert.equal(
    commandLine('npx --no-install slide-ng', 'dev', 'slides.md', portOption(4230)),
    'npx --no-install slide-ng dev "slides.md" --port 4230',
  );
  assert.equal(pathArg('talks\\my deck/slides.md'), '"talks/my deck/slides.md"');
  for (const bad of ['a";rm -rf ~;"', 'a$(x).md', 'a`x`.md', '../x.md', 'a&b.md', "a'b.md", '%PATH%.md'])
    assert.throws(() => pathArg(bad), /cannot be passed/, bad);
  assert.deepEqual(exportOptions('pdf', true), ['--format', 'pdf', '--with-clicks']);
  assert.deepEqual(exportOptions('png', false), ['--format', 'png']);
  assert.throws(() => exportOptions('exe; calc', false));
  assert.throws(() => portOption(70000));
  assert.throws(() => portOption(1.5));
});

test('entry: default, setting, confinement', () => {
  const have =
    (...files: string[]) =>
    (p: string) =>
      files.includes(p);
  assert.deepEqual(resolveEntry('/w', '', have('/w/slides.md')), { path: '/w/slides.md' });
  assert.deepEqual(resolveEntry('/w', undefined, have()), {});
  assert.deepEqual(resolveEntry('/w', 'talks/a.md', have('/w/talks/a.md')), { path: '/w/talks/a.md' });
  assert.match(resolveEntry('/w', 'talks/a.md', have()).problem!, /does not exist/);
  assert.match(resolveEntry('/w', '../x.md', have('/x.md')).problem!, /outside/);
  assert.match(resolveEntry('/w', '/etc/x.md', have('/etc/x.md')).problem!, /outside/);
  assert.match(resolveEntry('/w', 'a.txt', have('/w/a.txt')).problem!, /not a \.md/);
});

test('status text', () => {
  assert.equal(statusText({ state: 'running', port: 4230, current: 3, total: 12 }), '$(broadcast) slide.ng :4230 3/12');
  assert.equal(statusText({ state: 'stopped', port: 4230 }), '$(circle-outline) slide.ng');
  assert.equal(
    statusText({ state: 'starting', port: 4230, current: 1, total: 2 }),
    '$(sync~spin) slide.ng starting 1/2',
  );
  assert.equal(statusText({ state: 'busy', port: 4300 }), '$(warning) slide.ng port 4300 in use');
  assert.equal(previewUrl(4230, 7), 'http://localhost:4230/7');
  assert.equal(previewUrl(4230, 0), 'http://localhost:4230/1');
});

test('probe: what counts as a slide.ng server', async () => {
  assert.equal(isSlideNg(200, '{"token":"abc","remote":false}'), true);
  assert.equal(isSlideNg(401, '{"error":"password required"}'), true);
  assert.equal(isSlideNg(200, '<html>hello</html>'), false);
  assert.equal(isSlideNg(404, '{"error":"not found"}'), false);
  assert.equal(isSlideNg(200, '{"token":1}'), false);
});

test('probe: against small local servers', async () => {
  const listen = (handler: Parameters<typeof createServer>[1]) =>
    new Promise<{ port: number; close: () => void }>((ok) => {
      const s = createServer(handler).listen(0, '127.0.0.1', () =>
        ok({ port: (s.address() as { port: number }).port, close: () => s.close() }),
      );
    });
  const real = await listen((req, res) => {
    assert.equal(req.url, '/__slide-ng/session');
    res.writeHead(200, { 'content-type': 'application/json' }).end('{"token":"t","remote":false}');
  });
  const other = await listen((_req, res) => res.writeHead(200).end('hello'));
  assert.equal(await probe(real.port), 'slide-ng');
  assert.equal(await probe(other.port), 'other');
  real.close();
  other.close();
  assert.equal(await probe(real.port), 'down');
});
