# Security

## Supported versions

The extension is not published yet. Only the latest commit on the main branch is supported.

## Reporting a vulnerability

Please report security problems privately, not in a public issue.

Use GitHub's private vulnerability reporting: open the **Security** tab of this repository and choose **Report a vulnerability**
(<https://github.com/slide-ng/slide.ng-vscode/security/advisories/new>).
Describe what you found, how to reproduce it and which version you used. This is a small project kept up in spare time, so there is no fixed response time. Expect an answer within a few days.

## What the extension does that matters for security

- It does not bundle `slide-ng`. It runs the project's own `slide-ng` in an integrated terminal, only after the workspace is trusted.
- The command that is run comes from the user-level setting `slide-ng.cli.command`; a workspace cannot set it.
- The deck path and the port that are put on the command line are checked first (letters, digits and a few safe characters only; no `..`).
- `slide-ng.entry` must stay inside the workspace folder.
- The preview is a webview with a content security policy. It only frames `http://localhost` (or the forwarded address of a remote window), and the only message it can send to the extension is "start the dev server".
- To see if a dev server runs, the extension asks `GET http://localhost:<port>/__slide-ng/session` and looks at the shape of the answer. It does not read or keep the session token.

Reports about the slide.ng core (the dev server, the CLI) belong to the slide.ng repository.
