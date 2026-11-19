import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import * as store from '../src/store.js';
import { repo } from './helpers.js';

test('init is idempotent and gitignores', () => {
  const { dir } = repo();
  store.init(dir); store.init(dir);
  assert.equal(fs.readFileSync(path.join(dir, '.gitignore'), 'utf8').match(/\.baton\//g).length, 1);
});
test('children inherit root mission id; lineage is root→parent', () => {
  const { dir } = repo(); store.init(dir);
  store.register(dir, { id: 'r', agent: 'claude' });
  store.register(dir, { id: 'c', parent: 'r' });
  const g = store.register(dir, { id: 'g', parent: 'c' });
  assert.equal(g.mission, 'r');
  assert.deepEqual(store.lineage(dir, 'g').map((e) => e.id), ['r', 'c']);
  assert.deepEqual(store.resolve(dir, 'r').children, ['c']);
});
test('names are unique; reassigning moves them; prefix resolves', () => {
  const { dir } = repo(); store.init(dir);
  store.register(dir, { id: 'abcd1234', name: 'fix' });
  store.register(dir, { id: 'ffff0000', name: 'fix' });
  assert.equal(store.resolve(dir, 'fix').id, 'ffff0000');
  assert.equal(store.resolve(dir, 'abcd').id, 'abcd1234');
});
test('unknown parent throws', () => {
  const { dir } = repo(); store.init(dir);
  assert.throws(() => store.register(dir, { id: 'x', parent: 'nope' }), /unknown parent/);
});
