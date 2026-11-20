import fs from 'node:fs';
import path from 'node:path';
import { read } from './readers/index.js';

// Runs each reader over the newest real sessions on this machine. A reader that silently returns nothing
// (the agent changed its transcript format) fails here instead of producing empty briefs.
const MIN_LINES = 20; // shorter sessions (just opened, aborted) can legitimately have no reply yet
const ls = (d) => { try { return fs.readdirSync(d, { withFileTypes: true }); } catch { return []; } };
const files = (d, keep, deep) => ls(d).flatMap((e) => {
  const p = path.join(d, e.name);
  if (e.isDirectory()) return deep ? files(p, keep, deep) : [];
  return keep(e.name) ? [p] : [];
});
const newest = (paths, n) => paths.map((p) => ({ p, t: fs.statSync(p).mtimeMs })).sort((a, b) => b.t - a.t).slice(0, n).map((x) => x.p);

export const sources = (home) => ({
  claude: ls(path.join(home, '.claude', 'projects')).filter((e) => e.isDirectory())
    .flatMap((e) => files(path.join(home, '.claude', 'projects', e.name), (n) => n.endsWith('.jsonl'), false)),
  codex: files(path.join(home, '.codex', 'sessions'), (n) => n.startsWith('rollout-') && n.endsWith('.jsonl'), true),
});

export function inspect(agent, file) {
  const r = read(agent, file);
  const n = (role) => r.turns.filter((t) => t.role === role).length;
  const res = { agent, file, lines: r.lines, user: n('user'), assistant: n('assistant'), tool: n('tool'), model: r.model, usage: !!r.usage };
  if (r.lines < MIN_LINES) return { ...res, verdict: 'skip', why: `short (${r.lines} lines)` };
  const why = [!res.user && 'no user turns', !res.assistant && 'no assistant turns'].filter(Boolean);
  if (why.length) return { ...res, verdict: 'FAIL', why: why.join(', ') + ': transcript format not understood' };
  const warn = [!res.usage && 'no token usage', !res.model && 'no model'].filter(Boolean);
  return { ...res, verdict: warn.length ? 'warn' : 'ok', why: warn.join(', ') };
}

export function doctor({ home, limit = 5 }) {
  const src = sources(home);
  const rows = [];
  for (const agent of Object.keys(src)) {
    const pick = newest(src[agent], limit);
    if (!pick.length) { rows.push(`${agent}: no sessions found`); continue; }
    for (const f of pick) {
      let r;
      try { r = inspect(agent, f); } catch (e) { r = { agent, file: f, verdict: 'FAIL', why: `reader threw: ${e.message}` }; }
      rows.push(r);
    }
  }
  const checked = rows.filter((r) => typeof r === 'object');
  const failed = checked.filter((r) => r.verdict === 'FAIL').length;
  const line = (r) => typeof r === 'string' ? r
    : `${r.verdict.padEnd(4)} ${r.agent.padEnd(6)} ${path.basename(r.file)}${r.lines != null ? `  ${r.user}u/${r.assistant}a/${r.tool}t${r.model ? ` · ${r.model}` : ''}` : ''}${r.why ? `  (${r.why})` : ''}`;
  const out = [...rows.map(line), `doctor: ${checked.length} sessions checked, ${failed} failed`].join('\n');
  return { out, code: failed ? 1 : 0 };
}
