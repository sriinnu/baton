#!/usr/bin/env node
// Fake model: echoes the CURRENT BRIEF with Done filled; BATON_FAKE=badmission alters Mission; =fail exits 1.
import fs from 'node:fs';
const mode = process.env.BATON_FAKE || '';
if (mode === 'fail') { console.error('boom'); process.exit(1); }
const input = fs.readFileSync(0, 'utf8');
let brief = input.split('=== CURRENT BRIEF ===\n')[1].split('=== NEW ACTIVITY ===')[0];
brief = brief.replace(/<!-- fill[^>]*-->/g, 'filled');
if (mode === 'badmission') brief = brief.replace(/## Mission\n[^\n]*/, '## Mission\nHIJACKED');
console.log(brief.replace('## Done\nfilled', '## Done\n- did the thing'));
