import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const json = (p) => JSON.parse(fs.readFileSync(path.join(root, p), 'utf8'));

test('the Codex manifest matches the Claude one on identity, and points at real files', () => {
  const c = json('plugin/.claude-plugin/plugin.json'), x = json('plugin/.codex-plugin/plugin.json');
  for (const k of ['name', 'version', 'license', 'homepage', 'repository']) assert.equal(x[k], c[k], k);
  assert.equal(x.author.name, c.author.name);
  assert.equal(x.skills, './skills/');
  for (const s of ['handover', 'takeover', 'switch']) assert.ok(fs.existsSync(path.join(root, 'plugin/skills', s, 'SKILL.md')), s);
  for (const k of ['logo', 'composerIcon']) assert.ok(fs.existsSync(path.join(root, 'plugin', x.interface[k])), k);
  assert.ok(fs.readFileSync(path.join(root, 'plugin/assets/logo.svg')).equals(fs.readFileSync(path.join(root, 'assets/logo.svg'))), 'plugin/assets/logo.svg must be a copy of assets/logo.svg');
  for (const k of ['displayName', 'shortDescription', 'developerName', 'category']) assert.ok(x.interface[k], `interface.${k}`);
});

test('the Codex marketplace lists the plugin folder with the fields Codex requires', () => {
  const m = json('.agents/plugins/marketplace.json');
  const [p] = m.plugins;
  assert.equal(p.name, json('plugin/.codex-plugin/plugin.json').name);
  assert.deepEqual(p.source, { source: 'local', path: './plugin' });
  assert.ok(fs.existsSync(path.join(root, p.source.path, '.codex-plugin/plugin.json')));
  assert.ok(p.policy.installation && p.policy.authentication && p.category);
});
