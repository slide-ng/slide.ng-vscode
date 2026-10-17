// An estimate of how many clicks a slide takes, from its text alone. The core works this out in the browser while the
// slide runs (every `slide-ng-click` registers itself), so this can differ for computed values; the outline marks it as an estimate.
//
// Counted: `slide-ng-click` (bare, "3", "+2" and the `[slide-ng-click]="[2, 4]"` range), `<slide-ng-clicks>` (list items, table rows or other blocks), `<slide-ng-click-gap size>`, and
// every `|` in a code fence's `{1|3|all}` range. `slide-ng-after` adds nothing. A `clicks:` number in the frontmatter wins.

export interface ClickCount {
  count: number;
  /** True when the slide fixes it with `clicks:`. */
  fixed: boolean;
}

const FENCE = /^([ \t]*)(`{3,}|~{3,})([^\n]*)\n[\s\S]*?\n\1\2[`~]*[ \t]*(?:\n|$)/gm;
const TAG = /<([a-zA-Z][\w-]*)((?:\s+[^\s=>"'/]+(?:\s*=\s*(?:"[^"]*"|'[^']*'))?)*)\s*\/?>/g;
const ATTR = /([^\s=>"']+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'))?/g;
// The second line of a GFM table, such as `| --- | :-: |` or `--- | ---`.
const TABLE_DELIMITER = /^\s*\|?\s*:?-+:?\s*(?:\|\s*:?-+:?\s*)+\|?\s*$|^\s*\|\s*:?-+:?\s*\|\s*$/;
const LIST_ITEM = /^(\s*)(?:[-*+]|\d+[.)])\s+\S/;

export function estimateClicks(content: string, frontmatter: Record<string, unknown> = {}): ClickCount {
  const fixed = Number(frontmatter.clicks);
  if (frontmatter.clicks != null && Number.isFinite(fixed) && fixed >= 0)
    return { count: Math.floor(fixed), fixed: true };

  // Code fences: their info strings add clicks, their text is not markup. Blank them out, keeping the line count.
  let cursor = 0;
  let max = 0;
  const step = (n: number) => {
    cursor += n;
    max = Math.max(max, cursor);
  };
  const jump = (to: number) => {
    cursor = to;
    max = Math.max(max, to);
  };

  const withoutCode = content.replace(FENCE, (block, _indent, _fence, info: string) => {
    const range = /\{([^}:]*\|[^}:]*)\}/.exec(info);
    if (range) step(range[1].split('|').length - 1);
    return block.replace(/[^\n]/g, ' ');
  });

  clicksInTags(withoutCode, step, jump);
  return { count: max, fixed: false };
}

function clicksInTags(text: string, step: (n: number) => void, jump: (to: number) => void): void {
  // <slide-ng-clicks> ... </slide-ng-clicks>: as in the core, a single list gives each item a click (to `depth`), a single
  // table each body row, and anything else each block; `every` items share a click (`every="0.5"` gives each two).
  const withoutLists = text.replace(
    /<slide-ng-clicks\b([^>]*)>([\s\S]*?)<\/slide-ng-clicks>/g,
    (_all, attrs: string, body: string) => {
      const every = Number(attr(attrs, 'every')) > 0 ? Number(attr(attrs, 'every')) : 1;
      const depth = Math.max(1, Number(attr(attrs, 'depth')) || 1);
      const items = childCount(body, depth);
      step(Math.ceil(items / every));
      return '';
    },
  );

  for (const [, name, attrs] of withoutLists.matchAll(TAG)) {
    if (name === 'slide-ng-click-gap') {
      step(Number(attr(attrs, 'size')) || 1);
      continue;
    }
    const values = attributes(attrs);
    const click = values.get('slide-ng-click');
    const bound = values.get('[slide-ng-click]');
    if (bound !== undefined) {
      const numbers = [...bound.matchAll(/\d+/g)].map((m) => Number(m[0]));
      if (numbers.length) jump(Math.max(...numbers));
    } else if (click !== undefined) {
      if (/^\+\d+$/.test(click.trim())) step(Number(click.trim().slice(1)));
      else if (/^\d+$/.test(click.trim())) jump(Number(click.trim()));
      else step(1); // bare `slide-ng-click`
    } else if (values.has('slide-ng-click-hide')) {
      step(1);
    }
  }
}

/** What `<slide-ng-clicks>` gives a click to, counted from its markdown. */
function childCount(body: string, depth: number): number {
  const lines = body.split('\n').filter((line) => line.trim() !== '');
  if (!lines.length) return 0;
  if (lines.length >= 2 && TABLE_DELIMITER.test(lines[1]) && lines.every((line) => line.includes('|'))) {
    // A table, with or without the outer pipes: the header and the delimiter row are not body rows.
    return lines.length - 2;
  }
  if (LIST_ITEM.test(lines[0]) && lines.every((line) => LIST_ITEM.test(line) || /^\s+\S/.test(line))) {
    return lines.filter((line) => {
      const item = LIST_ITEM.exec(line);
      return item !== null && item[1].replace(/\t/g, '  ').length < 2 * depth;
    }).length;
  }
  // Anything else: one click per block (blocks are separated by empty lines).
  return body.split(/\n\s*\n/).filter((block) => block.trim() !== '').length;
}

/** The attributes of a tag as name -> value ('' when there is none). */
function attributes(attrText: string): Map<string, string> {
  const out = new Map<string, string>();
  for (const m of attrText.matchAll(ATTR)) out.set(m[1], m[2] ?? m[3] ?? '');
  return out;
}

const attr = (attrText: string, name: string) => attributes(attrText).get(name);
