#!/usr/bin/env node
// Release gate. Creates nothing (no commit, tag or publish); it only refuses.
//   node scripts/release-gate.mjs          check a release is ready to tag: versions agree, changelog entry, tests pass
//   node scripts/release-gate.mjs publish  (prepublishOnly) also: signed master, clean tree, signed tag v<version> at HEAD.
//                                          In CI (the staging workflow checks out the tag) the branch check is skipped.
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const mode = process.argv[2] || 'check';
const ci = !!process.env.CI;
const fail = (m) => { console.error(`release refused: ${m}`); process.exit(1); };
const git = (...a) => { try { return execFileSync('git', a, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim(); } catch { return null; } };
const json = (p) => JSON.parse(fs.readFileSync(path.join(root, p), 'utf8'));

const v = json('package.json').version;
if (!/^\d+\.\d+\.\d+$/.test(v)) fail(`package.json version ${v} is not x.y.z`);
const others = { 'plugin/.claude-plugin/plugin.json': json('plugin/.claude-plugin/plugin.json').version, '.claude-plugin/marketplace.json': json('.claude-plugin/marketplace.json').plugins.find((p) => p.name === 'baton')?.version, 'directory/.claude-plugin/plugin.json': json('directory/.claude-plugin/plugin.json').version, 'plugin/.codex-plugin/plugin.json': json('plugin/.codex-plugin/plugin.json').version };
for (const [f, x] of Object.entries(others)) if (x !== v) fail(`${f} is ${x}, package.json is ${v}: bump all versions together`);
if (!new RegExp(`^## \\[${v.replace(/\./g, '\\.')}\\] - \\d{4}-\\d{2}-\\d{2}$`, 'm').test(fs.readFileSync(path.join(root, 'CHANGELOG.md'), 'utf8'))) fail(`CHANGELOG.md has no "## [${v}] - <date>" entry`);

if (mode === 'publish') {
  const tag = `v${v}`;
  if (!ci) {
    const branch = git('symbolic-ref', '--quiet', '--short', 'HEAD');
    if (branch !== 'master') fail(`publish from master after the PR is merged (on ${branch ?? 'a detached HEAD'})`);
    if (git('status', '--porcelain') !== '') fail('working tree must be clean');
    if (git('verify-commit', 'HEAD') === null) fail('HEAD must be a signed commit with a trusted signature');
  }
  if (git('cat-file', '-t', `refs/tags/${tag}`) !== 'tag') fail(`${tag} must exist as an annotated signed tag (git tag -s ${tag} -m ${tag})`);
  if (!ci && git('verify-tag', tag) === null) fail(`${tag} must carry a trusted signature`);
  if (git('rev-parse', `refs/tags/${tag}^{commit}`) !== git('rev-parse', 'HEAD')) fail(`${tag} must point to HEAD`);
}

const t = spawnSync(process.execPath, ['--test', ...fs.readdirSync(path.join(root, 'test')).filter((f) => f.endsWith('.test.js')).map((f) => path.join('test', f))], { cwd: root, encoding: 'utf8' });
if (t.status !== 0) fail(`tests failed:\n${(t.stdout + t.stderr).split('\n').filter((l) => /^✖|ℹ (pass|fail)/.test(l)).join('\n')}`);
console.log(`release gate ok: @sriinnu/baton ${v}${mode === 'publish' ? ` (tag v${v} at HEAD${ci ? '' : ', signed'})` : ''}; ${(t.stdout.match(/ℹ pass (\d+)/) || [])[1]} tests pass`);
