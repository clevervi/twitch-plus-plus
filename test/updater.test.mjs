import assert from 'node:assert/strict';
import test from 'node:test';

import { isNewer, parseVersion } from '../src/core/updater.js';

test('parseVersion tolera sufijos de pre-release', () => {
  assert.deepEqual(parseVersion('2.1.0-beta.1'), [2, 1, 0]);
  assert.deepEqual(parseVersion('v10'), [10, 0, 0]);
  assert.deepEqual(parseVersion(undefined), [0, 0, 0]);
});

test('isNewer compara por componentes', () => {
  assert.equal(isNewer('2.0.1', '2.0.0'), true);
  assert.equal(isNewer('2.1.0', '2.0.9'), true);
  assert.equal(isNewer('3.0.0', '2.99.99'), true);
  assert.equal(isNewer('2.0.0', '2.0.0'), false);
  assert.equal(isNewer('1.9.9', '2.0.0'), false);
  assert.equal(isNewer('', '2.0.0'), false);
});
