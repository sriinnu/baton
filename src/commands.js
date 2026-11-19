import fs from 'node:fs';
import os from 'node:os';
import { parseBrief, serializeBrief, hasFillMarkers } from './brief.js';
import { measure, parseState, drift } from './git.js';
import * as store from './store.js';
import { locate, read } from './readers/index.js';
import { skeleton } from './extract.js';
import { build, lineageText } from './make.js';
import { sync, log } from './sync.js';
import { check } from './check.js';

const need = (cwd, ref) => {
  if (!store.exists(cwd)) throw new Error('not initialised; run `baton init`');
  const e = store.resolve(cwd, ref);
  if (!e) throw new Error(`unknown brief: ${ref}`);
  return e;
};
const home = () => os.homedir();

export const COMMANDS = {
  init: (cwd) => { store.init(cwd); return { out: 'initialised .baton/' }; },

  write(cwd, a) {
    if (!store.exists(cwd)) throw new Error('not initialised; run `baton init`');
    const parent = a.parent ? need(cwd, a.parent) : null;
    const id = a.id || store.newId();
    store.writeBrief(cwd, id, stripExtract(build(cwd, { id, name: a.name, agent: a.agent, parent, sk: skeleton([]) })));
    // pending: the next agent hook adopts this brief for the new session so sync keeps it current.
    store.register(cwd, { id, name: a.name, agent: a.agent, parent: parent?.id, sessionId: a.id, pending: a.id ? false : true });
    return { out: store.briefPath(cwd, id) };
  },

  from(cwd, a, [ref]) {
    if (!store.exists(cwd)) throw new Error('not initialised; run `baton init`');
    const found = store.resolve(cwd, ref);
    if (found && store.readBrief(cwd, found.id)) return { out: `${store.briefPath(cwd, found.id)}\n(exists; \`baton sync ${found.id}\` refreshes it)` };
    const loc = a.path ? { agent: a.agent || 'generic', path: a.path } : found?.sourcePath ? { agent: found.agent, path: found.sourcePath } : locate(ref, { home: home() });
    const r = read(loc.agent, loc.path);
    const sessionId = a.path ? null : found?.sessionId || ref;
    const id = found?.id || sessionId || store.newId();
    const parent = a.parent ? need(cwd, a.parent) : found?.parent ? store.resolve(cwd, found.parent) : r.parent ? store.resolve(cwd, r.parent) : null;
    const stateCwd = r.cwd && fs.existsSync(r.cwd) ? r.cwd : cwd;
    store.writeBrief(cwd, id, build(cwd, { id, name: a.name ?? found?.name, agent: loc.agent, parent, sk: skeleton(r.turns), stateCwd }));
    store.register(cwd, { id, name: a.name, agent: loc.agent, parent: parent?.id, sessionId, sourcePath: loc.path });
    store.update(cwd, id, { sourceOffset: r.lines });
    for (const s of r.subagents) if (!store.resolve(cwd, s.id)) store.register(cwd, { id: s.id, agent: loc.agent, parent: id, sessionId: s.id, sourcePath: s.path });
    return { out: `${store.briefPath(cwd, id)}\n(fill the <!-- fill --> sections, then delete ## Extract)` };
  },

  show(cwd, a, [ref]) {
    const e = need(cwd, ref);
    const text = store.readBrief(cwd, e.id);
    if (!text) return { out: `no brief yet for ${e.id}; run \`baton from ${e.sessionId || e.id}\``, code: 1 };
    const d = drift(parseState(parseBrief(text).sections.State), measure(cwd), cwd);
    return { out: text + (d.length ? `\n⚠ drift since brief:\n${d.map((x) => `- ${x}`).join('\n')}\n` : '') + (hasFillMarkers(text) ? '\n⚠ brief has unfilled sections (<!-- fill -->)\n' : '') };
  },

  child(cwd, a, [ref]) {
    const p = need(cwd, ref);
    if (!a.task) throw new Error('--task required');
    const pb = parseBrief(store.readBrief(cwd, p.id) || '');
    const id = store.newId();
    const e = store.register(cwd, { id, agent: a.agent, parent: p.id, sessionId: a['agent-id'] });
    const t = parseBrief(build(cwd, { id, agent: a.agent, parent: p, sk: skeleton([]) }));
    t.sections = {
      Mission: pb.sections.Mission, Lineage: lineageText(cwd, p), Task: a.task,
      Decisions: pb.sections.Decisions, 'Dead ends': pb.sections['Dead ends'],
      'Report back': `Before this session ends, update this brief (${store.briefPath(cwd, id)}): fill Done, Decisions (with why), Dead ends. The parent folds it back with \`baton fold ${id}\`.`,
      State: t.sections.State,
    };
    store.writeBrief(cwd, id, serializeBrief(t));
    return { out: `${store.briefPath(cwd, e.id)}` };
  },

  fold(cwd, a, [ref]) {
    const c = need(cwd, ref);
    if (!c.parent) throw new Error(`${c.id} has no parent`);
    const cb = parseBrief(store.readBrief(cwd, c.id) || '');
    const pb = parseBrief(store.readBrief(cwd, c.parent) || '');
    const first = (s) => (s || '').split('\n').find((l) => l.trim() && !l.startsWith('<!--')) || '(nothing reported)';
    pb.sections.Lineage = [pb.sections.Lineage, `- ${c.id}${c.name ? ` (${c.name})` : ''} — ${first(cb.sections.Done).replace(/^- /, '').slice(0, 120)}`].filter(Boolean).join('\n');
    const have = pb.sections.Decisions || '';
    const add = (cb.sections.Decisions || '').split('\n').filter((l) => l.trim() && !l.startsWith('<!--') && !have.includes(l));
    if (add.length) pb.sections.Decisions = [have, ...add].filter(Boolean).join('\n');
    store.writeBrief(cwd, c.parent, serializeBrief(pb));
    return { out: `folded ${c.id} into ${c.parent}` };
  },

  ls(cwd) {
    if (!store.exists(cwd)) throw new Error('not initialised; run `baton init`');
    const all = store.all(cwd);
    const byId = Object.fromEntries(all.map((e) => [e.id, e]));
    const lines = [];
    const walk = (e, d) => { lines.push(`${'  '.repeat(d)}${e.id}${e.name ? ` (${e.name})` : ''} [${e.agent || '?'}]${store.readBrief(cwd, e.id) ? '' : ' (no brief)'}`); e.children.forEach((c) => byId[c] && walk(byId[c], d + 1)); };
    all.filter((e) => !e.parent).forEach((e) => walk(e, 0));
    return { out: lines.join('\n') || '(empty)' };
  },

  async sync(cwd, a, [ref], stdin) {
    if (a.hook) return hook(cwd, stdin, process.argv[process.argv.length - 1]);
    const r = await sync(cwd, need(cwd, ref).id);
    return { out: r.updated ? 'updated' : `skipped: ${r.reason}` };
  },

  check(cwd, a, [ref]) {
    const r = check(cwd, ref, { run: !a['no-run'] });
    return { out: r.ok ? 'ok' : r.lines.join('\n'), code: r.drift ? 2 : r.ok ? 0 : 1 };
  },
};

