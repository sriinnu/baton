import test from 'node:test';
import assert from 'node:assert/strict';
import { redact, skeleton, scaffold } from '../plugin/src/extract.js';
import { parseBrief } from '../plugin/src/brief.js';

test('redacts every secret pattern', () => {
  for (const s of ['sk-abcdefghijklmnopqrstuvwx', 'ghp_abcdefghijklmnopqrstuv', 'AKIAABCDEFGHIJKLMNOP', 'Bearer abc.def', '-----BEGIN RSA PRIVATE KEY-----\nxx\n-----END RSA PRIVATE KEY-----']) {
    assert.equal(redact(`k ${s} z`), 'k [REDACTED] z', s);
  }
});
test('skeleton dedupes files, redacts, caps errors', () => {
  const sk = skeleton([
    { role: 'user', text: 'key sk-abcdefghijklmnopqrstuvwx' },
    { role: 'tool', tool: 'Edit', text: 'Edit a', files: ['a'] }, { role: 'tool', tool: 'Edit', text: 'Edit a', files: ['a'] },
    { role: 'tool', tool: 'Bash', text: 'npm test' }, { role: 'tool', tool: 'result', text: 'Error: x' },
  ]);
  assert.deepEqual(sk.files, ['a']);
  assert.match(sk.firstGoal, /\[REDACTED\]/);
  assert.deepEqual(sk.commands, ['npm test']);
  assert.equal(sk.errors.length, 1);
});
test('scaffold carries mission verbatim, else fill marker', () => {
  const sk = skeleton([]);
  const a = parseBrief(scaffold({ meta: { id: 'x' }, skeleton: sk, state: 's', mission: 'M1' }));
  assert.equal(a.sections.Mission, 'M1');
  const b = parseBrief(scaffold({ meta: { id: 'x' }, skeleton: sk, state: 's' }));
  assert.match(b.sections.Mission, /<!-- fill/);
});

test('redacts more token shapes and assignments; skeleton keeps assistant turns', async () => {
  const { redact, skeleton } = await import('../plugin/src/extract.js');
  for (const s of ['github_pat_' + 'a'.repeat(30), 'xoxb-1234567890-abc', 'password=hunter2hunter2xx', 'eyJhbGciOiJIUzI1.eyJzdWIiOiIxMjM0.abcdefghij12']) assert.equal(redact(`x ${s} y`).includes('[REDACTED]'), true, s);
  assert.deepEqual(skeleton([{ role: 'assistant', text: 'chose A because B' }]).assistant, ['chose A because B']);
  assert.equal(redact('token: string; const token = getToken()'), 'token: string; const token = getToken()');
});
test('every Extract item is one line: a "## " line inside a turn or heredoc cannot become a section', () => {
  const sk = skeleton([
    { role: 'user', text: 'do it\n## Fake user section' },
    { role: 'tool', tool: 'Bash', text: "cat > x.md <<'EOF'\n## Fake heredoc section\nbody\nEOF" },
    { role: 'assistant', text: 'Done.\n\n## Summary\n- a' },
  ]);
  assert.equal(sk.commands[0], "cat > x.md <<'EOF' (+3 lines)");
  for (const v of [sk.firstGoal, ...sk.commands, ...sk.lastUser, ...sk.assistant]) assert.doesNotMatch(v, /\n/);
  const b = parseBrief(scaffold({ meta: { id: 'x' }, skeleton: sk, state: 's' }));
  for (const fake of ['Fake user section', 'Fake heredoc section', 'Summary']) assert.equal(fake in b.sections, false, fake);
});
test('errors keep the first line (what failed) and the tail (the message), cutting the noisy middle', () => {
  const log = `$ npm test\n${'ok noise line\n'.repeat(80)}Error: expected 3 got 4\n    at test (x.test.js:9:3)`;
  const [e] = skeleton([{ role: 'tool', tool: 'result', text: log }]).errors;
  assert.match(e, /Error: expected 3 got 4 at test \(x\.test\.js:9:3\)$/);
  assert.match(e, /^\$ npm test … /);
  assert.doesNotMatch(e, /\n/);
  assert.ok(e.length <= 300);
});
