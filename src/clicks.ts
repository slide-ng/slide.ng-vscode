// An estimate of how many clicks a slide takes, from its text alone. The core works this out in the browser while the
// slide runs (every `slide-ng-click` registers itself), so this can differ for computed values; the outline marks it as an estimate.
//
// Counted as in the core's click engine (2.0): `slide-ng-click` (bare, "3", "+2", and the ranges `[slide-ng-click]="[2, 4]"`
// and `slide-ng-click="[2, 4]"`), `slide-ng-click-hide` (bare or with a click, "3"), the two together ("2" and "3": shown at
// 2, hidden at 3), modifiers (`slide-ng-click.fade.right`, `.hide`), `<slide-ng-clicks>` (list items, table rows or other
// blocks), `<slide-ng-click-gap size>`, and every `|` in a code fence's `{1|3|all}` range. `slide-ng-after` adds nothing.
// An absolute click ("3") does not move the relative counter that bare and "+n" clicks count from. A `clicks:` number in
// the frontmatter wins.

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
  const counter = new Counter();
  const withoutCode = content.replace(FENCE, (block, _indent, _fence, info: string) => {
    const range = /\{([^}:]*\|[^}:]*)\}/.exec(info);
    if (range) counter.step(range[1].split('|').length - 1);
    return block.replace(/[^\n]/g, ' ');
  });

  clicksInTags(withoutCode, counter);
  return { count: counter.max, fixed: false };
}

/** The relative position that bare and "+n" clicks count from, and the biggest click any element asks for. */
class Counter {
  offset = 0;
  max = 0;
  /** Moves the relative position on by `n` clicks (each of them a click of the slide). */
  step(n: number) {
    this.offset += n;
    this.raise(this.offset);
  }
  raise(click: number) {
    this.max = Math.max(this.max, click);
  }
}

function clicksInTags(text: string, counter: Counter): void {
  // <slide-ng-clicks> ... </slide-ng-clicks>: as in the core, a single list gives each item a click (to `depth`), a single
  // table each body row, and anything else each block; `every` items share a click (`every="0.5"` gives each two).
  const withoutLists = text.replace(
    /<slide-ng-clicks\b([^>]*)>([\s\S]*?)<\/slide-ng-clicks>/g,
    (_all, attrs: string, body: string) => {
      const every = Number(attr(attrs, 'every')) > 0 ? Number(attr(attrs, 'every')) : 1;
      const depth = Math.max(1, Number(attr(attrs, 'depth')) || 1);
      const items = childCount(body, depth);
      counter.step(Math.ceil(items / every));
      return '';
    },
  );

  for (const [, name, attrs] of withoutLists.matchAll(TAG)) {
    if (name === 'slide-ng-click-gap') {
      counter.step(Number(attr(attrs, 'size')) || 1);
      continue;
    }
    const tag = clickAttributes(attrs);
    if (tag) place(tag, counter);
  }
}

/** A click value: null (never), '+n' (relative) or a click number, as the core's `normalizeSingle`. */
type Single = null | string | number;
interface ClickTag {
  /** `slide-ng-click`'s value: '' when bare, a range when written `[a, b]`. */
  show?: string | [string, string];
  after: boolean;
  /** `slide-ng-click-hide`'s value ('' when bare), also set by the `.hide` modifier. */
  hide?: string;
}

/** The click attributes of one tag, with their modifiers (`.fade.right`, `.hide`) and `[...]` bindings read. */
function clickAttributes(attrText: string): ClickTag | undefined {
  const tag: ClickTag = { after: false };
  let found = false;
  for (const [name, value] of attributes(attrText)) {
    const m = /^(\[?)slide-ng-(click-hide|click|after)((?:\.[\w-]+)*)\]?$/.exec(name);
    if (!m) continue;
    found = true;
    const bound = m[1] === '[';
    const modifiers = m[3].split('.').filter(Boolean);
    if (m[2] === 'after') tag.after = true;
    else if (m[2] === 'click-hide') tag.hide = value;
    else tag.show = range(value) ?? (bound ? boundSingle(value) : value);
    if (modifiers.includes('hide') && m[2] !== 'click-hide') tag.hide ??= '';
  }
  return found ? tag : undefined;
}

/** `[2, 4]` (also `['+1', '+2']`) as a range; anything else is not one. */
function range(value: string): [string, string] | undefined {
  const m = /^\s*\[\s*['"]?([+-]?\d+)['"]?\s*,\s*['"]?([+-]?\d+)['"]?\s*\]\s*$/.exec(value);
  return m ? [m[1], m[2]] : undefined;
}

/** A binding that is not a range: a number or a quoted value counts, an expression is unknown here (no click). */
function boundSingle(value: string): string {
  const m = /^\s*(?:(\d+)|'([^']*)'|"([^"]*)")\s*$/.exec(value);
  return m ? (m[1] ?? m[2] ?? m[3]) : 'false';
}

function normalize(value: string | undefined): Single {
  const v = (value ?? '').trim();
  if (v === 'false') return null;
  if (v === '' || v === 'true') return '+1';
  if (v[0] === '+' || v[0] === '-') return Number.isFinite(Number(v)) ? v : null;
  const n = Number(v);
  if (Number.isNaN(n)) return null;
  return n <= 0 ? 1 : n;
}

/** Works out one element's clicks like the core's `calculate` / `calculateUntil`: raises the maximum, moves the counter. */
function place(tag: ClickTag, counter: Counter): void {
  const hideOn = tag.hide !== undefined && tag.hide.trim() !== 'false';
  const hideValue = hideOn && !['', 'true'].includes(tag.hide!.trim()) ? tag.hide : undefined;
  const showAt = tag.show ?? (tag.after ? '+0' : undefined);
  if (showAt === undefined && !hideOn) return;

  // The element's own click: shown from `start` (or, with `.hide` alone, hidden from there).
  let delta: number;
  let max: number;
  let start: number;
  const offset = counter.offset;
  const at = showAt ?? hideValue;
  if (Array.isArray(at)) {
    const [a, b] = at.map((x) => normalize(x));
    if (a === null || b === null) return;
    start = typeof a === 'string' ? offset + Number(a) : a;
    delta = typeof a === 'string' ? Number(a) : 0;
    const end = typeof b === 'string' ? start + Number(b) : b;
    if (typeof b === 'string') delta += Number(b);
    max = end;
  } else {
    const single = normalize(at);
    if (single === null) return;
    start = typeof single === 'string' ? offset + Number(single) : single;
    delta = typeof single === 'string' ? Number(single) : 0;
    max = start;
  }

  // `slide-ng-click="2" slide-ng-click-hide="3"`: hidden again at the hide click.
  if (showAt !== undefined && hideValue !== undefined) {
    const h = normalize(hideValue);
    if (h !== null) {
      const relative = typeof h === 'string';
      max = Math.max(max, relative ? offset + delta + Number(h) : h);
      if (relative) delta += Number(h);
    }
  }
  counter.raise(max);
  counter.offset += delta;
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
