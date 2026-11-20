import fs from 'node:fs';
import zlib from 'node:zlib';

// Transcript text; Codex archives old threads as .jsonl.zst (zlib.zstdDecompressSync: Node >= 22.15).
export function readText(file) {
  const buf = fs.readFileSync(file);
  if (!file.endsWith('.zst')) return buf.toString('utf8');
  if (!zlib.zstdDecompressSync) throw new Error(`${file} is zstd-compressed; reading archived Codex sessions needs Node >= 22.15 (this is ${process.version})`);
  return zlib.zstdDecompressSync(buf).toString('utf8');
}
