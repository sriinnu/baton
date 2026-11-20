import fs from 'node:fs';
import path from 'node:path';
import { readText } from './text.js';
import * as claude from './claude.js';
import * as codex from './codex.js';
import * as generic from './generic.js';

const READERS = { claude, codex, generic };
export const AGENTS = ['claude', 'codex'];
const ls = (d) => { try { return fs.readdirSync(d); } catch { return []; } };

function walk(d, hit) {
  for (const n of ls(d)) {
    const p = path.join(d, n);
    if (fs.statSync(p).isDirectory()) { const r = walk(p, hit); if (r) return r; } else if (hit(n)) return p;
  }
}

export function locate(id, { home, agent }) {
  const cp = path.join(home, '.claude', 'projects');
  const xp = path.join(home, '.codex', 'sessions');
  if (agent !== 'codex') for (const proj of ls(cp)) {
    const f = path.join(cp, proj, `${id}.jsonl`);
    if (fs.existsSync(f)) return { agent: 'claude', path: f };
    for (const s of ls(path.join(cp, proj))) {
      const g = path.join(cp, proj, s, 'subagents', `agent-${id}.jsonl`);
      if (fs.existsSync(g)) return { agent: 'claude', path: g };
    }
  }
  const hit = (n) => n.endsWith(`-${id}.jsonl`) || n.endsWith(`-${id}.jsonl.zst`);
  const x = agent !== 'claude' && (walk(xp, hit) || walk(path.join(home, '.codex', 'archived_sessions'), hit));
  if (x) return { agent: 'codex', path: x };
  throw new Error(`session ${id} not found; searched: ${[agent !== 'codex' && cp, agent !== 'claude' && xp].filter(Boolean).join(', ')}`);
}

export const read = (agent, file, from = 0) => (READERS[agent] || generic).read(file, from);

// --- finding a session by id, id prefix, name, or "last" ---
const UUID = /([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\.jsonl(?:\.zst)?$/;
const SCAN = 300; // newest transcripts searched for a name or for "last"

function sessions(home, agent) {
  const out = [];
  if (agent !== 'codex') {
    const cp = path.join(home, '.claude', 'projects');
    for (const proj of ls(cp)) for (const n of ls(path.join(cp, proj))) {
      const m = n.match(UUID);
      if (m) out.push({ agent: 'claude', id: m[1], path: path.join(cp, proj, n) });
    }
  }
  if (agent !== 'claude') {
    const rec = (d) => { for (const n of ls(d)) { const p = path.join(d, n); if (fs.statSync(p).isDirectory()) rec(p); else { const m = n.startsWith('rollout-') && n.match(UUID); if (m) out.push({ agent: 'codex', id: m[1], path: p }); } } };
    rec(path.join(home, '.codex', 'sessions'));
    rec(path.join(home, '.codex', 'archived_sessions')); // archived threads, zstd-compressed
  }
  for (const s of out) s.mtime = fs.statSync(s.path).mtimeMs;
  return out.sort((a, b) => b.mtime - a.mtime);
}

// Reads only the start and end of a transcript: cwd lives at the start, titles anywhere (Claude rewrites them).
function peek(s) {
  if (s.path.endsWith('.zst')) return peekText(s, readText(s.path));
  const fd = fs.openSync(s.path, 'r');
  const size = fs.fstatSync(fd).size;
  const part = (pos, len) => { const b = Buffer.alloc(Math.min(len, size)); return b.subarray(0, fs.readSync(fd, b, 0, b.length, pos)).toString('utf8'); };
  const head = part(0, 65536);
  const tail = size > 65536 ? part(Math.max(0, size - 262144), 262144) : '';
  fs.closeSync(fd);
  return peekText(s, head, tail);
}
function peekText(s, head, tail = '') {
  let cwd, title;
  for (const l of head.split('\n')) {
    let r; try { r = JSON.parse(l); } catch { continue; }
    cwd ??= s.agent === 'codex' ? (r.type === 'session_meta' ? r.payload?.cwd : undefined) : r.cwd;
    if (cwd) break;
  }
  if (s.agent === 'claude') {
    let ai, custom;
    for (const l of (head + '\n' + tail).split('\n')) {
      if (!l.includes('-title"')) continue;
      let r; try { r = JSON.parse(l); } catch { continue; }
      if (r.type === 'custom-title' && r.customTitle) custom = r.customTitle; // set by the user (/rename): wins
      if (r.type === 'ai-title' && r.aiTitle) ai = r.aiTitle;
    }
    title = custom || ai;
  }
  return { cwd, title };
}

function codexNames(home) {
  const names = new Map(); // id -> latest thread_name
  let text = '';
  try { text = fs.readFileSync(path.join(home, '.codex', 'session_index.jsonl'), 'utf8'); } catch { return names; }
  for (const l of text.split('\n')) { let r; try { r = JSON.parse(l); } catch { continue; } if (r.id && r.thread_name) names.set(r.id, r.thread_name); }
  return names;
}

const within = (dir, roots) => !!dir && roots.some((r) => dir === r || dir.startsWith(r + path.sep));
const label = (s) => `${s.agent} ${s.id}${s.title ? ` "${s.title}"` : ''}`;

// ref: a session id, a unique id prefix (6+ chars), "last" (newest session in this repo), or a session name
// (Codex thread name, Claude title; exact match first, newest wins; otherwise a unique partial match).
export function find(ref, { home, agent, roots = [] }) {
  if (!ref) throw new Error('which session? give an id, a name, or "last"');
  try { const l = locate(ref, { home, agent }); return { ...l, id: ref }; } catch {}
  const all = sessions(home, agent);
  if (ref === 'last' || ref === 'latest') {
    for (const s of all.slice(0, SCAN)) if (within(peek(s).cwd, roots)) return s;
    throw new Error(`no ${agent || 'claude/codex'} session found for this repo (${roots.join(', ')})`);
  }
  if (/^[0-9a-f-]{6,}$/.test(ref)) {
    const hit = all.filter((s) => s.id.startsWith(ref));
    if (hit.length === 1) return hit[0];
    if (hit.length > 1) throw new Error(`"${ref}" matches ${hit.length} sessions: ${hit.slice(0, 5).map(label).join('; ')}`);
  }
  const names = agent === 'claude' ? new Map() : codexNames(home);
  const named = all.slice(0, SCAN).map((s) => ({ ...s, title: s.agent === 'codex' ? names.get(s.id) : peek(s).title }));
  for (const s of all.slice(SCAN)) if (s.agent === 'codex' && names.has(s.id)) named.push({ ...s, title: names.get(s.id) });
  const q = ref.toLowerCase();
  const exact = named.filter((s) => s.title?.toLowerCase() === q);
  if (exact.length) return exact[0]; // newest of that name
  const gone = [...names].filter(([id, n]) => n.toLowerCase() === q && !all.some((s) => s.id === id)).map(([id]) => id);
  const goneNote = gone.length ? ` (a Codex thread named "${ref}", ${gone.at(-1)}, has no transcript on disk any more)` : '';
  const part = named.filter((s) => s.title?.toLowerCase().includes(q));
  if (part.length === 1) return part[0];
  if (part.length > 1) throw new Error(`"${ref}" matches ${part.length} sessions; use the full name or an id${goneNote}: ${part.slice(0, 5).map(label).join('; ')}`);
  if (gone.length) throw new Error(`Codex thread "${ref}" (${gone.at(-1)}) has no transcript on disk any more`);
  throw new Error(`no ${agent || 'claude/codex'} session with id or name "${ref}"`);
}
