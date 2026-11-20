import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { redact } from './extract.js';

const run = (cwd, args) => execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
const out = (cwd, args, d = '') => { try { return run(cwd, args).trim(); } catch { return d; } };

const roots = new Map();
// The main worktree: every linked worktree shares its .baton/ (a fresh worktree has none of its own).
export function mainRoot(cwd) {
  if (!roots.has(cwd)) roots.set(cwd, out(cwd, ['worktree', 'list', '--porcelain']).match(/^worktree (.+)$/m)?.[1] ?? cwd);
  return roots.get(cwd);
}
// Keep `entry` out of git without touching tracked files: append it to the shared
// .git/info/exclude (the common dir, so every worktree sees it), unless some rule
// (.gitignore, exclude, core.excludesFile) already ignores it. Returns what it did.
export function excludeLocally(cwd, entry) {
  if (out(cwd, ['rev-parse', '--is-inside-work-tree']) !== 'true') return 'no-repo';
  if (out(cwd, ['check-ignore', '-q', entry], null) !== null) return 'already-ignored';
  const common = out(cwd, ['rev-parse', '--path-format=absolute', '--git-common-dir']);
  const file = path.join(common, 'info', 'exclude');
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const cur = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';
  fs.writeFileSync(file, cur + (cur && !cur.endsWith('\n') ? '\n' : '') + `${entry}/\n`);
  return 'excluded';
}
const isAncestor =(cwd, a, b) => { try { run(cwd, ['merge-base', '--is-ancestor', a, b]); return true; } catch { return false; } };

export function measure(cwd) {
  if (out(cwd, ['rev-parse', '--is-inside-work-tree']) !== 'true') return { repo: false, branch: null, head: null, diffStat: '', dirty: [] };
  const head = out(cwd, ['rev-parse', 'HEAD'], null);
  const br = out(cwd, ['symbolic-ref', '--short', '-q', 'HEAD'], null);
  let dirty = [];
  try { const f = run(cwd, ['status', '--porcelain', '-z']).split('\0'); for (let i = 0; i < f.length; i++) { if (!f[i]) continue; dirty.push(f[i].slice(3)); if (/^[RC]/.test(f[i])) i++; } } catch {} // renames carry a second NUL field (the old path)
  return { repo: true, worktree: out(cwd, ['rev-parse', '--show-toplevel'], cwd), root: mainRoot(cwd), branch: br ?? (head ? `detached at ${head.slice(0, 7)}` : null), head, diffStat: out(cwd, ['diff', '--stat', 'HEAD']), diff: uncommitted(cwd, head), dirty };
}

// The uncommitted change itself, so the next agent sees the work in progress, not just
// which files changed. Bounded (a brief stays small), redacted (code edits can carry keys),
// lockfiles left out (noise). Untracked files are listed under dirty, not diffed.
// Files go in smallest first, so one big or generated file can't crowd out the many small
// hand edits; files that don't fit are named, and only the first file is ever cut mid-way.
export const DIFF_LINES = 100;
export const DIFF_CHARS = 5000;
const NOISE = ['package-lock.json', 'pnpm-lock.yaml', 'yarn.lock', 'bun.lockb', 'Cargo.lock', 'poetry.lock', 'uv.lock', 'go.sum'].map((f) => `:(top,exclude,glob)**/${f}`);
function uncommitted(cwd, head) {
  if (!head) return '';
  const d = out(cwd, ['diff', '--no-color', '--no-ext-diff', 'HEAD', '--', ':/', ...NOISE]);
  if (!d) return '';
  const files = redact(d).split(/^(?=diff --git )/m).map((t) => {
    const lines = t.replace(/\n$/, '').split('\n');
    return { lines, chars: t.length, name: lines[0].match(/ b\/(.+)$/)?.[1] ?? lines[0] };
  }).sort((a, b) => a.lines.length - b.lines.length || a.chars - b.chars);
  const kept = [], left = [];
  let n = 0, chars = 0;
  for (const f of files) {
    if (n + f.lines.length <= DIFF_LINES && chars + f.chars <= DIFF_CHARS) { kept.push(...f.lines); n += f.lines.length; chars += f.chars; continue; }
    if (!kept.length) { // even the smallest file is too big: show its head
      let c = 0;
      for (const l of f.lines) { if (kept.length >= DIFF_LINES || c + l.length > DIFF_CHARS) break; kept.push(l); c += l.length + 1; }
      left.push(`${f.name} (cut after ${kept.length} of ${f.lines.length} lines)`);
      n = DIFF_LINES; // budget spent: every later file is only named
      continue;
    }
    left.push(`${f.name} (${f.lines.length} lines)`);
  }
  return kept.join('\n') + (left.length ? `\n… not shown: ${left.join(', ')}. Run \`git diff HEAD\`.` : '');
}
// A fence longer than any backtick run in the content: a diff context line like " ```"
// would otherwise close a plain ``` fence and leak the rest of the diff into the brief.
const fence = (s, lang = '') => { const n = Math.max(3, ...[...s.matchAll(/`+/g)].map((m) => m[0].length + 1)); const f = '`'.repeat(n); return `${f}${lang}\n${s}\n${f}`; };

export function renderState(m, verify) {
  if (!m.repo) return 'repo: not a git repo' + (verify ? `\nverify: ${verify}` : '');
  const l = [`branch: ${m.branch}`, `worktree: ${m.worktree}`, ...(m.root && m.root !== m.worktree ? [`root: ${m.root}`] : []), `head: ${m.head ?? 'none'}`, `dirty: ${m.dirty.join(', ') || 'none'}`];
  if (verify) l.push(`verify: ${verify}`);
  if (m.diffStat) l.push(fence(m.diffStat));
  if (m.diff) l.push('uncommitted diff:', fence(m.diff, 'diff'));
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
