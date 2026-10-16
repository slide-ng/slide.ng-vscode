// The status bar item: the current slide and what the dev server is doing. Clicking it does the obvious next thing.
import * as vscode from 'vscode';
import type { Deck } from './deck.ts';
import type { DevServer } from './server.ts';
import { statusText, statusTooltip } from './status-text.ts';

export class StatusBar implements vscode.Disposable {
  private readonly item = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 50);
  private readonly subscriptions: vscode.Disposable[];

  constructor(
    private readonly deck: Deck,
    private readonly server: DevServer,
  ) {
    this.item.name = 'slide.ng';
    this.item.command = 'slide-ng.statusAction';
    const update = () => this.update();
    this.subscriptions = [
      this.item,
      deck.onDidChange(update),
      deck.onDidChangeCurrent(update),
      server.onDidChange(update),
    ];
    this.update();
  }

  private update() {
    if (!this.deck.isDeck) return this.item.hide();
    const input = {
      state: this.server.state,
      port: this.server.port,
      current: this.deck.current,
      total: this.deck.items.length,
      external: this.server.external,
    };
    this.item.text = statusText(input);
    this.item.tooltip = statusTooltip(input);
    this.item.show();
  }

  dispose() {
    this.subscriptions.forEach((d) => d.dispose());
  }
}
