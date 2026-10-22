// Starts the real extension code (bundled by esbuild) in Node against the small fake `vscode` in fake-vscode.ts.
// This checks the wiring. It does NOT run inside VS Code: see "Status" in the README.
import { copyFileSync, mkdtempSync, readFileSync } from 'node:fs';
import { createServer } from 'node:net';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { after, test } from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { state } from './fake-vscode.ts';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));

// A deck folder with a slides.md, and the extension bundled against the fake editor API.
const folder = mkdtempSync(join(tmpdir(), 'slide-ng-vscode-'));
copyFileSync(join(root, 'test/fixtures/deck.md'), join(folder, 'slides.md'));
await build({
  entryPoints: [join(root, 'src/extension.ts')],
  outfile: join(folder, '.bundle/extension.cjs'),
  bundle: true,
  platform: 'node',
  format: 'cjs',
  alias: { vscode: join(root, 'test/fake-vscode.ts') },
  logLevel: 'silent',
});
const extension = createRequire(import.meta.url)(join(folder, '.bundle/extension.cjs'));

const freePort = () =>
  new Promise<number>((ok) => {
    const s = createServer().listen(0, '127.0.0.1', () => {
      const { port } = s.address() as { port: number };
      s.close(() => ok(port));
    });
  });

const context = { subscriptions: [] as { dispose(): unknown }[] };
const run = (id: string, ...args: unknown[]) => state.commands.get(`slide-ng.${id}`)!(...args);
const slides = () => readFileSync(join(folder, 'slides.md'), 'utf8');
const tree = () => state.trees[0].provider;

after(() => context.subscriptions.forEach((d) => d.dispose())); // stops the polling timers

test('activation finds the deck and fills the outline and the status bar', async () => {
  state.folder = folder;
  state.config['dev.port'] = await freePort();
  await extension.activate(context);
  assert.equal(state.contexts['slide-ng.isDeck'], true);
  const rows = tree().getChildren();
  assert.equal(rows.length, 7);
  const first = tree().getTreeItem(rows[0]);
  assert.equal(first.label, '1. Demo deck');
  assert.equal(first.description, 'cover');
  assert.equal(tree().getTreeItem(rows[2]).description, 'center · ~5 clicks');
  assert.equal(tree().getTreeItem(rows[2]).command.command, 'slide-ng.goToSlide');
  const bar = state.statusBars[0];
  assert.equal(bar.visible, true);
  assert.equal(bar.text, '$(circle-outline) slide.ng 1/7');
  assert.equal(bar.command, 'slide-ng.statusAction');
});

test('every command in package.json is registered, and no other', () => {
  const declared = pkg.contributes.commands.map((c: { command: string }) => c.command).sort();
  assert.deepEqual([...state.commands.keys()].sort(), declared);
  // the menus only point at declared commands
  const used = Object.values(pkg.contributes.menus)
    .flat()
    .map((m: any) => m.command);
  for (const id of used) assert.ok(declared.includes(id), `menu uses undeclared ${id}`);
});

test('move slide down edits the file', async () => {
  await run('moveSlideDown', tree().getChildren()[2]); // "Centered" (3) goes below the src slide
  const text = slides();
  assert.ok(text.indexOf('src: ./pages/intro.md') < text.indexOf('# Centered'), 'the src slide is now above Centered');
  assert.ok(text.indexOf('# Centered') < text.indexOf('## Two columns'), 'Centered is still above Two columns');
});

test('moving slide 1 is refused with a message, the file stays', async () => {
  const before = slides();
  await run('moveSlideUp', 1);
  assert.equal(slides(), before);
  assert.match(state.messages.warning.at(-1)!, /headmatter/);
});

test('new slide and duplicate add one slide each', async () => {
  const count = () => (slides().match(/^---\s*$/gm) ?? []).length;
  const before = count();
  await run('newSlideBelow', 2);
  assert.ok(slides().includes('# New slide'));
  await run('duplicateSlide', 2);
  assert.ok(count() > before);
});

test("start runs the project's slide-ng in a terminal in the deck folder, and opens the preview", async () => {
  await run('startServer');
  const terminal = state.terminals.find((t) => t.name === 'slide.ng dev server')!;
  assert.equal(terminal.cwd, folder);
  assert.equal(terminal.sent[0], `npx --no-install slide-ng dev "slides.md" --port ${state.config['dev.port']}`);
  assert.equal(state.panels.length, 1);
  assert.equal(state.statusBars[0].text.includes('starting'), true);
  assert.deepEqual(state.panels[0].messages.at(-1), {
    kind: 'message',
    text: 'Starting the dev server...',
    canStart: false,
  });
});

test('export uses the format and the clicks setting', async () => {
  state.config['export.withClicks'] = true;
  await run('export');
  const terminal = state.terminals.find((t) => t.name === 'slide.ng export')!;
  assert.equal(terminal.sent[0], 'npx --no-install slide-ng export "slides.md" --format pdf --with-clicks');
});

test('the lang setting is passed as --lang to export', async () => {
  state.config['lang'] = 'pt-BR';
  await run('export');
  assert.match(state.terminals.at(-1)!.sent[0], / --lang pt-BR$/);
  state.config['lang'] = 'en; rm -rf ~';
  const terminals = state.terminals.length;
  await run('export');
  assert.equal(state.terminals.length, terminals);
  assert.match(state.messages.error.at(-1)!, /not a language tag/);
  delete state.config['lang'];
});

test('an untrusted workspace runs nothing', async () => {
  state.trusted = false;
  const terminals = state.terminals.length;
  await run('startServer');
  await run('export');
  assert.equal(state.terminals.length, terminals);
  assert.match(state.messages.error.at(-1)!, /Trust this workspace/);
  state.trusted = true;
});

test('a user setting for the command is used as written', async () => {
  state.config['cli.command'] = 'node node_modules/slide-ng/bin/slide-ng.mjs';
  await run('export');
  assert.match(state.terminals.at(-1)!.sent[0], /^node node_modules\/slide-ng\/bin\/slide-ng\.mjs export "slides\.md"/);
});
