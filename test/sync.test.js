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
  assert.equal(a.out, 'updated (1 model call)', a.err);
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
test('sync: runner failure → exit 1, brief unchanged', () => {
  const { dir, home } = setup();
  baton(dir, ['from', CID, '--name', 's'], { HOME: home });
  const before = fs.readFileSync(`${dir}/.baton/briefs/${CID}.md`, 'utf8');
  const r = baton(dir, ['sync', 's'], env(home, { BATON_FAKE: 'fail' }));
  assert.equal(r.code, 1);
  assert.match(r.err, /exited 1/);
  assert.equal(fs.readFileSync(`${dir}/.baton/briefs/${CID}.md`, 'utf8'), before);
});
test('legacy `sync --hook` (old hooks, old Codex notify) does nothing: no model call, no brief, exit 0', () => {
  const { dir, home } = setup();
  const calls = `${home}/calls`;
  const r = baton(dir, ['sync', '--hook'], env(home, { BATON_FAKE_CALLS: calls }), JSON.stringify({ session_id: CID, cwd: dir }));
  assert.equal(r.code, 0);
  assert.equal(r.out, '');
  assert.ok(!fs.existsSync(calls), 'no model call');
  assert.ok(!fs.existsSync(`${dir}/.baton/briefs/${CID}.md`));
  assert.ok(!fs.existsSync(`${dir}/.baton/sync.log`));
});
test('a long session is distilled in parts, one model call each; the first goal survives the budget', async () => {
  const { chunks, transcriptText } = await import('../plugin/src/sync.js');
  const turns = [{ role: 'user', text: 'GOAL: fix the ledger' }];
  for (let n = 0; n < 3000; n++) turns.push({ role: 'assistant', text: `step ${n} ${'x'.repeat(200)}` });
  const parts = chunks(transcriptText(turns), 60000, 360000);
  assert.ok(parts.length >= 6 && parts.length <= 8, String(parts.length));
  assert.ok(parts.every((p) => p.length <= 60000));
  assert.match(parts[0], /^USER: GOAL: fix the ledger/);
  assert.match(parts[0], /earlier activity omitted/);
  assert.match(parts.at(-1), /step 2999/);
  assert.deepEqual(chunks('short'), ['short']);
});
test('held lock → skipped', () => {
  const { dir, home } = setup();
  baton(dir, ['from', CID, '--name', 's'], { HOME: home });
  fs.writeFileSync(`${dir}/.baton/${CID}.lock`, '');
  assert.match(baton(dir, ['sync', 's'], env(home)).out, /locked/);
});
