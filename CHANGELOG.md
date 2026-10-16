# Changelog

All notable changes are listed here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the extension aims to follow [Semantic Versioning](https://semver.org/) once it is published.

## [Unreleased]

## [0.1.0] - unreleased

The first version. Nothing is published yet.

### Added

- Language `slide-ng` for `slides.md`: slide separators, per-slide frontmatter (YAML), code fence options (`{monaco}`, `{2,3|5|all}`, `[title.ts]`, `{lines:true}`), `<<<` snippet imports, `::slot::` lines, Angular `@if` / `@for` / `@switch` / `@let` lines, `{{ }}`, bindings, events, `#refs`, `*directives`, `v-click` family, `[click]` markers in notes.
- Slides outline: number, title, layout, estimated clicks, read with `@slidev/parser`.
- Commands: start and stop the dev server in a terminal, open the preview in a side panel or the browser, go to slide, move up and down, new slide below, duplicate, export.
- Status bar item with the current slide and the server state.
- Settings for the entry file, CLI command, port, preview behaviour and export.
- Repository files for open source hosting: contribution guide, code of conduct, security policy, issue and pull request templates, a commit message check, git hooks and a CI workflow.

[Unreleased]: https://github.com/slide-ng/slide.ng-vscode/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/slide-ng/slide.ng-vscode/commits/main
