import fs from 'node:fs';

// Record types (codex-cli 0.128): session_meta{id,cwd,source.subagent.thread_spawn.parent_thread_id},
// event_msg/user_message{message}, event_msg/agent_message{message},
// response_item/function_call{name,arguments}, response_item/function_call_output{output}.
export function parse(content, from = 0) {
  const lines = content.split('\n').filter(Boolean);
  const turns = [];
  let cwd, parent, usage;
  lines.forEach((l, n) => {
    let r;
    try { r = JSON.parse(l); } catch { return; }
    const p = r.payload || {};
    if (r.type === 'session_meta') { cwd = p.cwd; parent = p.source?.subagent?.thread_spawn?.parent_thread_id; return; }
    if (r.type === 'event_msg' && p.type === 'token_count' && p.info) usage = { context: p.info.last_token_usage?.input_tokens || 0, read: p.info.total_token_usage?.cached_input_tokens || 0, write: null }; // codex does not report cache writes
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
  return { turns, lines: lines.length, cwd, parent, ...(usage && { usage }) };
}

// --- node-only ---
export function read(file, from = 0) {
  return { ...parse(fs.readFileSync(file, 'utf8'), from), subagents: [] };
}