// handover = leave (write); gist = the distilled brief (show); takeover = arrive: show, check, then start the continuation.
COMMANDS.handover = COMMANDS.write;
COMMANDS.gist = COMMANDS.show;
COMMANDS.takeover = (cwd, a, [ref]) => {
  const e = store.resolve(cwd, ref);
  if (!e || !store.readBrief(cwd, e.id)) return { out: `${COMMANDS.from(cwd, a, [ref]).out}\nfill it, then run \`baton takeover ${ref}\` again`, code: 1 };
  const shown = COMMANDS.show(cwd, a, [ref]).out;
  const c = COMMANDS.check(cwd, a, [ref]);
  if (c.code) return { out: `${shown}\n--- check ---\n${c.out}`, code: c.code };
  return { out: `${shown}\n--- check: ok ---\ncontinuation brief: ${COMMANDS.write(cwd, { name: a.name, agent: a.agent, parent: e.id }).out}` };
};

const stripExtract = (t) => { const b = parseBrief(t); delete b.sections.Extract; return serializeBrief(b); };

// Hook mode never fails the host agent: errors go to .baton/sync.log, exit 0.
async function hook(cwd0, stdin, argvJson) {
  if (process.env.BATON_SYNC) return { out: '' };
  let input = {};
  try { input = JSON.parse(stdin || argvJson || '{}'); } catch {}
  const cwd = input.cwd || cwd0;
  const sid = input.session_id || input['thread-id'];
  if (!sid || !store.exists(cwd)) return { out: '' };
  try {
    let e = store.resolve(cwd, sid);
    if (!e) {
      const loc = input.transcript_path ? { agent: input.transcript_path.includes('/.codex/') ? 'codex' : 'claude', path: input.transcript_path } : locate(sid, { home: home() });
      const pend = store.adoptable(cwd);
      if (pend) { store.update(cwd, pend.id, { pending: false, sessionId: sid, sourcePath: loc.path, agent: loc.agent }); e = store.resolve(cwd, pend.id); }
      else e = store.register(cwd, { id: sid, agent: loc.agent, sessionId: sid, sourcePath: loc.path });
    }
    await sync(cwd, e.id);
  } catch (err) { log(cwd, String(err.message || err)); }
  return { out: '' };
}
