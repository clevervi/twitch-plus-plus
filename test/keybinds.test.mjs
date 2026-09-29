import assert from 'node:assert/strict';
import test from 'node:test';

import { createDomStub } from '../tools/dom-stub.mjs';

let env = null;
async function keybinds() {
  if (env) return env;
  const stub = createDomStub();
  globalThis.document = stub.document;
  globalThis.window = stub.window;
  globalThis.getComputedStyle = stub.getComputedStyle;

  const memory = new Map();
  globalThis.GM_getValue = (key, fallback) => (memory.has(key) ? memory.get(key) : fallback);
  globalThis.GM_setValue = (key, value) => memory.set(key, value);
  globalThis.GM_deleteValue = (key) => memory.delete(key);

  const module = await import('../src/core/keybinds.js');
  const store = await import('../src/core/store.js');
  store.declare('keybinds', 'object', {});
  env = { ...module, store, memory, stub };
  return env;
}
test('register siembra el atajo por defecto solo si falta', async () => {
  const { comboOf, register, store } = await keybinds();
  register('panel', 'Abrir panel', 'Alt+O');
  store.set('keybinds', { panel: 'Ctrl+K' });

  register('panel', 'Abrir panel', 'Alt+O');
  assert.equal(store.get('keybinds').panel, 'Ctrl+K'); // no pisa lo del usuario

  register('chatPause', 'Pausar chat', 'Alt+P');
  assert.equal(store.get('keybinds').chatPause, 'Alt+P'); // siembra el que faltaba
  assert.equal(comboOf('chatPause').key, 'p');
});

test('setCombo acepta combinaciones válidas y descarta la basura', async () => {
  const { comboOf, register, setCombo, store } = await keybinds();
  register('test1', 'Test', 'Alt+T');

  assert.equal(setCombo('test1', 'Ctrl+Shift+ArrowDown'), true);
  assert.equal(store.get('keybinds').test1, 'Ctrl+Shift+ArrowDown');
  assert.equal(comboOf('test1').key, 'arrowdown');

  assert.equal(setCombo('test1', 'no es un atajo'), false);
  assert.equal(store.get('keybinds').test1, 'Ctrl+Shift+ArrowDown');

  assert.equal(setCombo('test1', 'SoloModificadores'), false);
  assert.equal(setCombo('test1', 'F13'), false);
  assert.equal(setCombo('test1', ''), true);
  assert.equal(comboOf('test1'), null);
});

test('bindGlobal exige la combinación exacta y no roba teclas al escribir', async () => {
  const { bindGlobal, register, setCombo, stub } = await keybinds();
  register('panel', 'Panel', 'Alt+O');
  register('suelto', 'Sin modificador', 'K');
  setCombo('panel', 'Alt+O');
  setCombo('suelto', 'K');

  const calls = [];
  bindGlobal((id) => calls.push(id));

  const key = (overrides) => ({ key: 'O', altKey: false, ctrlKey: false, shiftKey: false, metaKey: false, preventDefault() {}, ...overrides });

  stub.window.fire('keydown', key({ altKey: true }));
  assert.deepEqual(calls, ['panel'], 'Alt+O dispara');

  stub.window.fire('keydown', key({ altKey: true, repeat: true }));
  assert.deepEqual(calls, ['panel'], 'mantener pulsado no repite');

  stub.window.fire('keydown', key({ altKey: true, ctrlKey: true }));
  assert.deepEqual(calls, ['panel'], 'un modificador de más no dispara');

  stub.window.fire('keydown', key({ key: 'K' }));
  assert.deepEqual(calls, ['panel', 'suelto'], 'una tecla suelta sí dispara');

  stub.window.fire('keydown', { ...key({ key: 'K' }), target: { tagName: 'TEXTAREA' } });
  assert.deepEqual(calls, ['panel', 'suelto'], 'pero no mientras escribes');
});
