// Bundles src/extension.ts (and @slidev/parser with its few dependencies) into dist/extension.js.
// `vscode` is provided by the editor and stays external. Run with --watch while developing.
import { build, context } from 'esbuild';

const options = {
  entryPoints: ['src/extension.ts'],
  outfile: 'dist/extension.js',
  bundle: true,
  platform: 'node',
  format: 'cjs',
  target: 'node22',
  external: ['vscode'],
  sourcemap: true,
  minify: process.argv.includes('--minify'),
  logLevel: 'info',
};

if (process.argv.includes('--watch')) await (await context(options)).watch();
else await build(options);
