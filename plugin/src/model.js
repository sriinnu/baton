import { spawnSync } from 'node:child_process';

// BATON_SYNC marks the child model call, so a user's own agent hooks can tell it apart and skip it.
export function runModel(prompt, cfg) {
  const fake = process.env.BATON_RUNNER;
  const [cmd, args] = fake ? [fake, []] : cfg.runner === 'codex' ? ['codex', ['exec', '-m', cfg.model, '-']] : ['claude', ['-p', '--model', cfg.model]];
  const r = spawnSync(cmd, args, { input: prompt, encoding: 'utf8', timeout: 180000, shell: process.platform === 'win32', // load-bearing: .cmd shims need a shell on Windows
    env: { ...process.env, BATON_SYNC: '1' } });
  if (r.error) throw r.error;
  if (r.status !== 0) throw new Error(`${cmd} exited ${r.status}: ${(r.stderr || '').slice(0, 200)}`);
  return r.stdout;
}
