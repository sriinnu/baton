#!/usr/bin/env node
import fs from 'node:fs';
import { parseArgs } from 'node:util';
import { COMMANDS } from '../src/commands.js';

const [cmd, ...rest] = process.argv.slice(2);
const OPTS = { name: { type: 'string' }, parent: { type: 'string' }, agent: { type: 'string' }, path: { type: 'string' }, id: { type: 'string' }, task: { type: 'string' }, 'agent-id': { type: 'string' }, hook: { type: 'boolean' }, bg: { type: 'boolean' }, 'no-run': { type: 'boolean' } };
const fn = COMMANDS[cmd];
if (!fn) { console.error(`usage: baton <${Object.keys(COMMANDS).join('|')}> [args]`); process.exit(1); }
const { values, positionals } = parseArgs({ args: rest, options: OPTS, allowPositionals: true, strict: false });
const hookMode = cmd === 'sync' && values.hook;
const stdin = hookMode && !process.stdin.isTTY ? fs.readFileSync(0, 'utf8') : '';
try {
  const r = await fn(process.cwd(), values, positionals, stdin);
  if (r.out) console.log(r.out);
  process.exit(hookMode ? 0 : r.code ?? 0);
} catch (e) {
  if (hookMode) process.exit(0);
  console.error(`baton: ${e.message}`);
  process.exit(1);
}
