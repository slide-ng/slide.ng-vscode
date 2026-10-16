// Building the command line that goes to the integrated terminal. The CLI command comes from a user-level setting; the
// other parts (the deck path, numbers) come from workspace data, so they are checked before they reach a shell.

// Letters, digits and a few characters that mean nothing special to sh, cmd or PowerShell inside double quotes.
const SAFE_PATH = /^[\w@+:,./ -]+$/;

/** A path as one quoted argument. Throws when it holds a character that could be read by a shell. */
export function pathArg(path: string): string {
  const slashes = path.replace(/\\/g, '/');
  if (!SAFE_PATH.test(slashes) || slashes.includes('..')) {
    throw new Error(
      `The deck path "${path}" has characters (or ..) that cannot be passed to a terminal safely. Rename the file or folder.`,
    );
  }
  return `"${slashes}"`;
}

/** `slide-ng dev "slides.md" --port 4230` as one line. `cli` is the user's command, for example `npx --no-install slide-ng`. */
export function commandLine(cli: string, command: 'dev' | 'export', entry: string, options: string[] = []): string {
  return [cli.trim(), command, pathArg(entry), ...options].join(' ');
}

/** The flags of `slide-ng export` from the settings. */
export function exportOptions(format: string, withClicks: boolean): string[] {
  if (!['pdf', 'png', 'pptx', 'md'].includes(format)) throw new Error(`Unknown export format "${format}".`);
  return ['--format', format, ...(withClicks ? ['--with-clicks'] : [])];
}

export function portOption(port: number): string[] {
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error(`"${port}" is not a port number.`);
  return ['--port', String(port)];
}
