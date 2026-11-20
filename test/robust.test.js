import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { repo, baton, homeCopy, FAKE, CID, BIN } from './helpers.js';

const env = (home, extra = {}) => ({ HOME: home, BATON_RUNNER: FAKE, ...extra });
const transcript = (home) => `${home}/.claude/projects/-tmp-proj/${CID}.jsonl`;
const startAt = (home, iso) => { // stamp the session's records with when it began
  const p = transcript(home);
  fs.writeFileSync(p, fs.readFileSync(p, 'utf8').split('\n').filter(Boolean).map((l) => JSON.stringify({ ...JSON.parse(l), timestamp: iso })).join('\n') + '\n');
};
const setup = () => { const r = repo(); baton(r.dir, ['init']); baton(r.dir, ['write', '--id', 'r1', '--name', 'root']); return { ...r, home: homeCopy() }; };

test('doctor: passes on readable sessions, fails on a transcript format it cannot read', () => {
  const home = homeCopy();
  const ok = baton(process.cwd(), ['doctor'], { HOME: home });
  assert.equal(ok.code, 0, ok.out + ok.err);
  assert.match(ok.out, /doctor: 3 sessions checked, 0 failed/);
  const d = path.join(home, '.codex', 'sessions', '2027', '01', '01');
  fs.mkdirSync(d, { recursive: true });
  const unknown = Array.from({ length: 30 }, (_, n) => JSON.stringify({ type: 'event_msg', payload: { type: 'brand_new_message_kind', text: `turn ${n}` } }));
  fs.writeFileSync(path.join(d, 'rollout-2027-01-01T00-00-00-01ffffff-0000-7000-8000-00000000000f.jsonl'), unknown.join('\n') + '\n');
  const bad = baton(process.cwd(), ['doctor'], { HOME: home });
  assert.equal(bad.code, 1, bad.out);
  assert.match(bad.out, /FAIL codex .*no user turns, no assistant turns/);
});

test('the writer session never adopts its own pending brief, even under an unknown session id', () => {
  const { dir, home } = setup();
  startAt(home, new Date(Date.now() - 60000).toISOString()); // began before the handover
  baton(dir, ['write', '--parent', 'root', '--name', 'cont']);
  baton(dir, ['sync', '--hook'], env(home), JSON.stringify({ session_id: CID, cwd: dir }));
  const e = JSON.parse(fs.readFileSync(`${dir}/.baton/index.json`, 'utf8')).briefs;
  const cont = Object.values(e).find((x) => x.name === 'cont');
  assert.equal(cont.pending, true, 'older session must not take the handover');
  assert.ok(e[CID], 'it is tracked as its own session instead');
});

test('a session that began after the handover adopts it', () => {
  const { dir, home } = setup();
  baton(dir, ['write', '--parent', 'root', '--name', 'cont']);
  startAt(home, new Date(Date.now() + 1000).toISOString());
  baton(dir, ['sync', '--hook'], env(home), JSON.stringify({ session_id: CID, cwd: dir }));
  const e = JSON.parse(fs.readFileSync(`${dir}/.baton/index.json`, 'utf8')).briefs;
  const cont = Object.values(e).find((x) => x.name === 'cont');
  assert.equal(cont.pending, false);
  assert.equal(cont.sessionId, CID);
  assert.ok(!e[CID]);
});

test('pendingFrom: the writer is recognised by CLAUDE_CODE_SESSION_ID', () => {
  const { dir, home } = setup();
  baton(dir, ['write', '--parent', 'root', '--name', 'cont'], { CLAUDE_CODE_SESSION_ID: CID });
  baton(dir, ['sync', '--hook'], env(home), JSON.stringify({ session_id: CID, cwd: dir })); // fixture has no timestamps
  const cont = Object.values(JSON.parse(fs.readFileSync(`${dir}/.baton/index.json`, 'utf8')).briefs).find((x) => x.name === 'cont');
  assert.equal(cont.pendingFrom, CID);
  assert.equal(cont.pending, true);
});

test('20 concurrent writers: index stays valid and keeps every brief', async () => {
  const { dir } = repo();
  baton(dir, ['init']);
  const run = (n) => new Promise((ok) => {
    const c = spawn('node', [BIN, 'write', '--name', `w${n}`], { cwd: dir, env: { ...process.env, BATON_FG: '1' }, stdio: 'ignore' });
    c.on('exit', ok);
  });
  const codes = await Promise.all(Array.from({ length: 20 }, (_, n) => run(n)));
  assert.deepEqual(codes, Array(20).fill(0));
  const idx = JSON.parse(fs.readFileSync(`${dir}/.baton/index.json`, 'utf8'));
  const names = Object.values(idx.briefs).map((b) => b.name).sort();
  assert.equal(names.length, 20);
  assert.deepEqual(names, Array.from({ length: 20 }, (_, n) => `w${n}`).sort());
  assert.ok(!fs.readdirSync(`${dir}/.baton`).some((f) => /\.(tmp|lock)$/.test(f)));
});

const filled = (p) => fs.writeFileSync(p, fs.readFileSync(p, 'utf8').replace(/<!-- fill[^>]*-->/g, 'x'));
const idxOf = (dir) => JSON.parse(fs.readFileSync(`${dir}/.baton/index.json`, 'utf8')).briefs;
const byName = (dir, n) => Object.values(idxOf(dir)).find((x) => x.name === n);

for (const bound of [true, false]) {
  test(`takeover (${bound ? 'session id known' : 'session id unknown'}): the arriving session syncs its continuation, never the handed-over brief`, () => {
    const r = repo(); const dir = r.dir; const home = homeCopy();
    baton(dir, ['init']);
    startAt(home, new Date(Date.now() - 60000).toISOString()); // the arriving session was already running
    const h = baton(dir, ['handover', '--name', 'money-fix'], { CLAUDE_CODE_SESSION_ID: 'writer-session' });
    filled(h.out);
    const t = baton(dir, ['takeover', 'money-fix', '--name', 'money-fix-2'], bound ? { CLAUDE_CODE_SESSION_ID: CID } : {});
    assert.equal(t.code, 0, t.out + t.err);
    const before = fs.readFileSync(h.out, 'utf8'); // takeover's check stamps ## Check; sync must not touch it after
    baton(dir, ['sync', '--hook'], env(home), JSON.stringify({ session_id: CID, cwd: dir }));
    const src = byName(dir, 'money-fix'); const cont = byName(dir, 'money-fix-2');
    assert.equal(src.pending, false, 'handed-over brief is closed');
    assert.equal(src.sessionId, null, 'handed-over brief not bound to the arriving session');
    assert.equal(fs.readFileSync(h.out, 'utf8'), before, 'handed-over brief untouched by sync');
    assert.equal(cont.sessionId, CID);
    assert.equal(cont.pending, false);
    assert.ok(cont.sourcePath?.endsWith(`${CID}.jsonl`));
    assert.ok(!idxOf(dir)[CID], 'no stray per-session entry');
  });
}
