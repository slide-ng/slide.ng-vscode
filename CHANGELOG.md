# Changelog

## 0.1.0 (not released)

First version.

- Language `slide-ng` for `slides.md`: slide separators, per-slide frontmatter (YAML), code fence options (`{monaco}`, `{2,3|5|all}`, `[title.ts]`, `{lines:true}`), `<<<` snippet imports, `::slot::` lines, Angular `@if` / `@for` / `@switch` / `@let` lines, `{{ }}`, bindings, events, `#refs`, `*directives`, `v-click` family, `[click]` markers in notes.
- Slides outline: number, title, layout, estimated clicks, read with `@slidev/parser`.
- Commands: start and stop the dev server in a terminal, open the preview in a side panel or the browser, go to slide, move up and down, new slide below, duplicate, export.
- Status bar item with the current slide and the server state.
- Settings for the entry file, CLI command, port, preview behaviour and export.
