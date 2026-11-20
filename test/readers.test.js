import test from 'node:test';
import assert from 'node:assert/strict';
import { locate, read } from '../plugin/src/readers/index.js';
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

test('usage: claude dedupes per message id; codex reads token_count', async () => {
  const { parse: c } = await import('../plugin/src/readers/claude.js');
  const { parse: x } = await import('../plugin/src/readers/codex.js');
  const a = (id, i, r, w) => JSON.stringify({ type: 'assistant', message: { id, content: [], usage: { input_tokens: i, cache_read_input_tokens: r, cache_creation_input_tokens: w } } });
  assert.deepEqual(c([a('m1', 2, 100, 10), a('m1', 2, 100, 10), a('m2', 3, 150, 5)].join('\n')).usage, { context: 158, read: 250, write: 15 });
  const tc = JSON.stringify({ type: 'event_msg', payload: { type: 'token_count', info: { total_token_usage: { cached_input_tokens: 900 }, last_token_usage: { input_tokens: 300 } } } });
  assert.deepEqual(x(tc).usage, { context: 300, read: 900, write: null });
  assert.equal(c('').usage, undefined);
});

test('readers report the session model', async () => {
  const { parse: c } = await import('../plugin/src/readers/claude.js');
  const { parse: x } = await import('../plugin/src/readers/codex.js');
  assert.equal(c(JSON.stringify({ type: 'assistant', message: { id: 'm', model: 'claude-opus-5-5', content: [] } })).model, 'claude-opus-5-5');
  assert.equal(x(JSON.stringify({ type: 'turn_context', payload: { model: 'gpt-5-codex' } })).model, 'gpt-5-codex');
  assert.equal(c('').model, undefined);
});
