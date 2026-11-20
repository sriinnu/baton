import { serializeBrief, FILL } from './brief.js';

const SECRETS = [/sk-[A-Za-z0-9_-]{16,}/g, /ghp_[A-Za-z0-9]{20,}/g, /AKIA[0-9A-Z]{16}/g, /Bearer\s+\S+/g, /github_pat_\w{20,}/g, /gh[osur]_[A-Za-z0-9]{20,}/g, /xox[abprs]-[\w-]{10,}/g, /eyJ[\w-]{8,}\.[\w-]{8,}\.[\w-]{8,}/g, /\b(?:secret|token|password|passwd|api[_-]?key)\s*[:=]\s*['"]?[A-Za-z0-9_\-\/+.]{12,}/gi, /-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----/g];
export const redact = (s) => SECRETS.reduce((t, re) => t.replace(re, '[REDACTED]'), String(s ?? ''));
const uniq = (a) => [...new Set(a)];
// Every Extract item is rendered as ONE list line. A multi-line item breaks the brief:
// a line like "## Summary" inside an assistant turn or a heredoc would parse as a new
// section (and survive stripExtract). So collapse whitespace, and cap after redacting.
const flatLine = (s) => redact(s).replace(/\s+/g, ' ').trim();
const cut = (s, n) => { const f = flatLine(s); return f.length > n ? `${f.slice(0, n - 1)}…` : f; };
// A command is read by its first line; a heredoc or script body only says how long it was.
const cmdLine = (s, n) => {
  const lines = redact(s).split('\n').map((l) => l.trim()).filter(Boolean);
  const more = lines.length > 1 ? ` (+${lines.length - 1} lines)` : '';
  return cut(lines[0] ?? '', n - more.length) + more;
};
// An error keeps its first line (which command failed, the exit code) and its tail (the
// message and failing frame come last). The middle, usually log noise, is what gets cut.
const errLine = (s, n) => {
  const f = flatLine(s);
  if (f.length <= n) return f;
  const first = cut(redact(s).split('\n').find((l) => l.trim()) ?? '', Math.floor(n / 3));
  const room = n - first.length - 3;
  return `${first} … ${f.slice(f.length - room)}`;
};
const SHELL = new Set(['Bash', 'REPL', 'exec_command', 'shell']);

export function skeleton(turns) {
  const users = turns.filter((t) => t.role === 'user');
  return {
    firstGoal: users[0] ? cut(users[0].text, 500) : '',
    files: uniq(turns.flatMap((t) => t.files || [])).map((f) => flatLine(f)),
    commands: turns.filter((t) => SHELL.has(t.tool)).map((t) => cmdLine(t.text, 200)).slice(-30),
    errors: uniq(turns.filter((t) => t.tool === 'result' && /\b(error|failed|exception|traceback)\b/i.test(t.text)).map((t) => errLine(t.text, 300))).slice(0, 10),
    lastUser: users.slice(-5).map((t) => cut(t.text, 500)),
    assistant: turns.filter((t) => t.role === 'assistant').slice(-10).map((t) => cut(t.text, 400)),
  };
}

export const renderExtract = (s) => [
  `first goal: ${s.firstGoal}`,
  `files: ${s.files.join(', ') || 'none'}`,
  `commands:\n${s.commands.map((c) => `- ${c}`).join('\n') || '- none'}`,
  `errors:\n${s.errors.map((c) => `- ${c}`).join('\n') || '- none'}`,
  `last user turns:\n${s.lastUser.map((c) => `- ${c}`).join('\n') || '- none'}`,
  `last assistant turns:\n${(s.assistant || []).map((c) => `- ${c}`).join('\n') || '- none'}`,
].join('\n');

export function scaffold({ meta, skeleton: s, state, lineage = '', mission, readFirst = '' }) {
  return serializeBrief({
    meta,
    sections: {
      Mission: mission || `${FILL} (draft from first goal; root only)`,
      'Read first': readFirst,
      Lineage: lineage,
      Task: FILL, Decisions: FILL, Done: FILL, Next: FILL, 'Dead ends': FILL,
      State: state,
      Extract: renderExtract(s),
    },
  });
}
