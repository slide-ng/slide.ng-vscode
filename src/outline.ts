// The slides outline: one entry per slide, with its number, title, layout and click estimate. Plain data in and out,
// no VS Code API, so it can be tested without an editor.
import { estimateClicks } from './clicks.ts';
import type { SlideSource } from './parser.ts';

export interface OutlineItem {
  no: number;
  title: string;
  layout: string;
  clicks: number;
  clicksFixed: boolean;
  /** Line to show when the item is picked (0-based): the first line of the slide's text. */
  line: number;
  /** `src:` of an imported slide. */
  src?: string;
  /** `hide: true` or `disabled: true`: the core leaves the slide out. */
  hidden: boolean;
  hasNote: boolean;
}

/** "cover" for the first slide and "default" for the others, as the core does when `layout` is not set. */
const defaultLayout = (no: number) => (no === 1 ? 'cover' : 'default');

export function buildOutline(slides: SlideSource[]): OutlineItem[] {
  return slides.map((s) => {
    const fm = s.frontmatter;
    const src = typeof fm.src === 'string' ? fm.src : undefined;
    const title = (s.title ?? '').replace(/<[^>]+>/g, '').trim();
    const { count, fixed } = estimateClicks(s.content, fm);
    return {
      no: s.no,
      title: title || (src ? `import ${src}` : `Slide ${s.no}`),
      layout: typeof fm.layout === 'string' ? fm.layout : defaultLayout(s.no),
      clicks: count,
      clicksFixed: fixed,
      line: s.firstLine,
      src,
      hidden: fm.hide === true || fm.disabled === true,
      hasNote: s.hasNote,
    };
  });
}

/** The short grey text after the title: `center · 3 clicks`. */
export function describe(item: OutlineItem, showClicks = true): string {
  const parts = [item.layout];
  if (showClicks && item.clicks > 0)
    parts.push(`${item.clicksFixed ? '' : '~'}${item.clicks} ${item.clicks === 1 ? 'click' : 'clicks'}`);
  if (item.hidden) parts.push('hidden');
  return parts.join(' · ');
}
