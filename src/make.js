import { parseBrief, FILL } from './brief.js';
import { measure, renderState } from './git.js';
import { lineage, readBrief } from './store.js';
import { scaffold } from './extract.js';

const taskLine = (cwd, id) => {
  const t = (parseBrief(readBrief(cwd, id) || '').sections.Task || '').replace(FILL, '').trim().split('\n')[0];
  return (t || '(no task recorded)').slice(0, 120);
};

export function lineageText(cwd, parent) {
  if (!parent) return '';
  return [...lineage(cwd, parent.id), parent].map((e) => `- ${e.id}${e.name ? ` (${e.name})` : ''} — ${taskLine(cwd, e.id)}`).join('\n');
}

export function build(cwd, { id, name, agent, parent, sk, stateCwd = cwd, verify }) {
  const mission = parent ? (parseBrief(readBrief(cwd, parent.id) || '').sections.Mission || '') : '';
  return scaffold({
    meta: { id, name: name ?? null, agent: agent ?? 'unknown', parent: parent?.id ?? null, mission: parent?.mission ?? id, generated: new Date().toISOString() },
    skeleton: sk, state: renderState(measure(stateCwd), verify), lineage: lineageText(cwd, parent), mission,
  });
}
