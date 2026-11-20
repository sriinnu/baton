#!/usr/bin/env node
// Zip plugin/ (contents at the archive root) to dist/baton-plugin.zip for the "Add plugin" upload.
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const plugin = path.join(root, 'plugin');
const zip = path.join(root, 'dist', 'baton-plugin.zip');
fs.mkdirSync(path.dirname(zip), { recursive: true });
fs.rmSync(zip, { force: true });
const items = ['.claude-plugin', 'skills', 'hooks', 'cli', 'src', 'package.json', 'LICENSE'];
const isZip = () => fs.existsSync(zip) && fs.readFileSync(zip).subarray(0, 2).toString() === 'PK';
try { execFileSync('tar', ['-a', '-c', '-f', zip, ...items], { cwd: plugin, stdio: 'pipe' }); } catch {} // Windows/bsdtar
if (!isZip()) { fs.rmSync(zip, { force: true }); execFileSync('zip', ['-rq', zip, ...items], { cwd: plugin }); } // GNU tar can't zip
console.log(`packed ${path.relative(root, zip)}`);
