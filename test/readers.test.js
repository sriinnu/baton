import test from 'node:test';
import assert from 'node:assert/strict';
import { locate, read } from '../src/readers/index.js';
import { HOME, CID, XID } from './helpers.js';

test('claude: roles, skips sidechain + system-reminder, files, cwd', () => {
  const l = locate(CID, { home: HOME });
  assert.equal(l.agent, 'claude');
  const r = read('claude', l.path);
  const roles = (x) => r.turns.filter((t) => t.role === x).length;
  assert.deepEqual([roles('user'), roles('assistant'), roles('tool')], [2, 2, 4]);
  assert.equal(r.turns[0].text, 'Fix the login bug in auth.js');
  assert.deepEqual(r.turns.flatMap((t) => t.files || []), ['/tmp/proj/src/auth.js']);
  assert.ok(!r.turns.some((t) => /SIDECHAIN|ignore me/.test(t.text)));
  assert.equal(r.cwd, '/tmp/proj');
});
test('claude: fromLine returns only later turns', () => {
  const l = locate(CID, { home: HOME });
  const r = read('claude', l.path, 8);
  assert.deepEqual(r.turns.map((t) => t.text), ['Done.']);
});
test('codex: turns, patch files, cwd, parent thread', () => {
  const l = locate(XID, { home: HOME });
  assert.equal(l.agent, 'codex');
  const r = read('codex', l.path);
  assert.deepEqual(r.turns.map((t) => t.role), ['user', 'tool', 'tool', 'tool', 'assistant']);
  assert.deepEqual(r.turns.flatMap((t) => t.files || []), ['src/store.js']);
  assert.equal(r.turns[1].text, 'git status --short');
  assert.equal(r.cwd, '/tmp/proj');
  assert.equal(r.parent, 'p1');
});
test('missing id lists both searched dirs', () => {
  assert.throws(() => locate('nope', { home: HOME }), (e) => /\.claude/.test(e.message) && /\.codex/.test(e.message));
});
test('generic: plain text becomes one user turn', async () => {
  const fs = await import('node:fs'); const os = await import('node:os'); const p = os.tmpdir() + '/gen.txt';
  fs.writeFileSync(p, 'hello\nworld\n');
  const r = read('generic', p);
  assert.equal(r.turns.length, 1);
  assert.equal(r.turns[0].text, 'hello\nworld');
});
