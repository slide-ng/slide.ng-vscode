// Reads the extension's settings (see "contributes.configuration" in package.json).
import * as vscode from 'vscode';

const section = (scope?: vscode.Uri) => vscode.workspace.getConfiguration('slide-ng', scope);

export const settings = {
  entry: (folder: vscode.Uri) => section(folder).get<string>('entry', ''),
  cliCommand: () => section().get<string>('cli.command', 'npx --no-install slide-ng'),
  port: () => section().get<number>('dev.port', 4230),
  lang: () => section().get<string>('lang', ''),
  followCursor: () => section().get<boolean>('preview.followCursor', true),
  openOnStart: () => section().get<boolean>('preview.openOnStart', true),
  showClicks: () => section().get<boolean>('outline.showClicks', true),
  exportFormat: () => section().get<string>('export.format', 'pdf'),
  exportWithClicks: () => section().get<boolean>('export.withClicks', false),
};
