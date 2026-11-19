// Bundles the CLI's pure modules into playground/index.html (single file, no network, works from file://).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const rd = (p) => fs.readFileSync(path.join(root, p), 'utf8');
const strip = (s, rename) => {
  s = s.split('// --- node-only ---')[0].replace(/^import .*$/gm, '').replace(/^export /gm, '');
  return rename ? s.replace('function parse(', `function ${rename}(`) : s;
};

export const buildCore = () => [
  strip(rd('src/brief.js')), strip(rd('src/extract.js')),
  strip(rd('src/readers/claude.js'), 'parseClaude'), strip(rd('src/readers/codex.js'), 'parseCodex'),
].join('\n');

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const f = (p) => fs.readFileSync(path.join(root, 'test/fixtures/home', p), 'utf8');
  const samples = {
    claude: f('.claude/projects/-tmp-proj/c1c1c1c1-0000-4000-8000-000000000001.jsonl'),
    codex: f('.codex/sessions/2026/05/07/rollout-2026-05-07T18-02-01-019e0000-aaaa-7000-8000-000000000002.jsonl'),
  };
  const html = rd('playground/template.html').replace('/*CORE*/', () => buildCore()).replace('/*SAMPLES*/', () => JSON.stringify(samples).replaceAll('</', '<\\/'));
  fs.writeFileSync(path.join(root, 'playground/index.html'), html);
  console.log(`playground/index.html (${html.length} bytes)`);
}
