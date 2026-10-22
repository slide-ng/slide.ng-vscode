// The dev server: `slide-ng dev` in an integrated terminal of its own. We do not bundle the CLI; the command line comes
// from the `slide-ng.cli.command` setting and runs in the deck's folder, where the project's own slide-ng is installed.
//
// Whether it runs is not read from the terminal but asked of the port (probe.ts) every second or so, so a server that
// was started by hand is noticed too.
import * as vscode from 'vscode';
import { settings } from './config.ts';
import type { Deck } from './deck.ts';
import { probe } from './probe.ts';
import { commandLine, langOption, portOption } from './shell.ts';
import type { ServerState } from './status-text.ts';

const TERMINAL = 'slide.ng dev server';

export class DevServer implements vscode.Disposable {
  state: ServerState = 'stopped';
  /** Running, but not in our terminal. */
  external = false;
  port = settings.port();

  private terminal?: vscode.Terminal;
  private timer?: ReturnType<typeof setTimeout>;
  private disposed = false;
  private readonly changed = new vscode.EventEmitter<void>();
  readonly onDidChange = this.changed.event;
  private readonly subscriptions: vscode.Disposable[];

  constructor(private readonly deck: Deck) {
    this.subscriptions = [
      this.changed,
      vscode.window.onDidCloseTerminal((t) => {
        if (t === this.terminal) this.terminal = undefined;
      }),
    ];
    void this.poll();
  }

  /** Starts the server in a terminal, unless one already answers on the port. */
  async start(): Promise<void> {
    if (!vscode.workspace.isTrusted)
      throw new Error("Trust this workspace to run the dev server: it runs the project's own slide-ng.");
    if (!this.deck.entry || !this.deck.folder)
      throw new Error('No slide.ng deck found (a slides.md, or the slide-ng.entry setting).');
    this.port = settings.port();
    const found = await probe(this.port);
    if (found === 'slide-ng') return void (await this.refresh());
    if (found === 'other') throw new Error(`Port ${this.port} is used by something else. Change slide-ng.dev.port.`);
    const entry = vscode.workspace.asRelativePath(this.deck.entry, false);
    const line = commandLine(settings.cliCommand(), 'dev', entry, [
      ...portOption(this.port),
      ...langOption(settings.lang()),
    ]);
    this.terminal?.dispose();
    this.terminal = vscode.window.createTerminal({ name: TERMINAL, cwd: this.deck.folder.uri.fsPath });
    this.terminal.show(true); // keep the focus in the editor
    this.terminal.sendText(line);
    await this.refresh();
  }

  /** Sends Ctrl+C to our terminal and closes it. A server started elsewhere is not ours to stop. */
  async stop(): Promise<void> {
    const terminal = this.terminal;
    if (!terminal) {
      if (this.state === 'running')
        throw new Error('This server was not started from this window; stop it where it runs.');
      return;
    }
    terminal.sendText('\u0003', false);
    setTimeout(() => terminal.dispose(), 2000);
    this.terminal = undefined;
    await this.refresh();
  }

  showTerminal() {
    this.terminal?.show();
  }

  /** Looks at the port now and then again after a while. */
  private async poll(): Promise<void> {
    if (this.disposed) return;
    await this.refresh();
    if (this.disposed) return;
    const busy = this.terminal !== undefined || this.state !== 'stopped';
    this.timer = setTimeout(() => void this.poll(), busy ? 1500 : 5000);
  }

  private async refresh(): Promise<void> {
    if (!this.deck.isDeck) return this.set('stopped', false);
    this.port = settings.port();
    const found = await probe(this.port);
    if (found === 'slide-ng') this.set('running', this.terminal === undefined);
    else if (found === 'other') this.set('busy', false);
    else this.set(this.terminal ? 'starting' : 'stopped', false);
  }

  private set(state: ServerState, external: boolean) {
    if (state === this.state && external === this.external) return;
    this.state = state;
    this.external = external;
    this.changed.fire();
  }

  dispose() {
    this.disposed = true;
    clearTimeout(this.timer);
    this.subscriptions.forEach((d) => d.dispose());
    // The terminal is left alone: closing the window should not kill a server somebody is using.
  }
}
