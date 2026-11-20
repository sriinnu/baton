import { readText } from './text.js';

// Two on-disk formats, picked per file:
//  legacy (codex-cli <= 0.13x): event_msg/user_message|agent_message, response_item/function_call(+_output),
//    event_msg/token_count{info}, session_meta.source.subagent.thread_spawn.parent_thread_id.
//  items (codex 0.16x, Desktop + CLI): event_msg/item_completed{item:{type: UserMessage | AgentMessage |
//    CommandExecution | FileChange | McpToolCall | ...}}, token_usage_record{usage}, session_meta.parent_thread_id,
//    event_msg/thread_settings_applied{thread_settings.model}. The same file also carries response_item/message
//    records (AGENTS.md and environment injections as role "user"), which are model input, not the conversation.
const TAIL = 600;
const tail = (s) => { const t = String(s ?? ''); return t.length > TAIL ? '…' + t.slice(-TAIL) : t; };
const texts = (c) => (Array.isArray(c) ? c.filter((b) => typeof b?.text === 'string').map((b) => b.text).join('\n') : typeof c === 'string' ? c : '');
const shellText = (i) => (Array.isArray(i.parsed_cmd) && i.parsed_cmd.length ? i.parsed_cmd.map((p) => p.cmd).filter(Boolean).join(' && ') : '') || (Array.isArray(i.command) ? i.command.at(-1) : i.command) || '';

function item(i, turns) {
  switch (i.type) {
    case 'UserMessage': { const t = texts(i.content); if (t.trim()) turns.push({ role: 'user', text: t }); return; }
    case 'AgentMessage': { const t = texts(i.content); if (t.trim()) turns.push({ role: 'assistant', text: t, ...(i.phase && { phase: i.phase }) }); return; }
    case 'CommandExecution': {
      turns.push({ role: 'tool', tool: 'exec_command', text: shellText(i), files: [] });
      const failed = typeof i.exit_code === 'number' && i.exit_code !== 0;
      turns.push({ role: 'tool', tool: 'result', text: (failed ? `command failed (exit ${i.exit_code}): ` : '') + tail(i.aggregated_output) });
      return;
    }
    case 'FileChange': {
      const files = Object.keys(i.changes || {});
      turns.push({ role: 'tool', tool: 'apply_patch', text: `apply_patch ${files.join(' ')}`.trim(), files });
      if (i.status && i.status !== 'completed') turns.push({ role: 'tool', tool: 'result', text: `patch failed: ${tail(i.stderr || i.stdout)}` });
      return;
    }
    case 'McpToolCall': {
      const name = [i.server, i.tool].filter(Boolean).join('.');
      turns.push({ role: 'tool', tool: name || 'mcp', text: name || 'mcp', files: [] });
      if (i.status && i.status !== 'completed') turns.push({ role: 'tool', tool: 'result', text: `mcp call failed: ${name}` });
      return;
    }
    default: // Reasoning, ContextCompaction, SubAgentActivity, Extension, CollabAgentToolCall, ...: not conversation
  }
}

function legacy(r, p, turns) {
  if (r.type === 'event_msg' && p.type === 'user_message') turns.push({ role: 'user', text: p.message });
  else if (r.type === 'event_msg' && p.type === 'agent_message') turns.push({ role: 'assistant', text: p.message });
  else if (r.type === 'response_item' && p.type === 'function_call') {
    let a = {};
    try { a = JSON.parse(p.arguments); } catch {}
    const files = [...String(p.arguments).matchAll(/\*\*\* (?:Update|Add|Delete) File: ([^\s\\"]+)/g)].map((m) => m[1]);
    turns.push({ role: 'tool', tool: p.name, text: a.cmd || a.command || p.name, files });
  } else if (r.type === 'response_item' && p.type === 'function_call_output') turns.push({ role: 'tool', tool: 'result', text: String(p.output ?? '') });
}

export function parse(content, from = 0) {
  const lines = content.split('\n').filter(Boolean);
  const items = content.includes('"item_completed"'); // a file is one format or the other
  const turns = [];
  let cwd, parent, model, started, id, legacyUsage;
  const recs = []; // token_usage_record usage, per response
  lines.forEach((l, n) => {
    let r;
    try { r = JSON.parse(l); } catch { return; }
    const p = r.payload || {};
    if (r.type === 'session_meta') {
      id ??= p.id; cwd ??= p.cwd; started ??= p.timestamp || r.timestamp;
      parent ??= p.parent_thread_id || p.source?.subagent?.thread_spawn?.parent_thread_id;
      return;
    }
    if (r.type === 'turn_context' && p.model) model = p.model;
    if (r.type === 'event_msg' && p.type === 'thread_settings_applied' && p.thread_settings?.model && (!p.thread_id || !id || p.thread_id === id)) model = p.thread_settings.model;
    if (r.type === 'token_usage_record' && p.usage && (!p.thread_id || !id || p.thread_id === id)) recs.push(p.usage);
    if (r.type === 'event_msg' && p.type === 'token_count' && p.info) legacyUsage = { context: p.info.last_token_usage?.input_tokens || 0, read: p.info.total_token_usage?.cached_input_tokens || 0, write: null }; // legacy codex does not report cache writes
    if (n < from) return;
    if (items) { if (r.type === 'event_msg' && p.type === 'item_completed' && p.item) item(p.item, turns); }
    else legacy(r, p, turns);
  });
  // input_tokens already includes the cached part (OpenAI usage), so it is the whole context of the last call.
  const usage = recs.length
    ? { context: recs.at(-1).input_tokens || 0, read: recs.reduce((a, u) => a + (u.cached_input_tokens || 0), 0), write: recs.reduce((a, u) => a + (u.cache_write_input_tokens || 0), 0) }
    : legacyUsage;
  return { turns, lines: lines.length, cwd, parent, ...(started && { started }), ...(model && { model }), ...(usage && { usage }) };
}

// --- node-only ---
export function read(file, from = 0) {
  return { ...parse(readText(file), from), subagents: [] };
}
