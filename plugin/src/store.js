import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { mainRoot } from './git.js';

const dir = (cwd) => path.join(mainRoot(cwd), '.baton');
const idxPath = (cwd) => path.join(dir(cwd), 'index.json');
const load = (cwd) => JSON.parse(fs.readFileSync(idxPath(cwd), 'utf8'));
// Atomic replace: a reader never sees a half-written index (hooks from parallel sessions share one store).
const save = (cwd, i) => {
  const tmp = `${idxPath(cwd)}.${process.pid}.${crypto.randomBytes(3).toString('hex')}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(i, null, 2) + '\n');
  fs.renameSync(tmp, idxPath(cwd));
};

// Read-modify-write under an exclusive lock, so concurrent register/update calls cannot drop each other's writes.
const LOCK_WAIT_MS = 10000;
const LOCK_STALE_MS = 30000; // a holder that died mid-write
const nap = (ms) => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
function mutate(cwd, fn) {
  const lock = `${idxPath(cwd)}.lock`;
  const deadline = Date.now() + LOCK_WAIT_MS;
  let fd;
  for (;;) {
    try { fd = fs.openSync(lock, 'wx'); break; } catch (e) {
      if (e.code !== 'EEXIST') throw e;
      try { if (Date.now() - fs.statSync(lock).mtimeMs > LOCK_STALE_MS) { fs.rmSync(lock, { force: true }); continue; } } catch {}
      if (Date.now() > deadline) throw new Error(`index locked: ${lock}`);
      nap(5 + Math.random() * 20);
    }
  }
  try {
    const i = load(cwd);
    const r = fn(i);
    save(cwd, i);
    return r;
  } finally {
    fs.closeSync(fd);
    fs.rmSync(lock, { force: true });
  }
}

export const storeDir = dir;
export const exists = (cwd) => fs.existsSync(idxPath(cwd));
export const newId = () => crypto.randomBytes(4).toString('hex');
export const briefPath = (cwd, id) => path.join(dir(cwd), 'briefs', `${id}.md`);
export const all = (cwd) => Object.values(load(cwd).briefs);
export const config = (cwd) => ({ runner: 'claude', model: 'haiku', ...JSON.parse(fs.readFileSync(path.join(dir(cwd), 'config.json'), 'utf8')) });

export function init(cwd) {
  fs.mkdirSync(path.join(dir(cwd), 'briefs'), { recursive: true });
  if (!exists(cwd)) save(cwd, { briefs: {} });
  const cfg = path.join(dir(cwd), 'config.json');
  if (!fs.existsSync(cfg)) fs.writeFileSync(cfg, JSON.stringify({ runner: 'claude', model: 'haiku' }, null, 2) + '\n');
  const root = mainRoot(cwd);
  const gi = path.join(root, '.gitignore');
  if (fs.existsSync(path.join(root, '.git'))) {
    const cur = fs.existsSync(gi) ? fs.readFileSync(gi, 'utf8') : '';
    if (!/^\.baton\/?$/m.test(cur)) fs.writeFileSync(gi, cur + (cur && !cur.endsWith('\n') ? '\n' : '') + '.baton/\n');
  }
}

export function resolve(cwd, ref) {
  if (!exists(cwd) || !ref) return null;
  const b = Object.values(load(cwd).briefs);
  const hit = b.find((e) => e.id === ref) || b.find((e) => e.name === ref) || b.find((e) => e.sessionId === ref);
  if (hit) return hit;
  const pre = ref.length >= 4 ? b.filter((e) => e.id.startsWith(ref)) : [];
  return pre.length === 1 ? pre[0] : null;
}

export function register(cwd, o) {
  return mutate(cwd, (i) => {
  const e = i.briefs[o.id] ?? { id: o.id, name: null, agent: null, parent: null, sessionId: null, sourcePath: null, sourceOffset: 0, children: [] };
  for (const k of ['name', 'agent', 'parent', 'sessionId', 'sourcePath', 'pending', 'pendingFrom']) if (o[k] !== undefined) e[k] = o[k];
  if (e.parent && !i.briefs[e.parent]) throw new Error(`unknown parent: ${e.parent}`);
  if (o.name) for (const x of Object.values(i.briefs)) if (x.id !== e.id && x.name === o.name) x.name = null;
  e.mission = e.parent ? i.briefs[e.parent].mission : e.id;
  if (e.parent && !i.briefs[e.parent].children.includes(e.id)) i.briefs[e.parent].children.push(e.id);
  e.updated = new Date().toISOString();
  e.created ??= e.updated;
  i.briefs[e.id] = e;
  return e;
  });
}

export function update(cwd, id, patch) {
  mutate(cwd, (i) => { Object.assign(i.briefs[id], patch, { updated: new Date().toISOString() }); });
}

// A pending brief is adopted by the next *other* session within an hour (not by its writer, not much later).
// "Other" is decided by when the session began: one that started before the handover was written is the
// writer (or an unrelated older session), whatever its id. pendingFrom covers sessions whose start is unknown.
// A takeover claim (continuation made by `takeover` where the session id was unknown) is the reverse case: the
// arriving session is already running, so it is exempt from the began-after rule. Newest claim wins.
export const adoptable = (cwd, sid, started) => all(cwd)
  .filter((e) => e.pending && e.pendingFrom !== sid && Date.now() - Date.parse(e.updated) < 3600000
    && (e.takeover || !started || Date.parse(started) >= Date.parse(e.created || e.updated)))
  .sort((x, y) => Date.parse(y.created || y.updated) - Date.parse(x.created || x.updated))[0];

export function lineage(cwd, id) {
  const i = load(cwd);
  const chain = [];
  for (let e = i.briefs[id] && i.briefs[i.briefs[id].parent]; e; e = i.briefs[e.parent]) chain.unshift(e);
  return chain;
}

export const readBrief = (cwd, id) => (fs.existsSync(briefPath(cwd, id)) ? fs.readFileSync(briefPath(cwd, id), 'utf8') : null);
export const writeBrief = (cwd, id, text) => { fs.mkdirSync(path.join(dir(cwd), 'briefs'), { recursive: true }); fs.writeFileSync(briefPath(cwd, id), text); };
