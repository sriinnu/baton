import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { measure, renderState, parseState, drift } from '../plugin/src/git.js';
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
  const { measure } = await import('../plugin/src/git.js');
  const { dir, git } = repo();
  git('mv', 'a.txt', 'b c.txt');
  assert.deepEqual(measure(dir).dirty, ['b c.txt']);
});

test('State carries the uncommitted diff, redacted, without lockfile noise, from any subdirectory', () => {
  const { dir, git } = repo();
  fs.mkdirSync(path.join(dir, 'sub'));
  fs.writeFileSync(path.join(dir, 'package-lock.json'), '{}'); git('add', '.'); git('commit', '-qm', 'lock');
  fs.writeFileSync(path.join(dir, 'a.txt'), 'a changed\nkey sk-abcdefghijklmnopqrstuvwx\n');
  fs.writeFileSync(path.join(dir, 'package-lock.json'), '{"lockfileVersion":3}');
  const st = renderState(measure(path.join(dir, 'sub')));
  assert.match(st, /uncommitted diff:/);
  assert.match(st, /^\+a changed$/m);
  assert.match(st, /\[REDACTED\]/);
  assert.doesNotMatch(st, /sk-abcdef/);
  assert.doesNotMatch(st, /lockfileVersion/);
});
test('a diff containing backtick fences and "## " lines cannot break the brief', async () => {
  const { parseBrief, serializeBrief } = await import('../plugin/src/brief.js');
  const { dir } = repo();
  fs.writeFileSync(path.join(dir, 'a.txt'), '```\n## Not a section\n````\nhead: fake\n');
  const st = renderState(measure(dir));
  const b = parseBrief(serializeBrief({ meta: { id: 'x' }, sections: { Task: 't', State: st } }));
  assert.deepEqual(Object.keys(b.sections), ['Task', 'State']);
  assert.match(st, /^`{5}diff$/m, 'the diff fence must outrun the 4-backtick run inside the diff');
  assert.equal(parseState(st).head, measure(dir).head);
});
test('a long diff is cut with a pointer to the rest', async () => {
  const { DIFF_LINES } = await import('../plugin/src/git.js');
  const { dir } = repo();
  fs.writeFileSync(path.join(dir, 'a.txt'), Array.from({ length: 400 }, (_, i) => `line ${i}`).join('\n'));
  const st = renderState(measure(dir));
  assert.match(st, /… not shown: a\.txt \(cut after \d+ of \d+ lines\)\. Run `git diff HEAD`\./);
  assert.ok(st.split('\n').length < DIFF_LINES + 20);
});
test('a big file cannot crowd small edits out of the diff: smallest files go first, the rest are named', () => {
  const { dir, git } = repo();
  fs.writeFileSync(path.join(dir, 'big.html'), 'x\n'); fs.writeFileSync(path.join(dir, 'small.js'), 'let a = 1;\n');
  git('add', '.'); git('commit', '-qm', 'two');
  fs.writeFileSync(path.join(dir, 'big.html'), Array.from({ length: 300 }, (_, i) => `<p>${i}</p>`).join('\n'));
  fs.writeFileSync(path.join(dir, 'small.js'), 'let a = 2;\n'); // git orders big.html first: without the sort it is cut and fills the budget
  const st = renderState(measure(dir));
  assert.match(st, /^\+let a = 2;$/m);
  assert.doesNotMatch(st, /<p>1<\/p>/);
  assert.match(st, /not shown: big\.html \(\d+ lines\)/);
});
