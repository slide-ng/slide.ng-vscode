// Addresses of the dev server. How a slide is put in the address depends on the headmatter's `routerMode`:
//   history (default)  /<slide number>
//   hash               /#/<slide number>
//   memory             the address never changes; the deck reads a `#/<slide number>` once, when the page loads. The
//                      query (`?slide=<n>`) makes each address a new page, so the preview loads it again instead of only
//                      changing the part after the #, which the deck would not read.
export type RouterMode = 'history' | 'hash' | 'memory';

/** The `routerMode` of a headmatter (the first slide's frontmatter). Anything else is the default, `history`. */
export function routerModeOf(headmatter: Record<string, unknown> | undefined): RouterMode {
  const mode = headmatter?.routerMode;
  return mode === 'hash' || mode === 'memory' ? mode : 'history';
}

export function previewUrl(port: number, slide = 1, mode: RouterMode = 'history'): string {
  const no = Math.max(1, Math.floor(slide));
  const origin = `http://localhost:${port}`;
  if (mode === 'hash') return `${origin}/#/${no}`;
  if (mode === 'memory') return `${origin}/?slide=${no}#/${no}`;
  return `${origin}/${no}`;
}
