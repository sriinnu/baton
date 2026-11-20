import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { repo, baton, homeCopy, FAKE, CID, XID2 } from './helpers.js';

// takeover [claude|codex] <session id | id prefix | name | last>: the session is found on disk, no hook involved.
const env = (home, extra = {}) => ({ HOME: home, BATON_RUNNER: FAKE, ...extra });
const setup = () => { const r = repo(); baton(r.dir, ['init']); return { ...r, home: homeCopy() }; };
const idx = (dir) => JSON.parse(fs.readFileSync(`${dir}/.baton/index.json`, 'utf8')).briefs;
const names = (home, rows) => fs.writeFileSync(`${home}/.codex/session_index.jsonl`, rows.map((r) => JSON.stringify(r)).join('\n') + '\n');

test('takeover claude <id> with no brief: starts one from the transcript, no model call, exit 1 until filled', () => {
  const { dir, home } = setup();
  const calls = `${home}/calls`;
  const t = baton(dir, ['takeover', 'claude', CID], env(home, { BATON_FAKE_CALLS: calls }));
  assert.equal(t.code, 1, t.out + t.err);
  assert.match(t.out, /brief started from claude session c1c1c1c1/);
  assert.match(t.out, /--distill/);
  assert.match(fs.readFileSync(`${dir}/.baton/briefs/${CID}.md`, 'utf8'), /## Extract/);
  assert.ok(!fs.existsSync(calls), 'no model call without --distill');
  // the hint's own advice works: rerun with --distill fills the brief that was just started
  const d = baton(dir, ['takeover', CID, '--distill', '--name', 'next'], env(home, { BATON_FAKE_CALLS: calls }));
  assert.equal(d.code, 0, d.out + d.err);
  assert.equal(fs.readFileSync(calls, 'utf8'), 'call\n');
});

test('takeover claude <id> --distill: one model pass over the whole session, then check and continuation', () => {
  const { dir, home } = setup();
  const calls = `${home}/calls`;
  const t = baton(dir, ['takeover', 'claude', CID, '--distill', '--name', 'next'], env(home, { BATON_FAKE_CALLS: calls }));
  assert.equal(t.code, 0, t.out + t.err);
  assert.match(t.out, /--- check: ok ---/);
  assert.equal(fs.readFileSync(calls, 'utf8'), 'call\n');
  const brief = fs.readFileSync(`${dir}/.baton/briefs/${CID}.md`, 'utf8');
  assert.match(brief, /## Done\n- did the thing/);
  assert.ok(!brief.includes('## Extract'));
  assert.equal(Object.values(idx(dir)).find((e) => e.name === 'next').parent, CID);
  // a second takeover reuses the brief: no new distill
  const again = baton(dir, ['takeover', 'claude', CID, '--distill', '--name', 'next2'], env(home, { BATON_FAKE_CALLS: calls }));
  assert.equal(again.code, 0, again.out + again.err);
  assert.equal(fs.readFileSync(calls, 'utf8'), 'call\n');
});

test('takeover codex <thread name>: exact name, newest wins; a partial name matching several lists them', () => {
  const { dir, home } = setup();
  names(home, [
    { id: XID2, thread_name: 'ledger split', updated_at: '2026-11-15T10:00:00Z' },
    { id: '019e0000-aaaa-7000-8000-000000000002', thread_name: 'ledger rounding', updated_at: '2026-11-14T10:00:00Z' },
  ]);
  const t = baton(dir, ['takeover', 'codex', 'Ledger Split'], env(home));
  assert.equal(t.code, 1, t.out + t.err);
  assert.match(t.out, new RegExp(`codex session ${XID2} "ledger split"`));
  const amb = baton(dir, ['takeover', 'codex', 'ledger'], env(home));
  assert.equal(amb.code, 1);
  assert.match(amb.err, /"ledger" matches 2 sessions/);
  assert.match(amb.err, /ledger split/);
  assert.match(amb.err, /ledger rounding/);
});

test('takeover <id prefix> finds the session in either agent; the agent word restricts the search', () => {
  const { dir, home } = setup();
  assert.match(baton(dir, ['takeover', 'c1c1c1c1'], env(home)).out, /claude session c1c1c1c1/);
  const wrong = baton(dir, ['takeover', 'codex', CID], env(home));
  assert.equal(wrong.code, 1);
  assert.match(wrong.err, /no codex session with id or name/);
});

test('takeover claude last: the newest Claude session whose cwd is this repo, never another repo\'s', () => {
  const { dir, home } = setup();
  const none = baton(dir, ['takeover', 'claude', 'last'], env(home));
  assert.equal(none.code, 1);
  assert.match(none.err, /no claude session found for this repo/);
  const id = 'd2d2d2d2-0000-4000-8000-000000000002';
  const real = fs.realpathSync(dir);
  const p = path.join(home, '.claude', 'projects', 'here', `${id}.jsonl`);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, [
    { type: 'user', cwd: real, sessionId: id, message: { role: 'user', content: 'ship the parser' } },
    { type: 'assistant', cwd: real, sessionId: id, message: { role: 'assistant', content: [{ type: 'text', text: 'on it' }] } },
  ].map((r) => JSON.stringify(r)).join('\n') + '\n');
  const t = baton(dir, ['takeover', 'claude', 'last'], env(home));
  assert.match(t.out, new RegExp(`claude session ${id}`), t.out + t.err);
});

test('takeover <brief name> still works as before, and a brief named like an agent is not mistaken for one', () => {
  const { dir, home } = setup();
  const h = baton(dir, ['handover', '--name', 'codex']);
  fs.writeFileSync(h.out, fs.readFileSync(h.out, 'utf8').replace(/<!-- fill[^>]*-->/g, 'x'));
  const t = baton(dir, ['takeover', 'codex', '--name', 'after'], env(home));
  assert.equal(t.code, 0, t.out + t.err);
});
