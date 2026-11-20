import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { COMMANDS } from '../plugin/src/commands.js';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');

test('plugin.json parses and the plugin ships no hooks: baton runs only when asked', () => {
  const p = JSON.parse(read('plugin/.claude-plugin/plugin.json'));
  assert.equal(p.name, 'baton');
  assert.ok(!p.hooks, 'no hooks in plugin.json');
  assert.ok(!fs.existsSync(path.join(root, 'plugin', 'hooks')), 'no plugin/hooks/');
});
test("every backticked `baton <cmd>` in rules, skills, prompts, README exists", () => {
  const files = ["rules/AGENTS.snippet.md", "plugin/skills/handover/SKILL.md", "plugin/skills/takeover/SKILL.md", "plugin/skills/switch/SKILL.md", "directory/skills/handover/SKILL.md", "directory/skills/takeover/SKILL.md", "directory/skills/switch/SKILL.md", "README.md"];
  for (const f of files) for (const m of read(f).matchAll(/`baton ([a-z]+)/g)) assert.ok(m[1] in COMMANDS, `${f}: baton ${m[1]}`);
});
test('rules snippet is ≤ 40 lines', () => assert.ok(read('rules/AGENTS.snippet.md').split('\n').length <= 40));
