// Entry point: builds the parts and wires them together. Nothing runs unless the workspace has a deck.
import * as vscode from 'vscode';
import { registerCommands } from './commands.ts';
import { settings } from './config.ts';
import { Deck } from './deck.ts';
import { Preview } from './preview.ts';
import { DevServer } from './server.ts';
import { StatusBar } from './status-bar.ts';
import { SlidesTree } from './tree.ts';

export async function activate(context: vscode.ExtensionContext): Promise<void> {
  const deck = new Deck();
  const server = new DevServer(deck);
  const preview = new Preview(server, () => void vscode.commands.executeCommand('slide-ng.startServer'));
  context.subscriptions.push(deck, server, preview, new SlidesTree(deck), new StatusBar(deck, server));
  registerCommands(context, deck, server, preview);

  // Keep an open preview on the slide the cursor is on, and show the page when the server comes up.
  let timer: ReturnType<typeof setTimeout> | undefined;
  context.subscriptions.push(
    deck.onDidChangeCurrent((no) => {
      if (!settings.followCursor()) return;
      clearTimeout(timer);
      timer = setTimeout(() => void preview.goto(no), 250);
    }),
    server.onDidChange(() => void preview.goto(deck.current)),
    { dispose: () => clearTimeout(timer) },
  );

  await deck.detect();
}

export function deactivate(): void {}
