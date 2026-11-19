import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const dir = (cwd) => path.join(cwd, '.baton');
const idxPath = (cwd) => path.join(dir(cwd), 'index.json');
const load = (cwd) => JSON.parse(fs.readFileSync(idxPath(cwd), 'utf8'));
const save = (cwd, i) => fs.writeFileSync(idxPath(cwd), JSON.stringify(i, null, 2) + '\n');

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
  const gi = path.join(cwd, '.gitignore');
  if (fs.existsSync(path.join(cwd, '.git'))) {
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
  const i = load(cwd);
  const e = i.briefs[o.id] ?? { id: o.id, name: null, agent: null, parent: null, sessionId: null, sourcePath: null, sourceOffset: 0, children: [] };
  for (const k of ['name', 'agent', 'parent', 'sessionId', 'sourcePath', 'pending']) if (o[k] !== undefined) e[k] = o[k];
  if (e.parent && !i.briefs[e.parent]) throw new Error(`unknown parent: ${e.parent}`);
  if (o.name) for (const x of Object.values(i.briefs)) if (x.id !== e.id && x.name === o.name) x.name = null;
  e.mission = e.parent ? i.briefs[e.parent].mission : e.id;
  if (e.parent && !i.briefs[e.parent].children.includes(e.id)) i.briefs[e.parent].children.push(e.id);
  e.updated = new Date().toISOString();
  i.briefs[e.id] = e;
  save(cwd, i);
  return e;
}

export function update(cwd, id, patch) {
  const i = load(cwd);
  Object.assign(i.briefs[id], patch, { updated: new Date().toISOString() });
  save(cwd, i);
}

export const adoptable = (cwd) => all(cwd).find((e) => e.pending);

export function lineage(cwd, id) {
  const i = load(cwd);
  const chain = [];
  for (let e = i.briefs[id] && i.briefs[i.briefs[id].parent]; e; e = i.briefs[e.parent]) chain.unshift(e);
  return chain;
}

export const readBrief = (cwd, id) => (fs.existsSync(briefPath(cwd, id)) ? fs.readFileSync(briefPath(cwd, id), 'utf8') : null);
export const writeBrief = (cwd, id, text) => { fs.mkdirSync(path.join(dir(cwd), 'briefs'), { recursive: true }); fs.writeFileSync(briefPath(cwd, id), text); };
