import fs from 'node:fs';

export function read(file, from = 0) {
  const lines = fs.readFileSync(file, 'utf8').split('\n').filter(Boolean);
  const turns = [];
  let ok = true;
  for (const l of lines.slice(from)) {
    try {
      const r = JSON.parse(l);
      const t = typeof r.content === 'string' ? r.content : JSON.stringify(r.content ?? r.text ?? '');
      if (r.role) turns.push({ role: r.role === 'user' ? 'user' : 'assistant', text: t }); else ok = false;
    } catch { ok = false; }
  }
  if (!ok || !turns.length) return { turns: lines.length > from ? [{ role: 'user', text: lines.slice(from).join('\n') }] : [], lines: lines.length, subagents: [] };
  return { turns, lines: lines.length, subagents: [] };
}
