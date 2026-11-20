import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
// Tests must not inherit the user's global git config (hooksPath, commit signing).
process.env.GIT_CONFIG_GLOBAL = '/dev/null';
process.env.GIT_CONFIG_NOSYSTEM = '1';
export const HOME = path.join(here, 'fixtures', 'home');
export const BIN = path.join(here, '..', 'plugin', 'cli', 'baton.js');
export const CID = 'c1c1c1c1-0000-4000-8000-000000000001';
export const XID = '019e0000-aaaa-7000-8000-000000000002';

export function repo() {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'baton-'));
  const g = (...a) => execFileSync('git', ['-c', 'user.email=t@t', '-c', 'user.name=t', ...a], { cwd: d, stdio: 'ignore' });
  g('init', '-q'); fs.writeFileSync(path.join(d, 'a.txt'), 'a'); g('add', '.'); g('commit', '-qm', 'init');
  return { dir: d, git: g };
}
// The test runner may itself run inside an agent session: never leak its session ids into baton.
const hostEnv = () => Object.fromEntries(Object.entries(process.env).filter(([k]) => !/^(CLAUDE_CODE_SESSION_ID|CLAUDE_SESSION_ID|CODEX_THREAD_ID)$/.test(k)));
export const baton = (cwd, args, env = {}, input) => {
  const r = spawnSync('node', [BIN, ...args], { cwd, encoding: 'utf8', input, env: { ...hostEnv(), HOME, BATON_FG: '1', ...env } });
  return { code: r.status, out: r.stdout.trim(), err: r.stderr.trim() };
};
export const homeCopy = () => {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'baton-home-'));
  fs.cpSync(HOME, d, { recursive: true });
  return d;
};
export const FAKE = path.join(here, 'fake-runner.js');
