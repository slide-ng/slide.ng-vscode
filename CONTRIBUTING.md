# Contributing to the slide.ng VS Code extension

Thanks for helping. This is a small extension and should stay readable.

By taking part you agree to the [Code of Conduct](CODE_OF_CONDUCT.md). Report security problems privately, as [SECURITY.md](SECURITY.md) describes. By contributing you agree that your work is licensed under the [MIT license](LICENSE) of this project.

## Set up

You need Node.js 22.23.3 or newer (`.nvmrc` names the version CI uses) and VS Code to try the extension.

```sh
git clone https://github.com/slide-ng/vscode-extension.git
cd vscode-extension
npm ci
npm run build       # dist/extension.js
npm test
```

`npm ci` also sets `core.hooksPath` to `.githooks` and `commit.template` to `.gitmessage`, unless you already set them. The hooks are small:

- `pre-commit` formats the staged files with Prettier. It skips a file that also has unstaged changes.
- `commit-msg` warns when the message does not follow the commit message rules below. It never blocks the commit.

To try it in an editor: open this folder in VS Code and press F5 ("Run the extension"). Open a folder that has a `slides.md` in the new window.

## Commands

| command             | what it does                                                                    |
| ------------------- | ------------------------------------------------------------------------------- |
| `npm run build`     | bundles the extension into `dist/extension.js` (`npm run watch` rebuilds)       |
| `npm test`          | unit tests, grammar tests, commit message tests, a start-up test against a fake |
| `npm run typecheck` | TypeScript, no output                                                           |
| `npm run format`    | Prettier, writes changes (`npm run format:check` only checks)                   |
| `npm run package`   | builds a minified bundle and `slide.ng-vscode.vsix` (nothing is published)      |

Before a pull request, run the format check, the type check, `npm test` and `npm run package`. CI runs the same. The tests do not start a real VS Code, so say in the pull request if you tried the change in one.

## Layout

- `src/` the extension. Files that import `vscode` are `extension`, `commands`, `config`, `deck`, `server`, `preview`, `tree`, `status-bar`. All the others (`parser`, `outline`, `clicks`, `edit`, `entry`, `shell`, `probe`, `status-text`, `preview-url`) are plain TypeScript and have unit tests.
- `syntaxes/` the TextMate grammar. `slide-ng-fences.tmLanguage.json` is generated: edit `scripts/build-fences.mjs`, then run `node scripts/build-fences.mjs`. A test fails when the two do not match.
- `test/fixtures/` markdown used by the tests. Add a fixture and a test with every change to the grammar, the outline or the edits.
- `test/fake-vscode.ts` is a tiny stand-in for the editor API. It is not VS Code; do not use it to claim that something works in the editor.

## Code style

Small files, plain comments, few dependencies. Prettier decides the formatting (`.prettierrc`, `.editorconfig`). The runtime code is bundled, so a new dependency grows the `.vsix`.

- Do not copy code from other extensions. Ideas are fine; write the code yourself.
- The extension must not bundle the slide.ng CLI. It runs the project's own.
- Anything that ends up on a command line must go through `src/shell.ts`.

## Commit messages

`type(scope): summary`, imperative, lower case, no period, 72 characters at most, no trailer lines. An optional body, after a blank line, says why.

- Types: `feat`, `fix`, `perf`, `refactor`, `test`, `docs`, `style`, `build`, `ci`, `chore`, `revert`.
- Scopes: `grammar`, `outline`, `commands`, `preview`, `server`, `config`, `tests`, `build`, `docs`, `deps`, `ci`. Leave the scope out when a change spans several parts.

Pull requests are squash merged, so the pull request title must follow the same form. You can check a message yourself:

```sh
node scripts/commit-message.mjs --title "fix(outline): count clicks in notes"
node scripts/commit-message.mjs --range origin/main..HEAD
```

## Adding things

**A command.**

1. Declare it under `contributes.commands` in `package.json` (title, category `Slide`, an icon if it has a button), and under `menus.commandPalette` with `"when": "slide-ng.isDeck"` if it only makes sense for a deck.
2. Register it in `src/commands.ts`. Put logic that does not need `vscode` in its own file with unit tests, as `edit.ts` does.
3. Add it to `test/extension.test.ts`, which checks that every declared command is registered. Add a row to the Commands table in the README.

**A setting.** Add it under `contributes.configuration` in `package.json`, read it in `src/config.ts`, and list it in the README. A setting that changes what is run on the command line must stay a user-level (`machine`) setting.

**A grammar rule.** Edit `syntaxes/slide-ng.tmLanguage.json` (or `scripts/build-fences.mjs` for the code fences), add the case to `test/fixtures/syntax.md`, and run `npm test`.

## Pull requests

- Keep a pull request to one change, with tests and docs. Fill in the template.
- Open an issue first for large changes, so we can agree on the approach.
- Bugs and ideas go to the issue tracker. Security problems go through the private process in [SECURITY.md](SECURITY.md).

## Recognising contributions

Everyone who helps is listed in the Contributors section of the README, whatever the kind of help: code, docs, design, review or triage. To add someone, comment `@all-contributors please add @user for code` on an issue or pull request (use another type such as `doc`, `review` or `bug` when it fits). The bot opens a pull request that updates `.all-contributorsrc` and the README.
