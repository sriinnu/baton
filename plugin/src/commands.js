import fs from 'node:fs';
import os from 'node:os';
import { parseBrief, serializeBrief, hasFillMarkers } from './brief.js';
import { measure, parseState, drift, mainRoot } from './git.js';
import * as store from './store.js';
import { locate, read, find, AGENTS } from './readers/index.js';
import { skeleton } from './extract.js';
import { build, lineageText } from './make.js';
import { sync } from './sync.js';
import { check } from './check.js';
import { doctor } from './doctor.js';

const need = (cwd, ref) => {
  if (!store.exists(cwd)) throw new Error('not initialised; run `baton init`');
  const e = store.resolve(cwd, ref);
  if (!e) throw new Error(`unknown brief: ${ref}`);
  return e;
};
const home = () => os.homedir();
// The session this command runs inside, when the host agent exposes it (Claude Code, Codex).
const agentSession = () => process.env.CLAUDE_CODE_SESSION_ID || process.env.CLAUDE_SESSION_ID || process.env.CODEX_THREAD_ID || undefined;
// The agent baton runs inside, from the env var its host sets, so a skill shared by Claude Code and
// Codex never has to hard-code `--agent` (it used to say `--agent claude`, mislabelling Codex briefs).
const hostAgent = () => (process.env.CODEX_THREAD_ID ? 'codex' : process.env.CLAUDE_CODE_SESSION_ID || process.env.CLAUDE_SESSION_ID ? 'claude' : undefined);

