import { parseBrief, FILL } from './brief.js';
import { measure, renderState } from './git.js';
import { lineage, readBrief, config } from './store.js';
import fs from 'node:fs';
import path from 'node:path';
import { scaffold } from './extract.js';

const taskLine = (cwd, id) => {
  const t = (parseBrief(readBrief(cwd, id) || '').sections.Task || '').replace(FILL, '').trim().split('\n')[0];
  return (t || '(no task recorded)').slice(0, 120);
};

export function lineageText(cwd, parent) {
  if (!parent) return '';
  return [...lineage(cwd, parent.id), parent].map((e) => `- ${e.id}${e.name ? ` (${e.name})` : ''} — ${taskLine(cwd, e.id)}`).join('\n');
}

// Files a cold agent should read to catch up: well-known mission/knowledge files plus .baton/config.json `readFirst`.
const KNOWN = ['MISSION.md', 'mission.md', 'docs/MISSION.md', 'docs/mission.md', 'KNOWLEDGE.md', 'docs/knowledge.md'];
export const readFirst = (cwd, at) => [...new Set([...KNOWN, ...(config(cwd).readFirst || [])])].filter((f) => fs.existsSync(path.join(at, f))).map((f) => `- ${f}`).join('\n');

export function build(cwd, { id, name, agent, model, parent, sk, stateCwd = cwd, verify }) {
  const mission = parent ? (parseBrief(readBrief(cwd, parent.id) || '').sections.Mission || '') : '';
  return scaffold({
    meta: { id, name: name ?? null, agent: agent ?? 'unknown', ...(model && { model }), parent: parent?.id ?? null, mission: parent?.mission ?? id, generated: new Date().toISOString() },
    skeleton: sk, state: renderState(measure(stateCwd), verify), lineage: lineageText(cwd, parent), mission, readFirst: readFirst(cwd, stateCwd),
  });
}
