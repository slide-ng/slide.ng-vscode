// The deck of the workspace: which file it is, its parsed slides, and which slide the cursor is on.
// Everything else (outline, status bar, preview, commands) asks this class.
import { existsSync } from 'node:fs';
import * as vscode from 'vscode';
import { settings } from './config.ts';
import { slideAtLine } from './edit.ts';
import { resolveEntry } from './entry.ts';
import { buildOutline, type OutlineItem } from './outline.ts';
import { parseSlides, type SlideSource } from './parser.ts';

export class Deck implements vscode.Disposable {
  /** The deck file, when the workspace has one. */
  entry?: vscode.Uri;
  folder?: vscode.WorkspaceFolder;
  /** Why the `slide-ng.entry` setting was not used. */
  problem?: string;
  slides: SlideSource[] = [];
  items: OutlineItem[] = [];
  /** Set when the file could not be read as slides. */
  error?: string;
  current = 1;

  private readonly changed = new vscode.EventEmitter<void>();
  readonly onDidChange = this.changed.event;
  private readonly currentChanged = new vscode.EventEmitter<number>();
  readonly onDidChangeCurrent = this.currentChanged.event;
  private readonly disposables: vscode.Disposable[] = [];
  private timer?: ReturnType<typeof setTimeout>;

  constructor() {
    const watcher = vscode.workspace.createFileSystemWatcher('**/*.md');
    this.disposables.push(
      this.changed,
      this.currentChanged,
      watcher,
      watcher.onDidCreate(() => void this.detect()),
      watcher.onDidDelete(() => void this.detect()),
      watcher.onDidChange((uri) => this.isEntry(uri) && this.schedule()),
      vscode.workspace.onDidChangeTextDocument((e) => this.isEntry(e.document.uri) && this.schedule()),
      vscode.workspace.onDidChangeWorkspaceFolders(() => void this.detect()),
      vscode.workspace.onDidChangeConfiguration((e) => e.affectsConfiguration('slide-ng') && void this.detect()),
      vscode.window.onDidChangeActiveTextEditor(() => this.updateCurrent()),
      vscode.window.onDidChangeTextEditorSelection(
        (e) => this.isEntry(e.textEditor.document.uri) && this.updateCurrent(),
      ),
    );
  }

  get isDeck(): boolean {
    return this.entry !== undefined;
  }

  private isEntry(uri: vscode.Uri) {
    return this.entry !== undefined && uri.toString() === this.entry.toString();
  }

  /** Finds the deck file again (workspace or settings changed) and reads it. */
  async detect(): Promise<void> {
    const found = this.find();
    this.entry = found?.uri;
    this.folder = found?.folder;
    this.problem = found?.problem;
    await vscode.commands.executeCommand('setContext', 'slide-ng.isDeck', this.isDeck);
    await this.reload();
  }

  // The folder of the active editor first, then the others. A refused setting is remembered to tell the user.
  private find(): { uri?: vscode.Uri; folder?: vscode.WorkspaceFolder; problem?: string } | undefined {
    const folders = [...(vscode.workspace.workspaceFolders ?? [])];
    const active =
      vscode.window.activeTextEditor &&
      vscode.workspace.getWorkspaceFolder(vscode.window.activeTextEditor.document.uri);
    if (active) folders.sort((a, b) => Number(b === active) - Number(a === active));
    let problem: string | undefined;
    for (const folder of folders) {
      if (folder.uri.scheme !== 'file') continue; // the CLI needs a real folder
      const result = resolveEntry(folder.uri.fsPath, settings.entry(folder.uri), existsSync);
      if (result.path) return { uri: vscode.Uri.file(result.path), folder };
      problem ??= result.problem;
    }
    return problem ? { problem } : undefined;
  }

  private schedule() {
    clearTimeout(this.timer);
    this.timer = setTimeout(() => void this.reload(), 250);
  }

  async reload(): Promise<void> {
    if (!this.entry) {
      this.slides = [];
      this.items = [];
      this.error = undefined;
    } else {
      try {
        const doc = await vscode.workspace.openTextDocument(this.entry);
        this.slides = await parseSlides(doc.getText(), doc.fileName);
        this.items = buildOutline(this.slides);
        this.error = undefined;
      } catch (e) {
        // Keep the last good outline; say what went wrong.
        this.error = e instanceof Error ? e.message : String(e);
      }
    }
    this.changed.fire();
    this.updateCurrent();
  }

  /** The slide under the cursor, when the deck file is the active editor; otherwise the last one. */
  private updateCurrent() {
    const editor = vscode.window.activeTextEditor;
    if (!editor || !this.isEntry(editor.document.uri) || !this.slides.length) return;
    const now = slideAtLine(this.slides, editor.selection.active.line);
    if (now !== this.current) {
      this.current = now;
      this.currentChanged.fire(now);
    }
  }

  dispose() {
    clearTimeout(this.timer);
    this.disposables.forEach((d) => d.dispose());
  }
}
