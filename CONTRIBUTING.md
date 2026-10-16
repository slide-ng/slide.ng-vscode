# Contributing

Thanks for helping. This is a small extension and should stay readable.

## Set up

You need Node 22 or newer.

```sh
npm ci
npm run build       # dist/extension.js
npm test            # unit tests, grammar tests, a start-up test against a fake editor API
npm run typecheck
npm run format      # prettier
npm run package     # slide.ng-vscode.vsix (nothing is published)
```

To try it in an editor: open this folder in VS Code and press F5 ("Run the extension"). Open a folder that has a `slides.md` in the new window.

## Layout

- `src/` the extension. Files that import `vscode` are `extension`, `commands`, `config`, `deck`, `server`, `preview`, `tree`, `status-bar`. All the others (`parser`, `outline`, `clicks`, `edit`, `entry`, `shell`, `probe`, `status-text`, `preview-url`) are plain TypeScript and have unit tests.
- `syntaxes/` the TextMate grammar. `slide-ng-fences.tmLanguage.json` is generated: edit `scripts/build-fences.mjs`, then run `node scripts/build-fences.mjs`. A test fails when the two do not match.
- `test/fixtures/` markdown used by the tests. Add a fixture and a test with every change to the grammar, the outline or the edits.
- `test/fake-vscode.ts` is a tiny stand-in for the editor API. It is not VS Code; do not use it to claim that something works in the editor.

## Rules

- Keep files small and comments plain. Few dependencies: the runtime code is bundled, so a new dependency grows the `.vsix`.
- Do not copy code from other extensions. Ideas are fine; write the code yourself.
- The extension must not bundle the slide.ng CLI. It runs the project's own.
- Anything that ends up on a command line must go through `src/shell.ts`.
- Commit messages: a short sentence in the imperative ("Add ...", "Fix ..."), one logical change per commit.

## Reporting problems

Bugs and ideas go to the issue tracker. Security problems go through the private process in [SECURITY.md](SECURITY.md).
