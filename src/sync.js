import fs from 'node:fs';
import path from 'node:path';
import { parseBrief, serializeBrief, hasFillMarkers } from './brief.js';
import { measure, renderState, parseState } from './git.js';
import * as store from './store.js';
import { read } from './readers/index.js';
import { skeleton, renderExtract } from './extract.js';
import { runModel } from './model.js';
import { build } from './make.js';

export const log = (cwd, msg) => { try { fs.appendFileSync(path.join(store.storeDir(cwd), 'sync.log'), `${new Date().toISOString()} ${msg}\n`); } catch {} };

const PROMPT = `You maintain a distilled handoff brief for an AI coding session. Below are the current brief and new session activity (already redacted).
Return the FULL updated brief in the same markdown format (--- frontmatter ---, then ## sections). Rules:
- Keep ## Mission and ## State exactly as given. If Mission is a "<!-- fill" placeholder, write it: one paragraph from the first goal.
- Update Task, Decisions (with why), Done, Next, Dead ends, Open questions to reflect the new activity. Drop obsolete items.
- Stay under 150 lines. No secrets. No commentary outside the brief.`;

const UPDATABLE = ['Task', 'Decisions', 'Done', 'Next', 'Dead ends', 'Open questions'];

export async function sync(cwd, ref) {
  const e = store.resolve(cwd, ref);
  if (!e?.sourcePath) return { updated: false, reason: 'no source transcript' };
  const lock = path.join(store.storeDir(cwd), `${e.id}.lock`);
  try { if (Date.now() - fs.statSync(lock).mtimeMs > 600000) fs.rmSync(lock); } catch {}
  let fd;
  try { fd = fs.openSync(lock, 'wx'); } catch { return { updated: false, reason: 'locked' }; }
  try {
    const existing = store.readBrief(cwd, e.id);
    const r = read(e.agent, e.sourcePath, !existing || hasFillMarkers(existing) ? 0 : e.sourceOffset); // unfilled brief: redo from the start
    if (!r.turns.length) return { updated: false, reason: 'nothing new' };
    const sk = skeleton(r.turns);
    const parent = e.parent ? store.resolve(cwd, e.parent) : null;
    const stateCwd = r.cwd && fs.existsSync(r.cwd) ? r.cwd : cwd;
    const current = existing ?? build(cwd, { id: e.id, name: e.name, agent: e.agent, parent, sk, stateCwd });
    const cur = parseBrief(current);
    let out = (await runModel(`${PROMPT}\n=== CURRENT BRIEF ===\n${current}\n=== NEW ACTIVITY ===\n${renderExtract(sk)}\n`, store.config(cwd))).trim();
    out = out.replace(/^```\w*\n/, '').replace(/\n```$/, '');
    const next = parseBrief(out);
    if (!Object.keys(next.sections).length) throw new Error('model returned no sections');
    const missionFilled = !hasFillMarkers(cur.sections.Mission || '');
    if (missionFilled && next.sections.Mission?.trim() !== cur.sections.Mission.trim()) throw new Error('model changed Mission; rejected');
    const sections = { ...cur.sections };
    delete sections.Extract;
    for (const k of UPDATABLE) if (next.sections[k]) sections[k] = next.sections[k];
    if (!missionFilled && next.sections.Mission) sections.Mission = next.sections.Mission;
    sections.State = renderState(measure(stateCwd), parseState(cur.sections.State).verify);
    store.writeBrief(cwd, e.id, serializeBrief({ meta: { ...cur.meta, generated: new Date().toISOString() }, sections }));
    store.update(cwd, e.id, { sourceOffset: r.lines });
    return { updated: true };
  } finally {
    fs.closeSync(fd);
    fs.rmSync(lock, { force: true });
  }
}
