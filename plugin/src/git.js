import { execFileSync } from 'node:child_process';

const run = (cwd, args) => execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
const out = (cwd, args, d = '') => { try { return run(cwd, args).trim(); } catch { return d; } };

const roots = new Map();
// The main worktree: every linked worktree shares its .baton/ (a fresh worktree has none of its own).
export function mainRoot(cwd) {
  if (!roots.has(cwd)) roots.set(cwd, out(cwd, ['worktree', 'list', '--porcelain']).match(/^worktree (.+)$/m)?.[1] ?? cwd);
  return roots.get(cwd);
}
const isAncestor = (cwd, a, b) => { try { run(cwd, ['merge-base', '--is-ancestor', a, b]); return true; } catch { return false; } };

export function measure(cwd) {
  if (out(cwd, ['rev-parse', '--is-inside-work-tree']) !== 'true') return { repo: false, branch: null, head: null, diffStat: '', dirty: [] };
  const head = out(cwd, ['rev-parse', 'HEAD'], null);
  const br = out(cwd, ['symbolic-ref', '--short', '-q', 'HEAD'], null);
  let dirty = [];
  try { const f = run(cwd, ['status', '--porcelain', '-z']).split('\0'); for (let i = 0; i < f.length; i++) { if (!f[i]) continue; dirty.push(f[i].slice(3)); if (/^[RC]/.test(f[i])) i++; } } catch {} // renames carry a second NUL field (the old path)
  return { repo: true, worktree: out(cwd, ['rev-parse', '--show-toplevel'], cwd), root: mainRoot(cwd), branch: br ?? (head ? `detached at ${head.slice(0, 7)}` : null), head, diffStat: out(cwd, ['diff', '--stat', 'HEAD']), dirty };
}

export function renderState(m, verify) {
  if (!m.repo) return 'repo: not a git repo' + (verify ? `\nverify: ${verify}` : '');
  const l = [`branch: ${m.branch}`, `worktree: ${m.worktree}`, ...(m.root && m.root !== m.worktree ? [`root: ${m.root}`] : []), `head: ${m.head ?? 'none'}`, `dirty: ${m.dirty.join(', ') || 'none'}`];
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
    worktree: g('worktree') ?? null,
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
  if (stored.worktree && now.worktree && stored.worktree !== now.worktree) { // new worktree: other branch and dirty files are expected; only diverged history is drift
    if (stored.head && now.head && stored.head !== now.head && !isAncestor(cwd, stored.head, now.head)) out_.push(`history diverged: brief's HEAD ${stored.head.slice(0, 7)} is not in this worktree's history`);
    return out_;
  }
  if (stored.head !== now.head) {
    const n = cwd && stored.head && now.head ? out(cwd, ['rev-list', '--count', `${stored.head}..${now.head}`], '?') : '?';
    out_.push(`HEAD moved ${n} commits (${(stored.head || 'none').slice(0, 7)} → ${(now.head || 'none').slice(0, 7)})`);
  }
  if (stored.branch !== now.branch) out_.push(`branch changed: ${stored.branch} → ${now.branch}`);
  for (const f of now.dirty) if (!stored.dirty.includes(f)) out_.push(`new dirty: ${f}`);
  for (const f of stored.dirty) if (!now.dirty.includes(f)) out_.push(`no longer dirty: ${f}`);
  return out_;
}
