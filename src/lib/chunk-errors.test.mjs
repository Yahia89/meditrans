import assert from 'node:assert/strict';
import test from 'node:test';
import { isChunkLoadError } from './chunk-errors.ts';

test('recognizes Chrome, Firefox and Safari chunk failures without treating ordinary API errors as stale deployments', () => {
  for (const message of ['Failed to fetch dynamically imported module: /assets/old.js', 'error loading dynamically imported module', 'Importing a module script failed.', 'Loading chunk settings failed.']) {
    assert.equal(isChunkLoadError(new Error(message)), true);
  }
  assert.equal(isChunkLoadError(new Error('Permission denied')), false);
  assert.equal(isChunkLoadError(new Error('Failed to fetch')), false);
});
