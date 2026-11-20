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
