import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { COMMANDS } from '../plugin/src/commands.js';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');

test('plugin.json and hooks.json parse; every hook runs the bundled `baton sync --hook` and never fails the agent', () => {
  assert.equal(JSON.parse(read('plugin/.claude-plugin/plugin.json')).name, 'baton');
  const h = JSON.parse(read('plugin/hooks/hooks.json')).hooks;
  assert.deepEqual(Object.keys(h).sort(), ['PreCompact', 'Stop', 'SubagentStop']);
  for (const e of Object.values(h).flat().flatMap((x) => x.hooks)) assert.equal(e.command, 'node "${CLAUDE_PLUGIN_ROOT}/cli/baton.js" sync --hook 2>/dev/null || true');
});
test("every backticked `baton <cmd>` in rules, skills, prompts, README exists", () => {
  const files = ["rules/AGENTS.snippet.md", "plugin/skills/handover/SKILL.md", "plugin/skills/takeover/SKILL.md", "plugin/skills/switch/SKILL.md", "codex/handover.md", "codex/takeover.md", "README.md"];
  for (const f of files) for (const m of read(f).matchAll(/`baton ([a-z]+)/g)) assert.ok(m[1] in COMMANDS, `${f}: baton ${m[1]}`);
});
test('rules snippet is ≤ 40 lines', () => assert.ok(read('rules/AGENTS.snippet.md').split('\n').length <= 40));
