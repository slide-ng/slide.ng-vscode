// Loads the slide.ng grammar into vscode-textmate with the grammars it builds on (from the tm-grammars
// package, which carries the same TextMate files VS Code ships), and turns a text into scoped tokens.
import { readdirSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import textmate from 'vscode-textmate';
import oniguruma from 'vscode-oniguruma';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const grammarDir = join(root, 'node_modules/tm-grammars/grammars');

// scope name -> file, for every grammar the base grammars may include
const files = new Map<string, string>();
for (const name of readdirSync(grammarDir)) {
  const file = join(grammarDir, name);
  files.set(JSON.parse(readFileSync(file, 'utf8')).scopeName, file);
}
files.set('text.html.markdown.slide-ng', join(root, 'syntaxes/slide-ng.tmLanguage.json'));
files.set('slide-ng.fences', join(root, 'syntaxes/slide-ng-fences.tmLanguage.json'));

const wasm = readFileSync(join(root, 'node_modules/vscode-oniguruma/release/onig.wasm'));
const onig = oniguruma.loadWASM(wasm.buffer.slice(wasm.byteOffset, wasm.byteOffset + wasm.byteLength) as ArrayBuffer);

const registry = new textmate.Registry({
  // the same link package.json makes with `injectTo`
  getInjections: (scope) => (scope === 'text.html.markdown.slide-ng' ? ['slide-ng.fences'] : undefined),
  onigLib: onig.then(() => ({
    createOnigScanner: (sources: string[]) => new oniguruma.OnigScanner(sources),
    createOnigString: (s: string) => new oniguruma.OnigString(s),
  })),
  loadGrammar: async (scope) => {
    const file = files.get(scope);
    return file ? textmate.parseRawGrammar(readFileSync(file, 'utf8'), file) : null;
  },
});

export interface Token {
  text: string;
  scopes: string[];
}

export async function tokenize(text: string): Promise<Token[][]> {
  const grammar = await registry.loadGrammar('text.html.markdown.slide-ng');
  if (!grammar) throw new Error('slide.ng grammar did not load');
  let stack = textmate.INITIAL;
  return text.split('\n').map((line) => {
    const result = grammar.tokenizeLine(line, stack);
    stack = result.ruleStack;
    return result.tokens.map((t) => ({ text: line.slice(t.startIndex, t.endIndex), scopes: t.scopes }));
  });
}

/** Neighbouring tokens that carry the same scopes are one piece of text (the YAML grammar splits words in two). */
function merged(line: Token[]): Token[] {
  const out: Token[] = [];
  for (const t of line) {
    const last = out[out.length - 1];
    if (last && last.scopes.join(' ') === t.scopes.join(' ')) last.text += t.text;
    else out.push({ text: t.text, scopes: t.scopes });
  }
  return out;
}

/** The scopes of the token on `line` (0-based) that is exactly `needle`, or else the first one that contains it. */
export function scopesOf(tokens: Token[][], line: number, needle: string): string[] {
  const pieces = merged(tokens[line]);
  const hit = pieces.find((t) => t.text === needle) ?? pieces.find((t) => t.text.includes(needle));
  if (!hit) throw new Error(`no token with "${needle}" on line ${line + 1}: ${JSON.stringify(pieces.map((t) => t.text))}`);
  return hit.scopes;
}
