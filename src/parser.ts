// Reads a deck with the parser the slide.ng core uses (@slidev/parser). Only this file imports it, so the rest of
// the extension works with the small `SlideSource` shape below.
//
// `parse` reads one file. A slide that has `src: ./other.md` stays one slide here (the core replaces it with the slides
// of that file when it builds); the outline shows it as an import.
import { parse } from '@slidev/parser';

export interface SlideSource {
  /** 1-based slide number. */
  no: number;
  /** First line of the slide's block in the file (0-based). `contentStart` is the first line after its frontmatter. */
  start: number;
  contentStart: number;
  /** First line with text in the slide's content (0-based), or `start` when it has none. */
  firstLine: number;
  /** The line after the slide (0-based, not included). */
  end: number;
  title?: string;
  frontmatter: Record<string, unknown>;
  /** The slide's text without frontmatter and notes. */
  content: string;
  hasNote: boolean;
}

export async function parseSlides(text: string, filepath: string): Promise<SlideSource[]> {
  const deck = await parse(text, filepath);
  const lines = text.split(/\r?\n/);
  const firstText = (from: number, to: number) => {
    for (let i = from; i < Math.min(to, lines.length); i++) if (lines[i].trim() !== '') return i;
    return undefined;
  };
  return deck.slides.map((s, i) => ({
    no: i + 1,
    start: s.start,
    contentStart: s.contentStart,
    firstLine: firstText(s.contentStart, s.end) ?? s.start,
    end: s.end,
    title: s.title,
    frontmatter: s.frontmatter ?? {},
    content: s.content ?? '',
    hasNote: Boolean(s.note),
  }));
}
