// The commands. Each one is small: it finds the slide, calls a function from edit.ts or server.ts, and shows a message
// when something is refused.
import * as vscode from 'vscode';
import { settings } from './config.ts';
import type { Deck } from './deck.ts';
import { checked, duplicateSlide, EditError, moveSlide, newSlideBelow, type Edited } from './edit.ts';
import type { OutlineItem } from './outline.ts';
import { parseSlides, type SlideSource } from './parser.ts';
import type { Preview } from './preview.ts';
import { previewUrl } from './preview-url.ts';
import type { DevServer } from './server.ts';
import { commandLine, exportOptions, langOption } from './shell.ts';

export function registerCommands(
  context: vscode.ExtensionContext,
  deck: Deck,
  server: DevServer,
  preview: Preview,
): void {
  const register = (id: string, run: (...args: any[]) => unknown) =>
    context.subscriptions.push(
      vscode.commands.registerCommand(`slide-ng.${id}`, async (...args) => {
        try {
          if (!deck.isDeck)
            throw new Error(deck.problem ?? 'No slide.ng deck here: add a slides.md or set slide-ng.entry.');
          await run(...args);
        } catch (e) {
          const message = e instanceof Error ? e.message : String(e);
          if (e instanceof EditError) void vscode.window.showWarningMessage(message);
          else void vscode.window.showErrorMessage(`slide.ng: ${message}`);
        }
      }),
    );

  /** The slide a command is about: the outline row it was started from, a number, or the one under the cursor. */
  const slideNo = (arg: unknown): number =>
    typeof arg === 'number'
      ? arg
      : arg && typeof arg === 'object' && 'no' in arg
        ? (arg as OutlineItem).no
        : deck.current;

  // The server

  const start = async () => {
    await server.start();
    if (settings.openOnStart() && !preview.isOpen) await preview.show(deck.current);
  };
  register('startServer', start);
  register('stopServer', () => server.stop());

  register('openPreview', async () => {
    await preview.show(deck.current);
    if (server.state === 'stopped') await start();
  });
  register('openInBrowser', async () => {
    if (server.state !== 'running') await server.start();
    await vscode.env.openExternal(vscode.Uri.parse(previewUrl(server.port, deck.current, deck.routerMode)));
  });
  register('statusAction', async () => {
    if (server.state === 'stopped') await start();
    else if (server.state === 'running') await preview.show(deck.current);
    else if (server.state === 'starting') server.showTerminal();
    else await vscode.commands.executeCommand('workbench.action.openSettings', 'slide-ng.dev.port');
  });

  // Navigation

  register('goToSlide', async (arg?: OutlineItem | number) => {
    let no = arg === undefined ? undefined : slideNo(arg);
    if (no === undefined) {
      const text = await vscode.window.showInputBox({
        prompt: `Go to slide (1-${deck.items.length})`,
        validateInput: (v) =>
          /^\d+$/.test(v) && Number(v) >= 1 && Number(v) <= deck.items.length
            ? undefined
            : `A number from 1 to ${deck.items.length}`,
      });
      if (!text) return;
      no = Number(text);
    }
    const item = deck.items[no - 1];
    if (!item) throw new EditError(`There is no slide ${no} (the deck has ${deck.items.length}).`);
    const editor = await vscode.window.showTextDocument(deck.entry!, { preview: false });
    const at = new vscode.Position(item.line, 0);
    editor.selection = new vscode.Selection(at, at);
    editor.revealRange(new vscode.Range(at, at), vscode.TextEditorRevealType.AtTop);
    await preview.goto(no);
  });

  // Edits

  /** Applies an edit to the deck file's text as one undoable step. The file is not saved. */
  const change = async (make: (text: string, slides: SlideSource[]) => Edited, expected: (count: number) => number) => {
    const doc = await vscode.workspace.openTextDocument(deck.entry!);
    const text = doc.getText();
    const slides = await parseSlides(text, doc.fileName);
    const result = await checked(() => make(text, slides), doc.fileName, expected(slides.length));
    const edit = new vscode.WorkspaceEdit();
    edit.replace(doc.uri, doc.validateRange(new vscode.Range(0, 0, doc.lineCount, 0)), result.text);
    if (!(await vscode.workspace.applyEdit(edit))) throw new Error('VS Code did not accept the change.');
    const editor = await vscode.window.showTextDocument(doc, { preview: false });
    const at = new vscode.Position(result.line, 0);
    editor.selection = new vscode.Selection(at, at);
    editor.revealRange(new vscode.Range(at, at), vscode.TextEditorRevealType.InCenterIfOutsideViewport);
  };

  register('moveSlideUp', (arg?: unknown) =>
    change(
      (text, slides) => moveSlide(text, slides, slideNo(arg), slideNo(arg) - 1),
      (n) => n,
    ),
  );
  register('moveSlideDown', (arg?: unknown) =>
    change(
      (text, slides) => moveSlide(text, slides, slideNo(arg), slideNo(arg) + 1),
      (n) => n,
    ),
  );
  register('newSlideBelow', (arg?: unknown) =>
    change(
      (text, slides) => newSlideBelow(text, slides, slideNo(arg)),
      (n) => n + 1,
    ),
  );
  register('duplicateSlide', (arg?: unknown) =>
    change(
      (text, slides) => duplicateSlide(text, slides, slideNo(arg)),
      (n) => n + 1,
    ),
  );

  // Export

  register('export', async () => {
    if (!vscode.workspace.isTrusted) throw new Error("Trust this workspace to run the project's slide-ng.");
    const formats = ['pdf', 'png', 'pptx', 'md'];
    const preferred = settings.exportFormat();
    const format = await vscode.window.showQuickPick(
      [preferred, ...formats.filter((f) => f !== preferred)].map((f) => ({
        label: f,
        description: f === preferred ? 'from settings' : undefined,
      })),
      { placeHolder: 'Export format (needs a Chromium: set CHROME_PATH)' },
    );
    if (!format) return;
    const entry = vscode.workspace.asRelativePath(deck.entry!, false);
    const line = commandLine(settings.cliCommand(), 'export', entry, [
      ...exportOptions(format.label, settings.exportWithClicks()),
      ...langOption(settings.lang()),
    ]);
    const terminal = vscode.window.createTerminal({ name: 'slide.ng export', cwd: deck.folder!.uri.fsPath });
    terminal.show();
    terminal.sendText(line);
  });
}
