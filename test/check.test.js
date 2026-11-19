import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { repo, baton } from './helpers.js';

const filled = (dir, extra = '') => {
  const p = baton(dir, ['write', '--name', 'w']).out;
  fs.writeFileSync(p, fs.readFileSync(p, 'utf8').replace(/<!-- fill[^>]*-->/g, 'x') + extra);
  return p;
};
test('clean → ok (0) and Check section written', () => {
  const { dir } = repo(); baton(dir, ['init']);
  const p = filled(dir);
  const r = baton(dir, ['check', 'w']);
  assert.equal(r.code, 0, r.out);
  assert.match(fs.readFileSync(p, 'utf8'), /## Check\n\S+ agent ok/);
});
test('new commit → DRIFT exit 2', () => {
  const { dir, git } = repo(); baton(dir, ['init']); filled(dir);
  git('commit', '--allow-empty', '-qm', 'x');
  const r = baton(dir, ['check', 'w']);
  assert.equal(r.code, 2);
  assert.match(r.out, /HEAD moved 1 commits/);
});
test('verify runs only with --run; failure → exit 1', () => {
  const { dir } = repo(); baton(dir, ['init']);
  const p = baton(dir, ['write', '--name', 'w']).out;
  fs.writeFileSync(p, fs.readFileSync(p, 'utf8').replace(/<!-- fill[^>]*-->/g, 'x').replace(/(dirty: .*)/, '$1\nverify: false'));
  const plain = baton(dir, ['check', 'w']);
  assert.equal(plain.code, 0);
  assert.match(plain.out, /verify not run: `false`/);
  assert.equal(baton(dir, ['check', 'w', '--run']).code, 1);
});
test('unfilled brief → exit 1', () => {
  const { dir } = repo(); baton(dir, ['init']); baton(dir, ['write', '--name', 'w']);
  const r = baton(dir, ['check', 'w']);
  assert.equal(r.code, 1);
  assert.match(r.out, /unfilled/);
});