export const COMMANDS = {
  init: (cwd) => {
    const how = { excluded: ' (ignored via .git/info/exclude)', 'already-ignored': ' (already ignored by git)', 'no-repo': ' (not a git repo)' }[store.init(cwd)];
    return { out: `initialised .baton/${how}` };
  },

  write(cwd, a) {
    if (!store.exists(cwd)) throw new Error('not initialised; run `baton init`');
    a = { ...a, agent: a.agent ?? hostAgent() };
    const parent = a.parent ? need(cwd, a.parent) : null;
    const id = a.id || store.newId();
    store.writeBrief(cwd, id, stripExtract(build(cwd, { id, name: a.name, agent: a.agent, model: a.model, parent, sk: skeleton([]) })));
    // The session writing the brief is its source, when the host agent exposes its id: `baton sync` can then refresh it.
    store.register(cwd, { id, name: a.name, agent: a.agent, parent: parent?.id, sessionId: a.id || agentSession() });
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
    return { out: text + tokenLine(e, text) + (d.length ? `\n⚠ drift since brief:\n${d.map((x) => `- ${x}`).join('\n')}\n` : '') + (hasFillMarkers(text) ? '\n⚠ brief has unfilled sections (<!-- fill -->)\n' : '') };
  },

  child(cwd, a, [ref]) {
    const p = need(cwd, ref);
    if (!a.task) throw new Error('--task required');
    const pb = parseBrief(store.readBrief(cwd, p.id) || '');
    const id = store.newId();
    a = { ...a, agent: a.agent ?? hostAgent() };
    const e = store.register(cwd, { id, agent: a.agent, parent: p.id, sessionId: a['agent-id'] });
    const t = parseBrief(build(cwd, { id, agent: a.agent, parent: p, sk: skeleton([]) }));
    t.sections = {
      Mission: pb.sections.Mission, 'Read first': pb.sections['Read first'], Lineage: lineageText(cwd, p), Task: a.task,
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
    const line = `- ${c.id}${c.name ? ` (${c.name})` : ''} — ${first(cb.sections.Done).replace(/^- /, '').slice(0, 120)}`;
    pb.sections.Lineage = (pb.sections.Lineage || '').split('\n').filter((l) => !l.startsWith(`- ${c.id} `)).concat(line).filter(Boolean).join('\n');
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

  async sync(cwd, a, [ref]) {
    // baton <= 0.1 ran `sync --hook` from agent hooks on every turn. That is gone; an old hook or Codex notify line
    // still calling it must not fail the agent, so it does nothing.
    if (a.hook) return { out: '' };
    const r = await sync(cwd, need(cwd, ref).id);
    return { out: r.updated ? `updated (${r.calls} model call${r.calls === 1 ? '' : 's'})` : `skipped: ${r.reason}` };
  },

  doctor(cwd, a) {
    return doctor({ home: home(), limit: Number(a.limit) || 5 });
  },
  check(cwd, a, [ref]) {
    const r = check(cwd, ref, { run: !!a.run });
    return { out: r.ok ? ['ok', r.note].filter(Boolean).join('\n') : r.lines.join('\n'), code: r.drift ? 2 : r.ok ? 0 : 1 };
  },
};

// handover = leave (write); gist = the distilled brief (show); takeover = arrive: show, check, then start the continuation.
COMMANDS.handover = COMMANDS.write;
COMMANDS.gist = COMMANDS.show;
// takeover [claude|codex] <ref>: ref is a brief (name/id), or a session (id, id prefix, name, "last").
// A session with no brief yet gets one: the extract (no model) for the arriving agent to fill, or with --distill
// the cheap model reads the whole session once and fills it.
COMMANDS.takeover = async (cwd, a, args) => {
  if (!store.exists(cwd)) throw new Error('not initialised; run `baton init`');
  const [agent, ref] = AGENTS.includes(args[0]) && args[1] ? [args[0], args[1]] : [undefined, args[0]];
  if (!ref) throw new Error('usage: baton takeover [claude|codex] <brief | session id | name | last> [--name n] [--distill]');
  let e = agent ? null : store.resolve(cwd, ref);
  let what = e && `brief ${e.name || e.id}`;
  if (!e) {
    const s = find(ref, { home: home(), agent, roots: [...new Set([cwd, mainRoot(cwd)])] });
    e = store.resolve(cwd, s.id) || { id: s.id, sessionId: s.id };
    what = `${s.agent} session ${s.id}${s.title ? ` "${s.title}"` : ''}`;
  }
  let started = false;
  if (!store.readBrief(cwd, e.id)) {
    COMMANDS.from(cwd, {}, [e.sessionId || e.id]);
    e = store.resolve(cwd, e.sessionId || e.id);
    started = true;
  }
  if (a.distill && hasFillMarkers(store.readBrief(cwd, e.id))) {
    const r = await sync(cwd, e.id, { full: true });
    if (!r.updated) return { out: `${store.briefPath(cwd, e.id)}\ndistill skipped: ${r.reason}`, code: 1 };
  } else if (started) {
    return { out: `${store.briefPath(cwd, e.id)}\nbrief started from ${what}: fill the <!-- fill --> sections from its ## Extract (then delete Extract), or rerun with --distill to have the cheap model read the whole session; then run \`baton takeover ${e.id}\` again`, code: 1 };
  }
  const shown = COMMANDS.show(cwd, a, [e.id]).out;
  const c = COMMANDS.check(cwd, a, [e.id]);
  if (c.code) return { out: `${shown}\n--- check ---\n${c.out}`, code: c.code };
  // The continuation belongs to the session running takeover (write binds it when the agent exposes its id).
  const cont = COMMANDS.write(cwd, { name: a.name, agent: a.agent, model: a.model, parent: e.id }).out;
  return { out: `${shown}\n--- check: ok ---\ncontinuation brief: ${cont}\n${switchBlock(e, a, store.readBrief(cwd, e.id))}` };
};

const k = (n) => (n >= 1e6 ? `${(n / 1e6).toFixed(1)}M` : n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n));
const PROVIDERS = [[/^(claude|opus|sonnet|haiku|fable)/i, 'Anthropic'], [/^(gpt|o\d|codex|chatgpt)/i, 'OpenAI'], [/^gemini/i, 'Google']];
const providerOf = (model, agent) => (model && PROVIDERS.find(([r]) => r.test(model))?.[1]) || { claude: 'Anthropic', codex: 'OpenAI' }[agent] || 'unknown';
const who = (model, agent, provider) => `${provider || providerOf(model, agent)} · ${model || 'unknown model'}${agent && agent !== 'unknown' ? ` (${agent})` : ''}`;
const session = (e) => { try { return (e.sourcePath && read(e.agent, e.sourcePath, 1e9)) || {}; } catch { return {}; } };

// Who handed over to whom, and what the switch saved. Tokens are measured from the old transcript (brief = chars ÷ 4);
// the new model is whatever the taking-over agent passes as --model, since nothing else can know it.
function switchBlock(e, a, text) {
  const { usage: u, model: seen } = session(e);
  const meta = parseBrief(text).meta;
  const brief = Math.ceil(text.length / 4);
  const lines = ['--- switch ---', `from: ${who(meta.model || seen, e.agent)}`, `to:   ${a.model ? who(a.model, a.agent, a.provider) : 'unknown (the taking-over agent should pass --model <id>)'}`];
  if (u) lines.push(`context: old session ≈ ${k(u.context)} → brief ≈ ${k(brief)}; ~${k(Math.max(0, u.context - brief))} not re-sent cold (est.)`, `cache: old session read ${k(u.read)}${u.write == null ? '' : `, wrote ${k(u.write)}`}; caches do not carry to a new model, so it starts empty`);
  else lines.push(`context: brief ≈ ${k(brief)} (no session transcript linked, so the old context size is unknown)`);
  return lines.join('\n');
}

// Cache reads/writes are measured from the transcript; a miss is not recorded, so none is claimed.
function tokenLine(e, text) {
  const brief = Math.ceil(text.length / 4);
  const u = session(e).usage;
  if (!u) return `\ntokens: brief ≈ ${k(brief)} (chars ÷ 4)\n`;
  return `\ntokens: session context ≈ ${k(u.context)} · cache reads (all turns) ${k(u.read)}${u.write == null ? '' : ` · writes ${k(u.write)}`} | brief ≈ ${k(brief)} → a fresh session starts ~${Math.max(1, Math.round(u.context / brief))}x smaller\n`;
}

const stripExtract = (t) => { const b = parseBrief(t); delete b.sections.Extract; return serializeBrief(b); };
