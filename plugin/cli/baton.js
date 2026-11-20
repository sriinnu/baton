#!/usr/bin/env node
import { parseArgs } from 'node:util';
import { COMMANDS } from '../src/commands.js';

const [cmd, ...rest] = process.argv.slice(2);
const OPTS = { name: { type: 'string' }, parent: { type: 'string' }, agent: { type: 'string' }, model: { type: 'string' }, provider: { type: 'string' }, path: { type: 'string' }, id: { type: 'string' }, task: { type: 'string' }, 'agent-id': { type: 'string' }, hook: { type: 'boolean' }, run: { type: 'boolean' }, distill: { type: 'boolean' }, limit: { type: 'string' } };
const fn = COMMANDS[cmd];
if (!fn) { console.error(`usage: baton <${Object.keys(COMMANDS).join('|')}> [args]`); process.exit(1); }
const { values, positionals } = parseArgs({ args: rest, options: OPTS, allowPositionals: true, strict: false });
const legacyHook = cmd === 'sync' && values.hook; // see COMMANDS.sync: must never fail an old hook
try {
  const r = await fn(process.cwd(), values, positionals);
  if (r.out) console.log(r.out);
  process.exit(legacyHook ? 0 : r.code ?? 0);
} catch (e) {
  if (legacyHook) process.exit(0);
  console.error(`baton: ${e.message}`);
  process.exit(1);
}
