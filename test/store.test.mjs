import assert from 'node:assert/strict';
import test from 'node:test';

let n = 0;
async function freshStore() {
  n += 1;
  const [store, gm] = await Promise.all([
    import(`../src/core/store.js?v=${n}`),
    import(`../src/core/gm.js?v=${n}`),
  ]);
  const memory = new Map();
  globalThis.GM_getValue = (key, fallback) => (memory.has(key) ? memory.get(key) : fallback);
  globalThis.GM_setValue = (key, value) => memory.set(key, value);
  return { ...store, memory, gm };
}

test('los defaults se aplican a una config vacía', async () => {
  const store = await freshStore();
  store.declare('darkMode', 'bool', true);
  store.declare('chatSearch', 'bool', false);
  assert.equal(store.get('darkMode'), true);
  assert.equal(store.get('chatSearch'), false);
});

test('un valor con tipo inválido se reemplaza por el default', async () => {
  const { memory } = await freshStore();
  memory.set('twpp.config', { _v: 5, darkMode: 'si porfa' });
  n += 1;
  const store = await import(`../src/core/store.js?v=${n}`);
  store.declare('darkMode', 'bool', true);
  assert.equal(store.get('darkMode'), true);
});

test('set persiste y notifica a los listeners', async () => {
  const store = await freshStore();
  store.declare('autoClaim', 'bool', true);
  const seen = [];
  store.onChange((key, value) => seen.push([key, value]));

  store.set('autoClaim', false);
  assert.equal(store.get('autoClaim'), false);
  assert.deepEqual(seen.at(-1), ['autoClaim', false]);

  store.set('autoClaim', false); // no cambia: no debe notificar
  assert.equal(seen.length, 1);
});

test('setMany solo notifica lo que cambia de verdad', async () => {
  const store = await freshStore();
  store.declare('a', 'bool', false);
  store.declare('b', 'bool', false);
  const seen = [];
  store.onChange((key) => seen.push(key));

  store.setMany({ a: true, b: false });
  assert.deepEqual(seen, ['a']);
});

test('exportJSON / importJSON hace round-trip', async () => {
  const store = await freshStore();
  store.declare('sidebarWidth', 'number', 72);
  store.declare('chatKeywords', 'string', '');
  store.set('sidebarWidth', 90);
  store.set('chatKeywords', 'hola, raid');

  const json = store.exportJSON();
  const parsed = JSON.parse(json);
  assert.equal(parsed.sidebarWidth, 90);

  store.set('sidebarWidth', 50);
  store.importJSON(json);
  assert.equal(store.get('sidebarWidth'), 90);
  assert.equal(store.get('chatKeywords'), 'hola, raid');
});

test('importJSON rechaza basura sin reventar', async () => {
  const store = await freshStore();
  assert.throws(() => store.importJSON('[]'));
  assert.throws(() => store.importJSON('no json'));
});

test('reset vuelve a los defaults', async () => {
  const store = await freshStore();
  store.declare('darkMode', 'bool', true);
  store.set('darkMode', false);
  store.reset();
  assert.equal(store.get('darkMode'), true);
});

test('declare después de la primera lectura no pisa el valor del usuario', async () => {
  const store = await freshStore();
  store.declare('tardia', 'bool', false);
  assert.equal(store.get('tardia'), false);
  store.set('tardia', true);
  store.declare('tardia', 'bool', false);
  assert.equal(store.get('tardia'), true);
});
