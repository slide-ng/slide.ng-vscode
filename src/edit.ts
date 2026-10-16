// Changes to the deck's text: move a slide, duplicate it, add one. Text in, text out, no file or editor access.
//
// The parser says where each slide is. A slide's "block" runs from its `---` line (the separator, which is also the
// opening line of its frontmatter when it has one) up to the next block. Blocks can be cut and pasted as they are.
// Slide 1 is different: its frontmatter is the deck's headmatter and it has no separator, so it stays where it is.
import type { SlideSource } from './parser.ts';
import { parseSlides } from './parser.ts';

type Range = Pick<SlideSource, 'start' | 'contentStart' | 'end'>;

export interface Edited {
  text: string;
  /** 0-based line where the changed slide starts, for putting the cursor there. */
  line: number;
}

const isSeparator = (line: string | undefined) => /^---+\s*$/.test(line ?? '');

export class EditError extends Error {}

/** The line ranges [from, to) of every slide's block. */
function blocks(lines: string[], slides: Range[]): { from: number; to: number }[] {
  const starts = slides.map((s, i) => {
    if (i === 0) return 0;
    const from = s.contentStart > s.start ? s.start : s.start - 1;
    if (!isSeparator(lines[from]))
      throw new EditError(
        `Slide ${i + 1} does not start with a --- line where the parser says it does. Edit the file by hand.`,
      );
    return from;
  });
  let last = lines.length;
  while (last > 0 && lines[last - 1].trim() === '') last--;
  return starts.map((from, i) => ({ from, to: i + 1 < starts.length ? starts[i + 1] : last }));
}

const trimEnd = (lines: string[]) => {
  const out = [...lines];
  while (out.length && out[out.length - 1].trim() === '') out.pop();
  return out;
};

/** Slides are glued back together with one blank line between them, and the file ends with one newline. */
const join = (parts: string[][]) => parts.map(trimEnd).flatMap((p, i) => (i ? ['', ...p] : p));

/** Work with \n inside; give the file its own line ending back. `change` returns the lines and the line to reveal. */
function edit(text: string, change: (lines: string[]) => { lines: string[]; line: number }): Edited {
  const crlf = text.includes('\r\n');
  const { lines, line } = change(text.replace(/\r\n/g, '\n').split('\n'));
  const joined = lines.join('\n') + '\n';
  return { text: crlf ? joined.replace(/\n/g, '\r\n') : joined, line };
}

function check(no: number, count: number, what: string) {
  if (!Number.isInteger(no) || no < 1 || no > count)
    throw new EditError(`${what}: there is no slide ${no} (the deck has ${count}).`);
}

const FIRST = "Slide 1 carries the deck's headmatter, so it cannot be moved and nothing can go before it.";

/** Which slide a line (0-based) belongs to, 1-based. The separator line above a slide belongs to that slide. */
export function slideAtLine(slides: Range[], line: number): number {
  let found = 1;
  slides.forEach((s, i) => {
    const from = i === 0 ? 0 : s.contentStart > s.start ? s.start : s.start - 1;
    if (line >= from) found = i + 1;
  });
  return found;
}

/** Slide `from` becomes slide `to`. */
export function moveSlide(text: string, slides: Range[], from: number, to: number): Edited {
  check(from, slides.length, 'Move');
  if (from === 1 || to === 1) throw new EditError(FIRST);
  if (to > slides.length) throw new EditError('This is already the last slide.');
  check(to, slides.length, 'Move');
  return edit(text, (lines) => {
    const parts = blocks(lines, slides).map((b) => lines.slice(b.from, b.to));
    const [moved] = parts.splice(from - 1, 1);
    parts.splice(to - 1, 0, moved);
    return { lines: join(parts), line: lineOfBlock(parts, to - 1) };
  });
}

/** A copy of slide `no` right below it. For slide 1 the copy has the text but not the headmatter. */
export function duplicateSlide(text: string, slides: Range[], no: number): Edited {
  check(no, slides.length, 'Duplicate');
  return edit(text, (lines) => {
    const all = blocks(lines, slides);
    const block = lines.slice(all[no - 1].from, all[no - 1].to);
    const copy = no === 1 ? ['---', '', ...lines.slice(slides[0].contentStart, all[0].to)] : block;
    const parts = all.map((b) => lines.slice(b.from, b.to));
    parts.splice(no, 0, copy);
    return { lines: join(parts), line: lineOfBlock(parts, no) };
  });
}

/** A new slide with a heading right below slide `after`. */
export function newSlideBelow(text: string, slides: Range[], after: number, title = 'New slide'): Edited {
  check(after, slides.length, 'New slide');
  return edit(text, (lines) => {
    const parts = blocks(lines, slides).map((b) => lines.slice(b.from, b.to));
    parts.splice(after, 0, ['---', '', `# ${title}`]);
    return { lines: join(parts), line: lineOfBlock(parts, after) + 2 };
  });
}

/** The line (0-based) at which block `index` starts in the text `join` makes: each block takes its lines plus one blank. */
function lineOfBlock(parts: string[][], index: number): number {
  return parts.slice(0, index).reduce((line, p) => line + trimEnd(p).length + 1, 0);
}

/**
 * Runs an edit and parses the result again: the slide count must be what the edit should give, otherwise nothing is
 * changed. This stops a surprising file (an odd separator, a `---` inside text) from being damaged.
 */
export async function checked(make: () => Edited, filepath: string, expectedCount: number): Promise<Edited> {
  const result = make();
  const after = await parseSlides(result.text, filepath);
  if (after.length !== expectedCount) {
    throw new EditError(
      `The change would leave ${after.length} slides instead of ${expectedCount}, so nothing was changed.`,
    );
  }
  return result;
}
