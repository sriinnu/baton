import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { measure, renderState, parseState, drift } from '../src/git.js';
import { repo } from './helpers.js';

test('clean, dirty, and HEAD drift', () => {
  const { dir, git } = repo();
  const s0 = measure(dir);
  assert.equal(s0.dirty.length, 0);
  fs.writeFileSync(path.join(dir, 'b.txt'), 'b');
  const s1 = measure(dir);
  assert.deepEqual(s1.dirty, ['b.txt']);
  git('add', '.'); git('commit', '-qm', 'two'); git('commit', '--allow-empty', '-qm', 'three');
  const st = parseState(renderState(s0));
  const d = drift(st, measure(dir), dir);
  assert.match(d[0], /HEAD moved 2 commits/);
});
test('non-repo', () => {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'nr-'));
  const m = measure(d);
  assert.equal(m.repo, false);
  assert.match(renderState(m), /not a git repo/);
  assert.deepEqual(drift(parseState(renderState(m)), m), []);
});
test('detached HEAD', () => {
  const { dir, git } = repo();
  git('checkout', '-q', '--detach');
  assert.match(measure(dir).branch, /^detached at [0-9a-f]{7}$/);
});
test('verify line survives render/parse', () => {
  const { dir } = repo();
  assert.equal(parseState(renderState(measure(dir), 'npm test')).verify, 'npm test');
});

test('renames: dirty lists the new path only', async () => {
  const { repo } = await import('./helpers.js');
  const { measure } = await import('../src/git.js');
  const { dir, git } = repo();
  git('mv', 'a.txt', 'b c.txt');
  assert.deepEqual(measure(dir).dirty, ['b c.txt']);
});
