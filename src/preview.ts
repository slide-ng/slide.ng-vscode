// The preview: a side panel that shows the running dev server (an iframe on http://localhost:<port>/<slide>, or the
// address the deck's `routerMode` asks for, see preview-url.ts).
// The page inside the iframe is the normal slide.ng app, so it does its own session and token handling.
import { randomBytes } from 'node:crypto';
import * as vscode from 'vscode';
import type { Deck } from './deck.ts';
import type { DevServer } from './server.ts';
import { previewUrl } from './preview-url.ts';

export class Preview implements vscode.Disposable {
  private panel?: vscode.WebviewPanel;
  private shown = '';

  constructor(
    private readonly server: DevServer,
    private readonly deck: Deck,
    private readonly onStartRequested: () => void,
  ) {}

  get isOpen(): boolean {
    return this.panel !== undefined;
  }

  /** Opens the panel beside the editor (or brings it forward) and shows `slide`. */
  async show(slide: number): Promise<void> {
    if (!this.panel) {
      this.panel = vscode.window.createWebviewPanel(
        'slide-ng.preview',
        'slide.ng preview',
        { viewColumn: vscode.ViewColumn.Beside, preserveFocus: true },
        { enableScripts: true, retainContextWhenHidden: true },
      );
      this.panel.webview.html = html();
      this.panel.onDidDispose(() => {
        this.panel = undefined;
        this.shown = '';
      });
      // The only message the page sends is a request to start the server.
      this.panel.webview.onDidReceiveMessage((m: unknown) => {
        if (m && typeof m === 'object' && (m as { command?: unknown }).command === 'start') this.onStartRequested();
      });
    } else {
      this.panel.reveal(undefined, true);
    }
    await this.goto(slide);
  }

  /** Points an open panel at `slide` (or tells that the server is not running). */
  async goto(slide: number): Promise<void> {
    if (!this.panel) return;
    if (this.server.state !== 'running') {
      this.shown = '';
      return void this.panel.webview.postMessage({
        kind: 'message',
        text: this.server.state === 'starting' ? 'Starting the dev server...' : 'The dev server is not running.',
        canStart: this.server.state === 'stopped',
      });
    }
    // asExternalUri maps localhost to the forwarded address when the window is remote.
    const url = (
      await vscode.env.asExternalUri(vscode.Uri.parse(previewUrl(this.server.port, slide, this.deck.routerMode)))
    ).toString(true);
    if (url === this.shown) return;
    this.shown = url;
    void this.panel.webview.postMessage({ kind: 'url', url });
  }

  dispose() {
    this.panel?.dispose();
  }
}

function html(): string {
  const nonce = randomBytes(16).toString('base64');
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; frame-src http://localhost:* http://127.0.0.1:* https:; style-src 'nonce-${nonce}'; script-src 'nonce-${nonce}';">
<style nonce="${nonce}">
  html, body { margin: 0; height: 100%; }
  iframe { border: 0; width: 100%; height: 100%; background: #fff; }
  #note { display: none; padding: 16px; font-family: var(--vscode-font-family); color: var(--vscode-foreground); }
  button { color: var(--vscode-button-foreground); background: var(--vscode-button-background); border: 0; padding: 6px 12px; margin-top: 8px; cursor: pointer; }
</style>
</head>
<body>
<div id="note"><div id="text"></div><button id="start" hidden>Start dev server</button></div>
<iframe id="frame" title="slide.ng preview" hidden></iframe>
<script nonce="${nonce}">
  const vscode = acquireVsCodeApi();
  const frame = document.getElementById('frame');
  const note = document.getElementById('note');
  const start = document.getElementById('start');
  start.addEventListener('click', () => vscode.postMessage({ command: 'start' }));
  window.addEventListener('message', (event) => {
    const m = event.data;
    if (m.kind === 'url') {
      note.style.display = 'none';
      frame.hidden = false;
      frame.src = m.url;
    } else if (m.kind === 'message') {
      frame.hidden = true;
      frame.removeAttribute('src');
      document.getElementById('text').textContent = m.text;
      start.hidden = !m.canStart;
      note.style.display = 'block';
    }
  });
</script>
</body>
</html>`;
}
