// The "Slides" outline in the side bar: one row per slide.
import * as vscode from 'vscode';
import { settings } from './config.ts';
import type { Deck } from './deck.ts';
import { describe, type OutlineItem } from './outline.ts';

export class SlidesTree implements vscode.TreeDataProvider<OutlineItem>, vscode.Disposable {
  readonly view: vscode.TreeView<OutlineItem>;
  private readonly changed = new vscode.EventEmitter<void>();
  readonly onDidChangeTreeData = this.changed.event;
  private readonly disposables: vscode.Disposable[];

  constructor(private readonly deck: Deck) {
    this.view = vscode.window.createTreeView('slide-ng.slides', { treeDataProvider: this });
    this.disposables = [
      this.changed,
      this.view,
      deck.onDidChange(() => this.changed.fire()),
      deck.onDidChangeCurrent((no) => this.reveal(no)),
      vscode.workspace.onDidChangeConfiguration(
        (e) => e.affectsConfiguration('slide-ng.outline') && this.changed.fire(),
      ),
    ];
  }

  getChildren(): OutlineItem[] {
    return this.deck.items;
  }

  getParent(): undefined {
    return undefined; // a flat list; reveal() needs this
  }

  getTreeItem(item: OutlineItem): vscode.TreeItem {
    const row = new vscode.TreeItem(`${item.no}. ${item.title}`, vscode.TreeItemCollapsibleState.None);
    row.id = `${item.no}`;
    row.description = describe(item, settings.showClicks());
    row.contextValue = 'slide';
    row.iconPath = new vscode.ThemeIcon(
      item.hidden ? 'eye-closed' : item.src ? 'file-symlink-file' : item.no === this.deck.current ? 'play' : 'file',
    );
    row.tooltip = [
      `Slide ${item.no}: ${item.title}`,
      `Layout: ${item.layout}`,
      item.clicks ? `Clicks: ${item.clicksFixed ? '' : 'about '}${item.clicks}` : undefined,
      item.src ? `Imports: ${item.src}` : undefined,
      item.hasNote ? 'Has speaker notes' : undefined,
    ]
      .filter(Boolean)
      .join('\n');
    row.command = { command: 'slide-ng.goToSlide', title: 'Go to slide', arguments: [item] };
    return row;
  }

  private reveal(no: number) {
    const item = this.deck.items[no - 1];
    if (item && this.view.visible) void this.view.reveal(item, { select: true, focus: false });
    this.changed.fire(); // moves the "current" icon
  }

  dispose() {
    this.disposables.forEach((d) => d.dispose());
  }
}
