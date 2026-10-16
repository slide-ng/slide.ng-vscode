// An estimate of how many clicks a slide takes, from its text alone. The core works this out in the browser while the
// slide runs (every `v-click` registers itself), so this can differ for computed values; the outline marks it as an estimate.
//
// Counted: `v-click` (bare, "3", "+2" and the `[v-click]="[2, 4]"` range), `<v-clicks>` lists, `<v-click-gap size>`, and
// every `|` in a code fence's `{1|3|all}` range. `v-after` adds nothing. A `clicks:` number in the frontmatter wins.

export interface ClickCount {
  count: number;
  /** True when the slide fixes it with `clicks:`. */
  fixed: boolean;
}

const FENCE = /^([ \t]*)(`{3,}|~{3,})([^\n]*)\n[\s\S]*?\n\1\2[`~]*[ \t]*(?:\n|$)/gm;
const TAG = /<([a-zA-Z][\w-]*)((?:\s+[^\s=>"'/]+(?:\s*=\s*(?:"[^"]*"|'[^']*'))?)*)\s*\/?>/g;
const ATTR = /([^\s=>"']+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'))?/g;
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
  // <v-clicks> ... </v-clicks>: one click per list item (or per `every` items).
  const withoutLists = text.replace(
    /<v-clicks\b([^>]*)>([\s\S]*?)<\/v-clicks>/g,
    (_all, attrs: string, body: string) => {
      const every = Math.max(1, Number(attr(attrs, 'every')) || 1);
      const depth = Math.max(1, Number(attr(attrs, 'depth')) || 1);
      const items = body.split('\n').filter((line) => {
        if (!LIST_ITEM.test(line)) return false;
        const indent = LIST_ITEM.exec(line)![1].replace(/\t/g, '  ').length;
        return indent < 2 * depth;
      }).length;
      step(Math.ceil(items / every));
      return '';
    },
  );

  for (const [, name, attrs] of withoutLists.matchAll(TAG)) {
    if (name === 'v-click-gap') {
      step(Number(attr(attrs, 'size')) || 1);
      continue;
    }
    const values = attributes(attrs);
    const click = values.get('v-click');
    const bound = values.get('[v-click]');
    if (bound !== undefined) {
      const numbers = [...bound.matchAll(/\d+/g)].map((m) => Number(m[0]));
      if (numbers.length) jump(Math.max(...numbers));
    } else if (click !== undefined) {
      if (/^\+\d+$/.test(click.trim())) step(Number(click.trim().slice(1)));
      else if (/^\d+$/.test(click.trim())) jump(Number(click.trim()));
      else step(1); // bare `v-click`
    } else if (values.has('v-click-hide')) {
      step(1);
    }
  }
}

/** The attributes of a tag as name -> value ('' when there is none). */
function attributes(attrText: string): Map<string, string> {
  const out = new Map<string, string>();
  for (const m of attrText.matchAll(ATTR)) out.set(m[1], m[2] ?? m[3] ?? '');
  return out;
}

const attr = (attrText: string, name: string) => attributes(attrText).get(name);
