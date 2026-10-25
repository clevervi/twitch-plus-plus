import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';

import { check, isNewer, parseVersion } from '../src/core/updater.js';

afterEach(() => {
  delete globalThis.GM_getValue;
  delete globalThis.GM_setValue;
  delete globalThis.GM_xmlhttpRequest;
});

function instalarGm(handler) {
  const memory = new Map();
  globalThis.GM_getValue = (key, fallback) => (memory.has(key) ? memory.get(key) : fallback);
  globalThis.GM_setValue = (key, value) => memory.set(key, value);
  globalThis.GM_xmlhttpRequest = handler;
  return memory;
}

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

test('un fallo de red no quema la comprobación diaria', async () => {
  const memory = instalarGm(({ onerror }) => onerror());
  const result = await check({ force: false, timeout: 50 });

  assert.equal(result.error, 'sin respuesta del repo');
  assert.equal(memory.has('twpp.update.lastCheck'), false, 'debe reintentar en el siguiente arranque');
});

test('una respuesta válida sí marca la comprobación', async () => {
  const memory = instalarGm(({ onload }) =>
    onload({ status: 200, responseText: JSON.stringify({ version: '99.0.0' }) }),
  );
  const result = await check({ force: true, timeout: 50 });

  assert.equal(result.update, true);
  assert.equal(typeof memory.get('twpp.update.lastCheck'), 'number');
});
