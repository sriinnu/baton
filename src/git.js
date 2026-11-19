import { execFileSync } from 'node:child_process';

const run = (cwd, args) => execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
const out = (cwd, args, d = '') => { try { return run(cwd, args).trim(); } catch { return d; } };

export function measure(cwd) {
  if (out(cwd, ['rev-parse', '--is-inside-work-tree']) !== 'true') return { repo: false, branch: null, head: null, diffStat: '', dirty: [] };
  const head = out(cwd, ['rev-parse', 'HEAD'], null);
  const br = out(cwd, ['symbolic-ref', '--short', '-q', 'HEAD'], null);
  let dirty = [];
  try { const f = run(cwd, ['status', '--porcelain', '-z']).split('\0'); for (let i = 0; i < f.length; i++) { if (!f[i]) continue; dirty.push(f[i].slice(3)); if (/^[RC]/.test(f[i])) i++; } } catch {} // renames carry a second NUL field (the old path)
  return { repo: true, branch: br ?? (head ? `detached at ${head.slice(0, 7)}` : null), head, diffStat: out(cwd, ['diff', '--stat', 'HEAD']), dirty };
}

export function renderState(m, verify) {
  if (!m.repo) return 'repo: not a git repo' + (verify ? `\nverify: ${verify}` : '');
  const l = [`branch: ${m.branch}`, `head: ${m.head ?? 'none'}`, `dirty: ${m.dirty.join(', ') || 'none'}`];
  if (verify) l.push(`verify: ${verify}`);
  if (m.diffStat) l.push('```\n' + m.diffStat + '\n```');
  return l.join('\n');
}

export function parseState(text = '') {
  const g = (k) => (text.match(new RegExp(`^${k}: (.*)$`, 'm')) || [])[1];
  const dirty = g('dirty');
  const head = g('head');
  return {
    repo: !/^repo: not a git repo/m.test(text),
    branch: g('branch') ?? null,
    head: head === undefined || head === 'none' ? null : head,
    dirty: !dirty || dirty === 'none' ? [] : dirty.split(', '),
    verify: g('verify'),
  };
}

export function drift(stored, now, cwd) {
  const out_ = [];
  if (!stored.repo && !now.repo) return out_;
  if (stored.repo !== now.repo) return [`repo state changed (was ${stored.repo ? 'git repo' : 'not a git repo'})`];
  if (stored.head !== now.head) {
    const n = cwd && stored.head && now.head ? out(cwd, ['rev-list', '--count', `${stored.head}..${now.head}`], '?') : '?';
    out_.push(`HEAD moved ${n} commits (${(stored.head || 'none').slice(0, 7)} → ${(now.head || 'none').slice(0, 7)})`);
  }
  if (stored.branch !== now.branch) out_.push(`branch changed: ${stored.branch} → ${now.branch}`);
  for (const f of now.dirty) if (!stored.dirty.includes(f)) out_.push(`new dirty: ${f}`);
  for (const f of stored.dirty) if (!now.dirty.includes(f)) out_.push(`no longer dirty: ${f}`);
  return out_;
}
