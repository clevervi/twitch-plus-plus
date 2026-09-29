import assert from 'node:assert/strict';
import test from 'node:test';

import { createDomStub } from '../tools/dom-stub.mjs';

let env = null;
async function freshRegistry() {
  if (env) return env; // los módulos se comparten: se limpian con store.reset()

  const stub = createDomStub();
  globalThis.document = stub.document;
  globalThis.window = stub.window;
  globalThis.MutationObserver = stub.MutationObserver;
  globalThis.getComputedStyle = stub.getComputedStyle;

  const memory = new Map();
  globalThis.GM_getValue = (key, fallback) => (memory.has(key) ? memory.get(key) : fallback);
  globalThis.GM_setValue = (key, value) => memory.set(key, value);
  globalThis.GM_deleteValue = (key) => memory.delete(key);

  const registry = await import('../src/core/registry.js');
  const store = await import('../src/core/store.js');
  const bus = await import('../src/core/bus.js');
  env = { ...registry, store, bus, stub };
  return env;
}

function has(list, id) {
  return list.some((feature) => feature.id === id);
}

test('defineFeature declara la clave en el store con su default', async () => {
  const { all, defineFeature, store } = await freshRegistry();
  defineFeature({ id: 'demo', label: 'Demo', section: 'visual', default: true });
  defineFeature({ id: 'otro', label: 'Otro', section: 'chat', default: false });

  assert.equal(has(all(), 'demo'), true);
  assert.equal(store.get('demo'), true);
  assert.equal(store.get('otro'), false);
});

test('una sección inválida cae en "advanced" y un id duplicado explota', async () => {
  const { defineFeature } = await freshRegistry();
  const feature = defineFeature({ id: 'raro', label: 'Raro', section: 'no-existe' });
  assert.equal(feature.section, 'advanced');
  assert.throws(() => defineFeature({ id: 'raro', label: 'Otra vez' }), /duplicada/);
  assert.throws(() => defineFeature({ label: 'sin id' }), /sin id/);
});

test('apply refleja el estado en la clase del <html> y llama a los hooks', async () => {
  const { apply, defineFeature, store } = await freshRegistry();
  const calls = [];
  defineFeature({
    id: 'hooks',
    label: 'Hooks',
    section: 'chat',
    default: false,
    onEnable: () => calls.push('enable'),
    onDisable: () => calls.push('disable'),
  });

  store.set('hooks', true);
  apply('hooks');
  assert.equal(document.documentElement.classList.contains('twpp-hooks'), true);
  assert.deepEqual(calls, ['enable']);

  store.set('hooks', false);
  apply('hooks');
  assert.equal(document.documentElement.classList.contains('twpp-hooks'), false);
  assert.deepEqual(calls, ['enable', 'disable']);
});

test('tickAll respeta el intervalo de cada feature', async () => {
  const { defineFeature, store, tickAll } = await freshRegistry();
  let rapido = 0;
  let lento = 0;
  defineFeature({ id: 'rapido', label: 'Rápido', section: 'chat', default: true, tick: () => (rapido += 1) });
  defineFeature({ id: 'lento', label: 'Lento', section: 'chat', default: true, interval: 10000, tick: () => (lento += 1) });

  tickAll(1000);
  tickAll(1100);
  assert.equal(rapido, 2);
  assert.equal(lento, 1);

  tickAll(20000);
  assert.equal(lento, 2);
  assert.equal(store.get('lento'), true);
});

test('una feature desactivada no se ejecuta', async () => {
  const { defineFeature, tickAll } = await freshRegistry();
  let calls = 0;
  defineFeature({ id: 'off', label: 'Off', section: 'chat', default: false, tick: () => (calls += 1) });
  tickAll(1000);
  assert.equal(calls, 0);
});

test('circuit breaker: 3 errores seguidos apagan la feature', async () => {
  const { bus, defineFeature, statuses, store, tickAll } = await freshRegistry();
  const disabled = [];
  const stop = bus.on('feature:disabled', (payload) => disabled.push(payload));

  defineFeature({
    id: 'rota',
    label: 'Rota',
    section: 'chat',
    default: true,
    tick: () => {
      throw new Error('boom');
    },
  });

  for (let i = 0; i < 3; i += 1) tickAll(1000 + i);
  stop();

  assert.equal(store.get('rota'), false);
  assert.deepEqual(disabled, [{ id: 'rota', reason: 'errores' }]);
  assert.equal(statuses().find((s) => s.id === 'rota').failures >= 3, true);
  assert.equal(document.documentElement.classList.contains('twpp-rota'), false);
});

test('un error puntual no apaga la feature', async () => {
  const { defineFeature, store, tickAll } = await freshRegistry();
  let calls = 0;
  defineFeature({
    id: 'intermitente',
    label: 'Intermitente',
    section: 'chat',
    default: true,
    tick: () => {
      calls += 1;
      if (calls === 2) throw new Error('glitch puntual');
    },
  });

  for (let i = 0; i < 5; i += 1) tickAll(1000 + i);
  assert.equal(store.get('intermitente'), true);
});

test('onRoute solo llama a las features habilitadas', async () => {
  const { defineFeature, onRouteAll, store } = await freshRegistry();
  const calls = [];
  defineFeature({ id: 'ruta-on', label: 'On', section: 'chat', default: true, onRoute: () => calls.push('on') });
  defineFeature({ id: 'ruta-off', label: 'Off', section: 'chat', default: false, onRoute: () => calls.push('off') });

  onRouteAll({ path: '/x' });
  assert.deepEqual(calls, ['on']);

  store.set('ruta-on', false);
  onRouteAll({ path: '/y' });
  assert.deepEqual(calls, ['on']);
});

test('when() bloquea la feature sin tocar la config y se reaplica sola', async () => {
  const { defineFeature, isActive, statuses, store, tickAll } = await freshRegistry();
  let permitido = false;
  let ticks = 0;
  defineFeature({
    id: 'condicional',
    label: 'Condicional',
    section: 'visual',
    default: true,
    when: () => permitido,
    tick: () => (ticks += 1),
  });

  assert.equal(isActive('condicional'), false, 'cuando when() es false no está activa');
  assert.equal(store.get('condicional'), true, 'pero el usuario la sigue teniendo activada');
  assert.equal(document.documentElement.classList.contains('twpp-condicional'), false);

  tickAll(1000);
  assert.equal(ticks, 0, 'no se ejecuta mientras está bloqueada');

  permitido = true;
  tickAll(2000);
  assert.equal(ticks, 1, 'en cuanto la condición se cumple, se aplica y corre');
  assert.equal(document.documentElement.classList.contains('twpp-condicional'), true);
  assert.equal(statuses().find((s) => s.id === 'condicional').blocked, false);
});

test('un when() que lanza no rompe el arranque', async () => {
  const { defineFeature, isActive } = await freshRegistry();
  defineFeature({
    id: 'when-roto',
    label: 'When roto',
    section: 'chat',
    default: true,
    when: () => {
      throw new Error('boom');
    },
  });
  assert.equal(isActive('when-roto'), false);
});
