import fs from 'node:fs';

// Record types (codex-cli 0.128): session_meta{id,cwd,source.subagent.thread_spawn.parent_thread_id},
// event_msg/user_message{message}, event_msg/agent_message{message},
// response_item/function_call{name,arguments}, response_item/function_call_output{output}.
export function read(file, from = 0) {
  const lines = fs.readFileSync(file, 'utf8').split('\n').filter(Boolean);
  const turns = [];
  let cwd, parent;
  lines.forEach((l, n) => {
    let r;
    try { r = JSON.parse(l); } catch { return; }
    const p = r.payload || {};
    if (r.type === 'session_meta') { cwd = p.cwd; parent = p.source?.subagent?.thread_spawn?.parent_thread_id; return; }
    if (n < from) return;
    if (r.type === 'event_msg' && p.type === 'user_message') turns.push({ role: 'user', text: p.message });
    else if (r.type === 'event_msg' && p.type === 'agent_message') turns.push({ role: 'assistant', text: p.message });
    else if (r.type === 'response_item' && p.type === 'function_call') {
      let a = {};
      try { a = JSON.parse(p.arguments); } catch {}
      const files = [...String(p.arguments).matchAll(/\*\*\* (?:Update|Add|Delete) File: ([^\s\\"]+)/g)].map((m) => m[1]);
      turns.push({ role: 'tool', tool: p.name, text: a.cmd || a.command || p.name, files });
    } else if (r.type === 'response_item' && p.type === 'function_call_output') turns.push({ role: 'tool', tool: 'result', text: String(p.output ?? '') });
  });
  return { turns, lines: lines.length, cwd, parent, subagents: [] };
}
