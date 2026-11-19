import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { repo, baton, homeCopy, FAKE, CID } from './helpers.js';

const env = (home, extra = {}) => ({ HOME: home, BATON_RUNNER: FAKE, ...extra });
const setup = () => { const r = repo(); baton(r.dir, ['init']); const home = homeCopy(); return { ...r, home }; };
const transcript = (home) => `${home}/.claude/projects/-tmp-proj/${CID}.jsonl`;
const more = (home) => fs.appendFileSync(transcript(home), JSON.stringify({ type: 'user', isSidechain: false, message: { role: 'user', content: 'one more thing' } }) + '\n');

test('sync fills prose, State from git, advances offset; second sync is a no-op', () => {
  const { dir, home } = setup();
  baton(dir, ['from', CID, '--name', 's'], { HOME: home });
  const a = baton(dir, ['sync', 's'], env(home));
  assert.equal(a.out, 'updated', a.err);
  const t = fs.readFileSync(`${dir}/.baton/briefs/${CID}.md`, 'utf8');
  assert.match(t, /## Done\n- did the thing/);
  assert.match(t, /## State\nbranch: /);
  assert.ok(!t.includes('## Extract'));
  assert.match(baton(dir, ['sync', 's'], env(home)).out, /nothing new/);
});
test('model changing Mission is ignored; Mission and State stay ours', () => {
  const { dir, home } = setup();
  baton(dir, ['from', CID, '--name', 's'], { HOME: home });
  baton(dir, ['sync', 's'], env(home));
  const mission = (t) => t.match(/## Mission\n[^\n]*/)[0];
  const before = fs.readFileSync(`${dir}/.baton/briefs/${CID}.md`, 'utf8');
  more(home);
  const r = baton(dir, ['sync', 's'], env(home, { BATON_FAKE: 'badmission' }));
  assert.equal(r.code, 0, r.err);
  const after = fs.readFileSync(`${dir}/.baton/briefs/${CID}.md`, 'utf8');
  assert.equal(mission(after), mission(before));
  assert.ok(!after.includes('HIJACKED'));
});
test('hook: runner failure leaves brief, logs, exits 0', () => {
  const { dir, home } = setup();
  const r = baton(dir, ['sync', '--hook'], env(home, { BATON_FAKE: 'fail' }), JSON.stringify({ session_id: CID, cwd: dir }));
  assert.equal(r.code, 0);
  assert.match(fs.readFileSync(`${dir}/.baton/sync.log`, 'utf8'), /exited 1/);
  assert.ok(!fs.existsSync(`${dir}/.baton/briefs/${CID}.md`));
});
test('hook: registers + syncs a new session; BATON_SYNC set → no-op (no recursion)', () => {
  const { dir, home } = setup();
  assert.equal(baton(dir, ['sync', '--hook'], env(home, { BATON_SYNC: '1' }), JSON.stringify({ session_id: CID, cwd: dir })).code, 0);
  assert.ok(!fs.existsSync(`${dir}/.baton/briefs/${CID}.md`));
  baton(dir, ['sync', '--hook'], env(home), JSON.stringify({ session_id: CID, cwd: dir }));
  assert.ok(fs.existsSync(`${dir}/.baton/briefs/${CID}.md`));
});
test('hook is a no-op in a repo without .baton/', () => {
  const r = repo(); const home = homeCopy();
  assert.equal(baton(r.dir, ['sync', '--hook'], env(home), JSON.stringify({ session_id: CID, cwd: r.dir })).code, 0);
  assert.ok(!fs.existsSync(`${r.dir}/.baton`));
});
test('hook adopts a pending continuation brief: same mission, parent kept', () => {
  const { dir, home } = setup();
  baton(dir, ['write', '--id', 'r1', '--name', 'root']);
  const w = baton(dir, ['write', '--parent', 'root', '--name', 'cont']);
  baton(dir, ['sync', '--hook'], env(home), JSON.stringify({ session_id: CID, cwd: dir }));
  const ls = baton(dir, ['ls']).out;
  assert.match(ls, /r1 \(root\)[^\n]*\n  [0-9a-f]{8} \(cont\)/);
  assert.ok(!ls.includes(CID));
  assert.match(fs.readFileSync(w.out, 'utf8'), /## Done\n- did the thing/);
});
test('held lock → skipped', () => {
  const { dir, home } = setup();
  baton(dir, ['from', CID, '--name', 's'], { HOME: home });
  fs.writeFileSync(`${dir}/.baton/${CID}.lock`, '');
  assert.match(baton(dir, ['sync', 's'], env(home)).out, /locked/);
});
