import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { repo, baton } from './helpers.js';

const filled = (p) => fs.writeFileSync(p, fs.readFileSync(p, 'utf8').replace(/<!-- fill[^>]*-->/g, 'x'));
const setup = () => {
  const r = repo();
  fs.writeFileSync(`${r.dir}/b.txt`, 'b'); r.git('add', '.'); r.git('commit', '-qm', 'second');
  baton(r.dir, ['init']);
  filled(baton(r.dir, ['write', '--name', 'w']).out);
  return r;
};

test('a linked worktree shares the main .baton/ and a descendant branch is not drift', () => {
  const { dir, git } = setup();
  const wt = `${dir}-wt`;
  git('worktree', 'add', '-q', wt, '-b', 'feat');
  const r = baton(wt, ['check', 'w']);
  assert.equal(r.code, 0, r.out + r.err);
  assert.ok(!fs.existsSync(`${wt}/.baton`));
  fs.writeFileSync(`${wt}/c.txt`, 'c'); git('-C', wt, 'add', '.'); git('-C', wt, 'commit', '-qm', 'more');
  assert.equal(baton(wt, ['check', 'w']).code, 0);
});

test('a worktree whose history does not contain the brief HEAD is drift', () => {
  const { dir, git } = setup();
  const wt = `${dir}-old`;
  git('worktree', 'add', '-q', wt, '-b', 'old', 'HEAD~1');
  const r = baton(wt, ['check', 'w']);
  assert.equal(r.code, 2);
  assert.match(r.out, /history diverged/);
});

test('State records worktree; Read first lists mission/knowledge files and config extras', () => {
  const { dir } = setup();
  fs.writeFileSync(`${dir}/MISSION.md`, 'm'); fs.writeFileSync(`${dir}/notes.md`, 'n');
  const cfg = `${dir}/.baton/config.json`;
  fs.writeFileSync(cfg, JSON.stringify({ ...JSON.parse(fs.readFileSync(cfg, 'utf8')), readFirst: ['notes.md', 'absent.md'] }));
  const t = fs.readFileSync(baton(dir, ['write', '--name', 'w2']).out, 'utf8');
  assert.match(t, /## Read first\n- MISSION\.md\n- notes\.md\n/);
  assert.ok(!t.includes('absent.md'));
  assert.match(t, new RegExp(`worktree: ${fs.realpathSync(dir).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`));
});
