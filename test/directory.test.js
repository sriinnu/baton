import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { expected, DIR, NAME, PRIVACY } from '../scripts/build-directory.mjs';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const dir = path.join(root, DIR);
const walk = (d, p = '') => fs.readdirSync(path.join(d, p), { withFileTypes: true }).flatMap((e) => e.isDirectory() ? walk(d, path.join(p, e.name)) : [path.join(p, e.name)]);

test('directory/ is exactly what build-directory.mjs generates (run `npm run build:directory`)', () => {
  const want = expected();
  assert.deepEqual(walk(dir).sort(), Object.keys(want).sort());
  for (const [p, c] of Object.entries(want)) assert.ok(Buffer.from(c).equals(fs.readFileSync(path.join(dir, p))), `${DIR}/${p} is stale`);
});

test('directory/ holds only what an unverified org may submit: md, json, LICENSE, a PNG icon; no scripts, no #!', () => {
  for (const f of walk(dir)) {
    assert.match(f, /(\.md|\.json|^LICENSE|^\.claude-plugin\/icon\.png)$/, `not allowed in the directory: ${f}`);
    const b = fs.readFileSync(path.join(dir, f));
    if (!f.endsWith('.png')) { assert.ok(!b.includes(0), `${f} has NUL bytes`); assert.ok(!b.toString('utf8').startsWith('#!'), `${f} starts with #!`); }
  }
});

test('directory skills call the npm CLI, never the bundled one, under the directory name', () => {
  for (const s of ['handover', 'takeover', 'switch']) {
    const t = fs.readFileSync(path.join(dir, 'skills', s, 'SKILL.md'), 'utf8');
    assert.doesNotMatch(t, /CLAUDE_PLUGIN_ROOT|cli\/baton\.js|\/baton:/, s);
    assert.match(t, /@sriinnu\/baton/, s);
  }
  const m = JSON.parse(fs.readFileSync(path.join(dir, '.claude-plugin/plugin.json'), 'utf8'));
  assert.equal(m.name, NAME);
  assert.equal(m.version, JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8')).version);
});

test('the icon is a square PNG of 512-2048 px under 2 MB', () => {
  const b = fs.readFileSync(path.join(dir, '.claude-plugin/icon.png'));
  assert.equal(b.subarray(1, 4).toString(), 'PNG');
  const w = b.readUInt32BE(16), h = b.readUInt32BE(20);
  assert.equal(w, h); assert.ok(w >= 512 && w <= 2048, `${w}px`); assert.ok(b.length < 2 * 1024 * 1024);
});

test('the privacy policy the directory links to is a real file on master, and the manifest carries it', () => {
  const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
  const file = PRIVACY.match(/\/blob\/master\/(.+)$/)?.[1];
  assert.ok(file && fs.existsSync(path.join(root, file)), `${PRIVACY} must name a file in this repo`);
  assert.equal(JSON.parse(fs.readFileSync(path.join(root, DIR, '.claude-plugin/plugin.json'), 'utf8')).privacyPolicyUrl, PRIVACY);
});
