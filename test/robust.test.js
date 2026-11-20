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

test('handover binds the brief to the writing session (CLAUDE_CODE_SESSION_ID / CODEX_THREAD_ID); none → unbound', () => {
  const { dir } = setup();
  baton(dir, ['handover', '--name', 'a'], { CLAUDE_CODE_SESSION_ID: CID });
  baton(dir, ['handover', '--name', 'b'], { CODEX_THREAD_ID: 'thread-1' });
  baton(dir, ['handover', '--name', 'c']);
  assert.equal(byName(dir, 'a').sessionId, CID);
  assert.equal(byName(dir, 'b').sessionId, 'thread-1');
  assert.equal(byName(dir, 'c').sessionId, null);
  for (const e of Object.values(idxOf(dir))) assert.ok(!('pending' in e) && !('pendingFrom' in e), 'no adoption state');
});

test('sync of a handover bound to its session refreshes it from that transcript; the handed-over brief stays as written after takeover', () => {
  const r = repo(); const dir = r.dir; const home = homeCopy();
  baton(dir, ['init']);
  const h = baton(dir, ['handover', '--name', 'money-fix'], { CLAUDE_CODE_SESSION_ID: CID });
  const s = baton(dir, ['sync', 'money-fix'], env(home));
  assert.match(s.out, /^updated/, s.out + s.err);
  assert.ok(byName(dir, 'money-fix').sourcePath?.endsWith(`${CID}.jsonl`));
  filled(h.out);
  const t = baton(dir, ['takeover', 'money-fix', '--name', 'money-fix-2'], { CLAUDE_CODE_SESSION_ID: 'arriving' });
  assert.equal(t.code, 0, t.out + t.err);
  assert.equal(byName(dir, 'money-fix-2').sessionId, 'arriving');
  assert.equal(byName(dir, 'money-fix-2').parent, byName(dir, 'money-fix').id);
});
