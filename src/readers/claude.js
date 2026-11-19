import fs from 'node:fs';
import path from 'node:path';

const SKIP = /^<(system-reminder|local-command|command-name|command-message|task-notification)/;
const text = (c) => (typeof c === 'string' ? c : (c || []).filter((b) => b.type === 'text').map((b) => b.text).join('\n'));

export function parse(content, from = 0, isSub = false) {
  const lines = content.split('\n').filter(Boolean);
  const turns = [];
  let cwd;
  lines.forEach((l, n) => {
    let r;
    try { r = JSON.parse(l); } catch { return; }
    cwd ??= r.cwd;
    if (n < from || (r.isSidechain && !isSub) || r.isCompactSummary || r.isMeta) return;
    const c = r.message?.content;
    if (r.type === 'user') {
      if (typeof c === 'string') { if (!SKIP.test(c.trim())) turns.push({ role: 'user', text: c }); return; }
      for (const b of c || []) {
        if (b.type === 'text' && !SKIP.test(b.text.trim())) turns.push({ role: 'user', text: b.text });
        else if (b.type === 'tool_result') turns.push({ role: 'tool', tool: 'result', text: text(b.content) });
      }
    } else if (r.type === 'assistant') {
      for (const b of c || []) {
        if (b.type === 'text' && b.text.trim()) turns.push({ role: 'assistant', text: b.text });
        else if (b.type === 'tool_use') {
          const i = b.input || {};
          const f = i.file_path || i.path || i.notebook_path;
          turns.push({ role: 'tool', tool: b.name, text: i.command || `${b.name} ${f || ''}`.trim(), files: f ? [f] : [] });
        }
      }
    }
  });
  return { turns, lines: lines.length, cwd };
}

// --- node-only ---
export function read(file, from = 0) {
  const isSub = file.includes(`${path.sep}subagents${path.sep}`);
  const subDir = path.join(file.replace(/\.jsonl$/, ''), 'subagents');
  const subagents = fs.existsSync(subDir)
    ? fs.readdirSync(subDir).filter((f) => f.endsWith('.jsonl')).map((f) => ({ id: f.replace(/^agent-|\.jsonl$/g, ''), path: path.join(subDir, f) }))
    : [];
  return { ...parse(fs.readFileSync(file, 'utf8'), from, isSub), subagents };
}
