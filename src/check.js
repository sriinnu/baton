import { spawnSync } from 'node:child_process';
import { parseBrief, serializeBrief, hasFillMarkers } from './brief.js';
import { measure, parseState, drift } from './git.js';
import * as store from './store.js';

// "Wash your feet before entering": arriving agents verify the brief against reality first.
export function check(cwd, ref, { run = true } = {}) {
  const e = store.resolve(cwd, ref);
  const text = e && store.readBrief(cwd, e.id);
  if (!text) throw new Error(`no brief for ${ref}`);
  const b = parseBrief(text);
  const st = parseState(b.sections.State);
  const d = drift(st, measure(cwd), cwd);
  const lines = [...d];
  let ok = true;
  if (hasFillMarkers(text)) { lines.push('brief has unfilled sections'); ok = false; }
  if (run && st.verify) {
    const r = spawnSync(st.verify, { cwd, timeout: 120000, encoding: 'utf8', shell: true }); // runs as written, like a Makefile line
    if (r.status !== 0) { lines.push(`verify failed (${st.verify}): exit ${r.status ?? r.error?.code}`); ok = false; }
  }
  const stamp = `${new Date().toISOString()} ${process.env.BATON_AGENT || 'agent'}`;
  b.sections.Check = lines.length ? `${stamp} ${d.length ? 'DRIFT' : 'NOT OK'}: ${lines.join('; ')}` : `${stamp} ok`;
  if (run) store.writeBrief(cwd, e.id, serializeBrief(b)); // --no-run is read-only
  return { ok: ok && !d.length, drift: d.length > 0, lines };
}
