import fs from 'node:fs';
import path from 'node:path';
import * as claude from './claude.js';
import * as codex from './codex.js';
import * as generic from './generic.js';

const READERS = { claude, codex, generic };
const ls = (d) => { try { return fs.readdirSync(d); } catch { return []; } };

function walk(d, hit) {
  for (const n of ls(d)) {
    const p = path.join(d, n);
    if (fs.statSync(p).isDirectory()) { const r = walk(p, hit); if (r) return r; } else if (hit(n)) return p;
  }
}

export function locate(id, { home }) {
  const cp = path.join(home, '.claude', 'projects');
  const xp = path.join(home, '.codex', 'sessions');
  for (const proj of ls(cp)) {
    const f = path.join(cp, proj, `${id}.jsonl`);
    if (fs.existsSync(f)) return { agent: 'claude', path: f };
    for (const s of ls(path.join(cp, proj))) {
      const g = path.join(cp, proj, s, 'subagents', `agent-${id}.jsonl`);
      if (fs.existsSync(g)) return { agent: 'claude', path: g };
    }
  }
  const x = walk(xp, (n) => n.endsWith(`-${id}.jsonl`));
  if (x) return { agent: 'codex', path: x };
  throw new Error(`session ${id} not found; searched: ${cp}, ${xp}`);
}

// When a session began, from its first timestamped records, without reading a long transcript in full.
export function startedAt(agent, file) {
  let head = '';
  try { const fd = fs.openSync(file, 'r'); const b = Buffer.alloc(65536); head = b.subarray(0, fs.readSync(fd, b, 0, b.length, 0)).toString('utf8'); fs.closeSync(fd); } catch { return undefined; }
  for (const l of head.split('\n').slice(0, 50)) {
    let r;
    try { r = JSON.parse(l); } catch { continue; }
    const t = agent === 'codex' && r.type === 'session_meta' ? r.payload?.timestamp || r.timestamp : r.timestamp;
    if (t) return t;
  }
  return undefined;
}

export const read = (agent, file, from = 0) => (READERS[agent] || generic).read(file, from);
