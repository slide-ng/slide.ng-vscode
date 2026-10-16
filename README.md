# slide.ng for VS Code

Editor support for [slide.ng](https://github.com/slide-ng/slide.ng) decks (presentations written in `slides.md`, with Angular template syntax inside).

**Status: first version, not released.** The parts that do not need an editor are tested; running inside VS Code was not checked (see [Status](#status)).

## Features

- **Syntax highlighting** for `slides.md` (language `slide-ng`, a markdown grammar with additions):
  - `---` slide separators and per-slide frontmatter as YAML
  - code fence options: `{monaco}`, `{monaco-diff}`, `{monaco-run}`, line ranges such as `{2,3|5|all}`, `[title.ts]`, `{lines:true}` objects, `magic-move`, and `<<< ./file.ts#region` snippet lines
  - Angular in markdown: `@if` / `@else` / `@for` / `@switch` / `@defer` lines and `@let`, `{{ }}`, `[input]`, `(event)`, `#ref`, `*directive` attributes (the only `*` keyword style in the slide.ng syntax), and the `v-click` family
  - `::slot::` lines, and `[click]` markers in speaker notes
- **Slides outline** in the side bar: number, title, layout and estimated click count of every slide, read with `@slidev/parser` (the parser the slide.ng core uses). Click a slide to jump to it.
- **Dev server**: start and stop `slide-ng dev` in an integrated terminal, with the port you set.
- **Preview** in a side panel that shows the running dev server and follows the slide under your cursor, or in your browser.
- **Edit slides** from the outline or the command palette: move up, move down, new slide below, duplicate.
- **Export**: runs `slide-ng export` in a terminal.
- **Status bar**: current slide and server state (stopped, starting, running, port in use). Click it to start the server or open the preview.

The extension turns on when the workspace has a `slides.md` in a folder, or when `slide-ng.entry` points to a deck file.

## It does not include slide.ng

The extension has no copy of the CLI. It runs your project's own `slide-ng` (by default `npx --no-install slide-ng`, in the deck's folder), so the version you installed is the version that runs. Install slide.ng in your project first.

## Install

There is no marketplace release yet. Build a `.vsix` and install it:

```sh
npm ci
npm run package
code --install-extension slide.ng-vscode.vsix
```

## Commands

All are in the command palette under `Slide:` when the workspace is a deck.

| Command                        | What it does                                                                              |
| ------------------------------ | ----------------------------------------------------------------------------------------- |
| Slide: Start Dev Server        | runs `slide-ng dev "<deck>" --port <port>` in a terminal; opens the preview when it is up |
| Slide: Stop Dev Server         | sends Ctrl+C to that terminal and closes it                                               |
| Slide: Open Preview            | opens the side panel on the current slide (starts the server if it is not running)        |
| Slide: Open Preview in Browser | opens `http://localhost:<port>/<slide>`                                                   |
| Slide: Go to Slide...          | asks for a number; the outline rows do the same when clicked                              |
| Slide: Move Slide Up / Down    | swaps the slide with its neighbour (buttons on each outline row)                          |
| Slide: New Slide Below         | adds `---` and `# New slide` below the slide                                              |
| Slide: Duplicate Slide         | copies the slide (for slide 1: the text, not the headmatter)                              |
| Slide: Export                  | asks for the format, then runs `slide-ng export "<deck>" --format <f>`                    |

Edits change the text of the open file as one undo step; they do not save it. Slide 1 carries the deck's headmatter, so it cannot be moved and nothing goes above it. After each edit the file is parsed again, and if the number of slides is not what it should be, the edit is dropped.

## Settings

| Setting                         | Default                     | Meaning                                                                                |
| ------------------------------- | --------------------------- | -------------------------------------------------------------------------------------- |
| `slide-ng.entry`                | `""` (means `slides.md`)    | deck file, relative to the workspace folder; must be a `.md` file inside it            |
| `slide-ng.cli.command`          | `npx --no-install slide-ng` | how to run the project's slide-ng. **User setting only**: a workspace cannot change it |
| `slide-ng.dev.port`             | `4230`                      | `--port` of the dev server; where the status bar and preview look for it               |
| `slide-ng.preview.followCursor` | `true`                      | move an open preview to the slide under the cursor                                     |
| `slide-ng.preview.openOnStart`  | `true`                      | open the preview after Start Dev Server                                                |
| `slide-ng.outline.showClicks`   | `true`                      | show the click estimate in the outline                                                 |
| `slide-ng.export.format`        | `pdf`                       | format preselected by Slide: Export (`pdf`, `png`, `pptx`, `md`)                       |
| `slide-ng.export.withClicks`    | `false`                     | adds `--with-clicks`                                                                   |

Export needs a Chromium; set `CHROME_PATH` as the slide.ng README describes.

## Limits you should know

- **The language mode replaces Markdown for `slides.md`.** Features tied to the `markdown` language (the built-in Markdown preview button, Markdown link completion) are not active in a file in `slide-ng` mode. Switch the mode back, or use the slide.ng preview. For a deck file with another name, add `"files.associations": { "my-deck.md": "slide-ng" }`.
- **Frontmatter and blank lines.** The grammar ends a frontmatter block at the closing `---` or at the first blank line. YAML with blank lines inside a block is highlighted only up to the blank line.
- **Fence options** are only coloured on fences whose options contain `{`, `[`, `magic-move` or `twoslash`, for these languages: ts, tsx, js, jsx, html, css, scss, json, yaml, md, sh, py. Other languages get coloured options but plain code. Fences without options are left to the markdown grammar.
- **The click count is an estimate** from the slide's text (`v-click`, `v-clicks`, `v-click-gap`, `{1|2|all}` ranges). The core counts while the slide runs, so computed values can differ. A `clicks:` number in the frontmatter is shown as exact.
- **`src:` imports are not followed.** The outline reads one file, so a slide with `src: ./pages/intro.md` shows as one row ("import ./pages/intro.md"). Moving and duplicating such a row moves the import line.
- **Preview in remote windows** (SSH, containers, Codespaces) goes through VS Code's port forwarding. The slide.ng dev server only answers a `localhost` host name unless you start it with `--remote`, so a forwarded address may be refused. Not checked.
- The server state comes from asking `http://localhost:<port>`, so a server started by hand is noticed too, but the Stop command only stops the one this window started.

## Status

Checked, by 44 automated tests (`npm test`: 13 grammar, 10 slide edits, 12 helpers, 9 start-up):

- the grammar, with the real TextMate engine (`vscode-textmate` and `vscode-oniguruma`) on fixture markdown, using the markdown, YAML and TypeScript grammars from the `tm-grammars` package (the same upstream grammars VS Code ships);
- the outline, click estimate, slide edits (move, duplicate, new, CRLF files), entry rules, command-line building and its refusals, status text;
- the server probe, against small local servers, and once by hand against the slide.ng core's real companion server (with and without `--remote=password`);
- the extension's start-up and commands, bundled and run in Node against a small **fake** of the VS Code API (`test/fake-vscode.ts`). That checks that every declared command is registered, the outline rows, the status bar text, the exact terminal command lines, the edits to the file, and that an untrusted workspace runs nothing;
- `vsce package` produces a `.vsix` (not published).

**NOT VERIFIED: running inside VS Code.** The VS Code download used by `@vscode/test-electron` is blocked in the build environment, so nothing was run in a real editor. In particular not checked: that the extension activates; the look of the grammar with real themes; the activity bar view and tree; the webview and the iframe loading the dev server; terminal behaviour on Windows and macOS shells; start and stop with a real `slide-ng dev` (only the probe was checked against the core's companion server); the CI workflow (it has not run on GitHub).

## Development

See [CONTRIBUTING.md](CONTRIBUTING.md) for how to set up, run the tests and add a command, a setting or a grammar rule.

## Related repositories

- [slide.ng](https://github.com/slide-ng/slide.ng): the presentation tool itself.
- [slide.ng-themes](https://github.com/slide-ng/slide.ng-themes): the official themes.
- [slide.ng-starter](https://github.com/slide-ng/slide.ng-starter): a starter deck to copy.
- [slide.ng-docs](https://github.com/slide-ng/slide.ng-docs): the documentation site.
- [slide.ng-docker](https://github.com/slide-ng/slide.ng-docker): a container image for building and serving decks.
- [slide.ng-vscode](https://github.com/slide-ng/slide.ng-vscode): this extension.

These addresses are placeholders until the repositories are published.

## Contributing

Read [CONTRIBUTING.md](CONTRIBUTING.md). Changes follow the [Code of Conduct](CODE_OF_CONDUCT.md); security reports go through [SECURITY.md](SECURITY.md). Changes are listed in [CHANGELOG.md](CHANGELOG.md).

The repository URL in `package.json` (`https://github.com/slide-ng/slide.ng-vscode`) and the publisher name (`slide-ng`) are placeholders.

## Maintainers

<!-- prettier-ignore-start -->
<table>
  <tbody>
    <tr>
      <td align="center" valign="top" width="14.28%"><a href="https://github.com/erkamyaman"><img src="https://avatars.githubusercontent.com/u/88717125?v=4&s=100" width="100px;" alt="Erkam Yaman"/><br /><sub><b>Erkam Yaman</b></sub></a><br /><sub>Lead maintainer</sub></td>
    </tr>
  </tbody>
</table>
<!-- prettier-ignore-end -->

## Contributors

Thanks to everyone who has helped. This project follows the [all-contributors](https://allcontributors.org) specification. Contributions of any kind welcome!

<!-- ALL-CONTRIBUTORS-LIST:START - Do not remove or modify this section -->
<!-- prettier-ignore-start -->
<!-- markdownlint-disable -->
<table>
  <tbody>
    <tr>
      <td align="center" valign="top" width="14.28%"><a href="https://github.com/erkamyaman"><img src="https://avatars.githubusercontent.com/u/88717125?v=4?s=100" width="100px;" alt="Erkam Yaman"/><br /><sub><b>Erkam Yaman</b></sub></a><br /><a href="https://github.com/slide-ng/slide.ng-vscode/commits?author=erkamyaman" title="Code">💻</a> <a href="https://github.com/slide-ng/slide.ng-vscode/commits?author=erkamyaman" title="Documentation">📖</a> <a href="#maintenance-erkamyaman" title="Maintenance">🚧</a></td>
    </tr>
  </tbody>
</table>

<!-- markdownlint-restore -->
<!-- prettier-ignore-end -->

<!-- ALL-CONTRIBUTORS-LIST:END -->

## Sponsors

The slide.ng extension is free and open source. If it helps your work, please consider sponsoring it. Your support keeps development going.

<p>
  <a href="https://github.com/sponsors/erkamyaman"><img src="https://img.shields.io/badge/Sponsor-%E2%9D%A4-db61a2?logo=githubsponsors&logoColor=white" alt="Sponsor on GitHub" /></a>
</p>

## License

MIT, see [LICENSE](LICENSE). The ideas for the grammar and the outline came from looking at other editor extensions for presentation tools; no code was copied.

## Credits and disclaimer

The extension reads decks with [`@slidev/parser`](https://github.com/slidevjs/slidev) (MIT, Anthony Fu and Slidev contributors); see [NOTICE](NOTICE) and [THIRD-PARTY-NOTICES.md](THIRD-PARTY-NOTICES.md) for the licence texts of everything bundled.

slide.ng is an independent open-source project. It is not affiliated with or endorsed by the Angular team or Google, or by Slidev. Angular is a trademark of Google LLC. Slidev is a project of its own maintainers; the names are used here only to describe what slide.ng works with. This is a plain notice, not legal advice.
