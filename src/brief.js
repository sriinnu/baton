export const SECTIONS = ['Mission', 'Lineage', 'Task', 'Decisions', 'Done', 'Next', 'Dead ends', 'Open questions', 'Report back', 'Check', 'State'];
export const FILL = '<!-- fill -->';
export const hasFillMarkers = (t) => /<!-- fill/.test(t);

export function parseBrief(text) {
  const meta = {};
  let body = text;
  const m = text.match(/^---\n([\s\S]*?)\n---\n?/);
  if (m) {
    for (const l of m[1].split('\n')) {
      const i = l.indexOf(':');
      if (i > 0) { const v = l.slice(i + 1).trim(); meta[l.slice(0, i).trim()] = v === 'null' ? null : v; }
    }
    body = text.slice(m[0].length);
  }
  const sections = {};
  const parts = body.split(/^## (.+)$/m);
  for (let i = 1; i < parts.length; i += 2) sections[parts[i].trim()] = parts[i + 1].trim();
  return { meta, sections };
}

export function serializeBrief({ meta, sections }) {
  const fm = Object.entries(meta).map(([k, v]) => `${k}: ${v === null ? 'null' : v}`).join('\n');
  const names = [...SECTIONS.filter((s) => s in sections), ...Object.keys(sections).filter((s) => !SECTIONS.includes(s))];
  const body = names.filter((n) => sections[n]).map((n) => `## ${n}\n${sections[n]}`).join('\n\n');
  return `---\n${fm}\n---\n\n${body}\n`;
}
