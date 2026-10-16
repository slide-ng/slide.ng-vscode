import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checked, duplicateSlide, EditError, moveSlide, newSlideBelow, slideAtLine } from '../src/edit.ts';
import { parseSlides } from '../src/parser.ts';

const deck = readFileSync(new URL('./fixtures/deck.md', import.meta.url), 'utf8');
const FILE = '/deck/slides.md';

const titles = async (text: string) =>
  (await parseSlides(text, FILE)).map((s) => s.title ?? `(${String(s.frontmatter.src ?? s.frontmatter.layout)})`);

test('fixture is read as expected', async () => {
  assert.deepEqual(await titles(deck), [
    'Demo deck',
    'Plain slide',
    'Centered',
    '(./pages/intro.md)',
    'Two columns',
    'Hidden one',
    'Fixed clicks',
  ]);
});

test('move a slide down and up; slides keep their frontmatter', async () => {
  const slides = await parseSlides(deck, FILE);
  const down = moveSlide(deck, slides, 3, 4);
  assert.deepEqual(await titles(down.text), [
    'Demo deck',
    'Plain slide',
    '(./pages/intro.md)',
    'Centered',
    'Two columns',
    'Hidden one',
    'Fixed clicks',
  ]);
  const moved = await parseSlides(down.text, FILE);
  assert.equal(moved[3].frontmatter.layout, 'center');
  assert.equal(moved[3].frontmatter.class, 'text-red-500');
  assert.equal(down.text.split('\n')[down.line], '---'); // the cursor goes to the moved slide's first line

  const back = moveSlide(down.text, moved, 4, 3);
  assert.equal(back.text, deck);
});

test('a slide without frontmatter keeps its separator when it moves', async () => {
  const slides = await parseSlides(deck, FILE);
  const up = moveSlide(deck, slides, 5, 2); // "Two columns" (has frontmatter) above "Plain slide" (has none)
  assert.deepEqual((await titles(up.text)).slice(0, 3), ['Demo deck', 'Two columns', 'Plain slide']);
  const down = moveSlide(deck, slides, 2, 3);
  assert.deepEqual((await titles(down.text)).slice(0, 3), ['Demo deck', 'Centered', 'Plain slide']);
});

test('slide 1 cannot move and nothing goes before it', async () => {
  const slides = await parseSlides(deck, FILE);
  assert.throws(() => moveSlide(deck, slides, 1, 2), EditError);
  assert.throws(() => moveSlide(deck, slides, 2, 1), /headmatter/);
  assert.throws(() => moveSlide(deck, slides, 9, 2), /no slide 9/);
});

test('duplicate a slide with and without frontmatter', async () => {
  const slides = await parseSlides(deck, FILE);
  const withFm = duplicateSlide(deck, slides, 3);
  assert.deepEqual((await titles(withFm.text)).slice(2, 5), ['Centered', 'Centered', '(./pages/intro.md)']);
  assert.equal((await parseSlides(withFm.text, FILE))[3].frontmatter.layout, 'center');

  const plain = duplicateSlide(deck, slides, 2);
  assert.deepEqual((await titles(plain.text)).slice(1, 4), ['Plain slide', 'Plain slide', 'Centered']);
});

test('duplicating slide 1 copies the text, not the headmatter', async () => {
  const slides = await parseSlides(deck, FILE);
  const copy = duplicateSlide(deck, slides, 1);
  const after = await parseSlides(copy.text, FILE);
  assert.equal(after.length, slides.length + 1);
  assert.equal(after[1].title, 'Welcome');
  assert.deepEqual(after[1].frontmatter, {});
  assert.equal(after[0].frontmatter.title, 'Demo deck');
});

test('new slide below any slide, including the last', async () => {
  const slides = await parseSlides(deck, FILE);
  const one = newSlideBelow(deck, slides, 1);
  assert.equal((await titles(one.text))[1], 'New slide');
  assert.equal(one.text.split('\n')[one.line], '# New slide');
  const last = newSlideBelow(deck, slides, slides.length, 'Questions');
  const titlesLast = await titles(last.text);
  assert.equal(titlesLast.at(-1), 'Questions');
  assert.equal(titlesLast.length, slides.length + 1);
  assert.ok(last.text.endsWith('# Questions\n'));
});

test('line endings are kept', async () => {
  const crlf = deck.replace(/\n/g, '\r\n');
  const slides = await parseSlides(crlf, FILE);
  const result = duplicateSlide(crlf, slides, 2);
  assert.ok(!/[^\r]\n/.test(result.text), 'every newline is still CRLF');
  assert.equal((await parseSlides(result.text, FILE)).length, slides.length + 1);
});

test('slideAtLine: the separator line belongs to the slide below it', async () => {
  const slides = await parseSlides(deck, FILE);
  const lines = deck.split('\n');
  const at = (text: string) => slideAtLine(slides, lines.indexOf(text));
  assert.equal(at('# Welcome'), 1);
  assert.equal(at('# Plain slide'), 2);
  assert.equal(at('class: text-red-500'), 3);
  assert.equal(at('## Two columns'), 5);
  assert.equal(at('# Fixed clicks'), 7);
  assert.equal(slideAtLine(slides, 0), 1);
  assert.equal(slideAtLine(slides, 9999), 7);
});

test('checked refuses an edit that changes the number of slides wrongly', async () => {
  await assert.rejects(
    () => checked(() => ({ text: deck + '\n---\n\n# extra\n', line: 0 }), FILE, 7),
    /8 slides instead of 7/,
  );
  const ok = await checked(() => ({ text: deck, line: 0 }), FILE, 7);
  assert.equal(ok.text, deck);
});
