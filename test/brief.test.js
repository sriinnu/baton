import test from 'node:test';
import assert from 'node:assert/strict';
import { parseBrief, serializeBrief, hasFillMarkers } from '../src/brief.js';

const B = `---\nid: a1\nparent: null\ngenerated: 2026-11-18T10:00:00Z\n---\n\n## Mission\nShip it.\n\n## Done\n- x\n\n## Extract\nraw\n`;

test('round-trips a canonical brief, unknown sections kept last', () => {
  assert.equal(serializeBrief(parseBrief(B)), B);
});
test('null and colon-bearing meta values', () => {
  const { meta } = parseBrief(B);
  assert.equal(meta.parent, null);
  assert.equal(meta.generated, '2026-11-18T10:00:00Z');
});
test('hasFillMarkers', () => {
  assert.equal(hasFillMarkers('## Done\n<!-- fill -->'), true);
  assert.equal(hasFillMarkers(B), false);
});
