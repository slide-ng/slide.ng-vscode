// A very small stand-in for the `vscode` module, just enough to start the extension in plain Node and watch what it
// does. It is NOT VS Code: it checks the wiring (activation, commands, tree rows, status text, terminal lines, edits),
// not how anything looks or behaves inside the editor.
import { readFileSync, writeFileSync } from 'node:fs';

type Listener<T> = (e: T) => unknown;
interface State {
  folder: string;
  trusted: boolean;
  config: Record<string, unknown>;
  commands: Map<string, (...a: any[]) => unknown>;
  contexts: Record<string, unknown>;
  terminals: { name: string; cwd?: string; sent: string[] }[];
  statusBars: { text: string; tooltip?: string; command?: string; visible: boolean }[];
  trees: { provider: any }[];
  panels: { messages: unknown[] }[];
  messages: { error: string[]; warning: string[] };
  docs: Map<string, { text: string }>;
}

export class EventEmitter<T> {
  private listeners: Listener<T>[] = [];
  event = (l: Listener<T>) => {
    this.listeners.push(l);
    return { dispose: () => (this.listeners = this.listeners.filter((x) => x !== l)) };
  };
  fire(e?: T) {
    this.listeners.forEach((l) => l(e as T));
  }
  dispose() {}
}
const none = () => new EventEmitter<any>().event;

export class Position {
  line: number;
  character: number;
  constructor(line: number, character: number) {
    this.line = line;
    this.character = character;
  }
}
export class Range {
  start: Position;
  end: Position;
  constructor(a: number | Position, b: number | Position, c?: number, d?: number) {
    this.start = typeof a === 'number' ? new Position(a, b as number) : a;
    this.end = typeof a === 'number' ? new Position(c!, d!) : (b as Position);
  }
}
export class Selection extends Range {
  active: Position;
  constructor(a: Position, b: Position) {
    super(a, b);
    this.active = b;
  }
}
export const Uri = {
  file: (fsPath: string) => ({ scheme: 'file', fsPath, path: fsPath, toString: () => `file://${fsPath}` }),
  parse: (s: string) => ({ scheme: 'http', fsPath: s, toString: () => s }),
};
export class ThemeIcon {
  id: string;
  constructor(id: string) {
    this.id = id;
  }
}
export class TreeItem {
  id?: string;
  description?: string;
  contextValue?: string;
  iconPath?: unknown;
  tooltip?: string;
  command?: unknown;
  label: string;
  collapsibleState?: number;
  constructor(label: string, collapsibleState?: number) {
    this.label = label;
    this.collapsibleState = collapsibleState;
  }
}
export class WorkspaceEdit {
  edits: { uri: any; range: Range; text: string }[] = [];
  replace(uri: any, range: Range, text: string) {
    this.edits.push({ uri, range, text });
  }
}
export const TreeItemCollapsibleState = { None: 0 };
export const StatusBarAlignment = { Left: 1 };
export const ViewColumn = { Beside: -2 };
export const TextEditorRevealType = { AtTop: 3, InCenterIfOutsideViewport: 2 };

/**
 * What a test can look at and change. The extension bundle gets its own copy of this module, so the state lives on
 * globalThis: both copies see the same object.
 */
export const state: State = ((globalThis as any).__fakeVscode ??= {
  folder: '',
  trusted: true,
  config: {} as Record<string, unknown>,
  commands: new Map<string, (...a: any[]) => unknown>(),
  contexts: {} as Record<string, unknown>,
  terminals: [] as { name: string; cwd?: string; sent: string[] }[],
  statusBars: [] as { text: string; tooltip?: string; command?: string; visible: boolean }[],
  trees: [] as { provider: any }[],
  panels: [] as { messages: unknown[] }[],
  messages: { error: [] as string[], warning: [] as string[] },
  docs: new Map<string, { text: string }>(),
} satisfies State);

function document(fsPath: string) {
  if (!state.docs.has(fsPath)) state.docs.set(fsPath, { text: readFileSync(fsPath, 'utf8') });
  const d = state.docs.get(fsPath)!;
  return {
    uri: Uri.file(fsPath),
    fileName: fsPath,
    getText: () => d.text,
    get lineCount() {
      return d.text.split('\n').length;
    },
    validateRange: (r: Range) => r,
  };
}

export const window = {
  activeTextEditor: undefined as any,
  onDidChangeActiveTextEditor: none(),
  onDidChangeTextEditorSelection: none(),
  onDidCloseTerminal: none(),
  createTreeView: (_id: string, o: { treeDataProvider: any }) => {
    state.trees.push({ provider: o.treeDataProvider });
    return { visible: false, reveal: async () => {}, dispose() {} };
  },
  createStatusBarItem: () => {
    const item: any = {
      text: '',
      visible: false,
      show() {
        this.visible = true;
      },
      hide() {
        this.visible = false;
      },
      dispose() {},
    };
    state.statusBars.push(item);
    return item;
  },
  createTerminal: (o: { name: string; cwd?: string }) => {
    const t = { name: o.name, cwd: o.cwd, sent: [] as string[] };
    state.terminals.push(t);
    return { show() {}, sendText: (s: string) => t.sent.push(s), dispose() {} };
  },
  createWebviewPanel: () => {
    const panel = { messages: [] as unknown[] };
    state.panels.push(panel);
    return {
      webview: { html: '', postMessage: async (m: unknown) => panel.messages.push(m), onDidReceiveMessage: none() },
      onDidDispose: none(),
      reveal() {},
      dispose() {},
    };
  },
  showErrorMessage: async (m: string) => void state.messages.error.push(m),
  showWarningMessage: async (m: string) => void state.messages.warning.push(m),
  showQuickPick: async (items: { label: string }[]) => items[0],
  showInputBox: async () => undefined,
  showTextDocument: async (doc: any) => {
    const editor = { document: doc, selection: { active: new Position(0, 0) }, revealRange() {} };
    return editor;
  },
};

export const workspace = {
  get isTrusted() {
    return state.trusted;
  },
  get workspaceFolders() {
    return [{ uri: Uri.file(state.folder), name: 'deck', index: 0 }];
  },
  getWorkspaceFolder: () => undefined,
  getConfiguration: () => ({
    get: (key: string, fallback: unknown) => (key in state.config ? state.config[key] : fallback),
  }),
  createFileSystemWatcher: () => ({ onDidCreate: none(), onDidDelete: none(), onDidChange: none(), dispose() {} }),
  onDidChangeTextDocument: none(),
  onDidChangeWorkspaceFolders: none(),
  onDidChangeConfiguration: none(),
  openTextDocument: async (uri: { fsPath: string }) => document(uri.fsPath),
  asRelativePath: (uri: { fsPath: string }) => uri.fsPath.replace(state.folder + '/', ''),
  applyEdit: async (edit: WorkspaceEdit) => {
    for (const e of edit.edits) {
      state.docs.set(e.uri.fsPath, { text: e.text }); // the tests replace the whole file
      writeFileSync(e.uri.fsPath, e.text);
    }
    return true;
  },
};

export const commands = {
  registerCommand: (id: string, run: (...a: any[]) => unknown) => {
    state.commands.set(id, run);
    return { dispose() {} };
  },
  executeCommand: async (id: string, ...args: unknown[]) => {
    if (id === 'setContext') state.contexts[args[0] as string] = args[1];
    else await state.commands.get(id)?.(...args);
  },
};

export const env = {
  asExternalUri: async (u: unknown) => u,
  openExternal: async () => true,
};
