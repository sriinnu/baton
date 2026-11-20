import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import * as store from '../plugin/src/store.js';
import { repo } from './helpers.js';

test('init ignores .baton/ via .git/info/exclude, never the tracked .gitignore, and is idempotent', () => {
  const { dir } = repo();
  assert.equal(store.init(dir), 'excluded');
  assert.equal(store.init(dir), 'already-ignored');
  assert.equal(fs.existsSync(path.join(dir, '.gitignore')), false);
  assert.equal(fs.readFileSync(path.join(dir, '.git', 'info', 'exclude'), 'utf8').match(/^\.baton\/$/gm).length, 1);
  assert.equal(execFileSync('git', ['status', '--porcelain'], { cwd: dir, encoding: 'utf8' }), '');
});
test('init leaves an existing .gitignore rule alone and adds nothing', () => {
  const { dir } = repo();
  fs.writeFileSync(path.join(dir, '.gitignore'), 'node_modules\n.baton/\n');
  assert.equal(store.init(dir), 'already-ignored');
  assert.equal(fs.readFileSync(path.join(dir, '.gitignore'), 'utf8'), 'node_modules\n.baton/\n');
  assert.doesNotMatch(fs.readFileSync(path.join(dir, '.git', 'info', 'exclude'), 'utf8'), /\.baton/);
});
test('init from a linked worktree writes the shared exclude, so every worktree ignores .baton/', () => {
  const { dir, git } = repo();
  const wt = `${dir}-wt`;
  git('worktree', 'add', '-q', wt);
  assert.equal(store.init(wt), 'excluded');
  assert.match(fs.readFileSync(path.join(dir, '.git', 'info', 'exclude'), 'utf8'), /^\.baton\/$/m);
  assert.equal(execFileSync('git', ['status', '--porcelain'], { cwd: wt, encoding: 'utf8' }), '');
});
test('children inherit root mission id; lineage is root→parent', () => {
  const { dir } = repo(); store.init(dir);
  store.register(dir, { id: 'r', agent: 'claude' });
  store.register(dir, { id: 'c', parent: 'r' });
  const g = store.register(dir, { id: 'g', parent: 'c' });
  assert.equal(g.mission, 'r');
  assert.deepEqual(store.lineage(dir, 'g').map((e) => e.id), ['r', 'c']);
  assert.deepEqual(store.resolve(dir, 'r').children, ['c']);
});
test('names are unique; reassigning moves them; prefix resolves', () => {
  const { dir } = repo(); store.init(dir);
  store.register(dir, { id: 'abcd1234', name: 'fix' });
  store.register(dir, { id: 'ffff0000', name: 'fix' });
  assert.equal(store.resolve(dir, 'fix').id, 'ffff0000');
  assert.equal(store.resolve(dir, 'abcd').id, 'abcd1234');
});
test('unknown parent throws', () => {
  const { dir } = repo(); store.init(dir);
  assert.throws(() => store.register(dir, { id: 'x', parent: 'nope' }), /unknown parent/);
});
