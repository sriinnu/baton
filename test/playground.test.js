import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { buildCore } from '../playground/build.js';
import { parse as claude } from '../plugin/src/readers/claude.js';
import { parse as codex } from '../plugin/src/readers/codex.js';
import { redact } from '../plugin/src/extract.js';
import { HOME, CID, XID } from './helpers.js';

test('playground bundle runs the same parsers and redaction as the CLI', () => {
  const a = fs.readFileSync(`${HOME}/.claude/projects/-tmp-proj/${CID}.jsonl`, 'utf8');
  const b = fs.readFileSync(`${HOME}/.codex/sessions/2026/05/07/rollout-2026-05-07T18-02-01-${XID}.jsonl`, 'utf8');
  const out = vm.runInNewContext(`${buildCore()}\n;({ c: parseClaude(a), x: parseCodex(b), r: redact(s) })`, { a, b, s: 'k sk-abcdefghijklmnopqrstuvwx' });
  assert.deepEqual(JSON.parse(JSON.stringify(out.c)), claude(a));
  assert.deepEqual(JSON.parse(JSON.stringify(out.x)), codex(b));
  assert.equal(out.r, redact('k sk-abcdefghijklmnopqrstuvwx'));
  assert.ok(!/^(import|export) /m.test(buildCore()));
});
