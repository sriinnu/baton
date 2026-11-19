import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { repo, baton, CID, XID } from './helpers.js';

const setup = () => { const r = repo(); baton(r.dir, ['init']); return r; };

test('from <claude id>: brief with State, fill markers, redaction, secrets absent', () => {
  const { dir } = setup();
  const r = baton(dir, ['from', CID, '--name', 'auth']);
  assert.equal(r.code, 0, r.err);
  const t = fs.readFileSync(`${dir}/.baton/briefs/${CID}.md`, 'utf8');
  assert.match(t, /## State\nbranch: /);
  assert.match(t, /<!-- fill/);
  assert.match(t, /first goal: Fix the login bug/);
  assert.ok(!t.includes('sk-abcdefghijklmnop'));
  assert.match(baton(dir, ['show', 'auth']).out, /unfilled sections/);
});
test('from is idempotent for an existing brief', () => {
  const { dir } = setup();
  baton(dir, ['from', CID]);
  assert.match(baton(dir, ['from', CID]).out, /exists/);
});
test('from <codex id> links parent thread when a brief for it exists', () => {
  const { dir } = setup();
  baton(dir, ['write', '--id', 'p1', '--name', 'orch']);
  const r = baton(dir, ['from', XID]);
  assert.equal(r.code, 0, r.err);
  assert.match(baton(dir, ['ls']).out, /p1 \(orch\)[^\n]*\n  019e0000/);
});
test('unknown ref / session exit 1', () => {
  const { dir } = setup();
  assert.equal(baton(dir, ['show', 'nope']).code, 1);
  assert.match(baton(dir, ['from', 'nope']).err, /not found; searched/);
});
test('write --parent continues: same mission, lineage; child carries Mission + Report back; fold', () => {
  const { dir } = setup();
  const root = baton(dir, ['write', '--name', 'root', '--id', 'r1']).out;
  let t = fs.readFileSync(root, 'utf8').replace('## Mission\n<!-- fill -->', '## Mission\nShip the plugin.').replace(/<!-- fill -->/g, 'x').replace('## Task\nx', '## Task\nBuild it');
  fs.writeFileSync(root, t);
  const kid = baton(dir, ['child', 'root', '--task', 'write tests', '--agent-id', 'sub1']);
  assert.equal(kid.code, 0, kid.err);
  const kt = fs.readFileSync(kid.out, 'utf8');
  assert.match(kt, /## Mission\nShip the plugin\./);
  assert.match(kt, /## Lineage\n- r1 \(root\) — Build it/);
  assert.match(kt, /## Task\nwrite tests/);
  assert.match(kt, /## Report back\nBefore this session ends/);
  fs.writeFileSync(kid.out, kt.replace('## Report back', '## Done\n- wrote 5 tests\n\n## Decisions\n- use node:test\n\n## Report back'));
  const id = kid.out.split('/').pop().replace('.md', '');
  assert.equal(baton(dir, ['fold', id]).code, 0);
  const rt = fs.readFileSync(root, 'utf8');
  assert.match(rt, /wrote 5 tests/);
  assert.match(rt, /use node:test/);
});
test('show prints drift after a new commit', () => {
  const { dir, git } = setup();
  baton(dir, ['write', '--name', 'w']);
  git('commit', '--allow-empty', '-qm', 'more');
  assert.match(baton(dir, ['show', 'w']).out, /drift since brief:\n- HEAD moved 1 commits/);
});

test('takeover: clean → continuation brief with same mission; drift → exit 2, no continuation; aliases work', () => {
  const { dir, git } = setup();
  const p = baton(dir, ['handover', '--name', 'old']).out;
  fs.writeFileSync(p, fs.readFileSync(p, 'utf8').replace('## Mission\n<!-- fill -->', '## Mission\nShip.').replace(/<!-- fill[^>]*-->/g, 'x'));
  assert.match(baton(dir, ['gist', 'old']).out, /## Mission\nShip\./);
  const t = baton(dir, ['takeover', 'old', '--name', 'new']);
  assert.equal(t.code, 0, t.out);
  assert.match(t.out, /--- check: ok ---\ncontinuation brief: /);
  assert.match(baton(dir, ['ls']).out, /\(old\)[^\n]*\n  [0-9a-f]{8} \(new\)/);
  git('commit', '--allow-empty', '-qm', 'drift');
  const d = baton(dir, ['takeover', 'old', '--name', 'again']);
  assert.equal(d.code, 2);
  assert.ok(!baton(dir, ['ls']).out.includes('(again)'));
});
