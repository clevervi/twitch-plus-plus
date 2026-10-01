import assert from 'node:assert/strict';
import test from 'node:test';

import { capabilities, deleteValue, getValue, managerName, setValue } from '../src/core/gm.js';

const APIS = ['GM_getValue', 'GM_setValue', 'GM_deleteValue', 'GM_addValueChangeListener', 'GM_xmlhttpRequest', 'GM_info'];

function instalar({ info = 'Tampermonkey' } = {}) {
  const memory = new Map();
  const local = new Map();
  for (const nombre of APIS) delete globalThis[nombre];

  globalThis.GM_getValue = (key, fallback) => (memory.has(key) ? memory.get(key) : fallback);
  globalThis.GM_setValue = (key, value) => memory.set(key, value);
  globalThis.GM_deleteValue = (key) => memory.delete(key);
  globalThis.GM_addValueChangeListener = () => () => {};
  globalThis.GM_xmlhttpRequest = () => {};
  globalThis.GM_info = { scriptHandler: info };
  globalThis.localStorage = {
    getItem: (key) => (local.has(key) ? local.get(key) : null),
    setItem: (key, value) => local.set(key, String(value)),
    removeItem: (key) => local.delete(key),
  };

  return { memory, local, limpiar: () => { for (const nombre of APIS) delete globalThis[nombre]; } };
}
test('capabilities no reporta nada ausente cuando todas las APIs existen', () => {
  const env = instalar();
  assert.deepEqual(capabilities().ausentes, []);
  assert.equal(capabilities().gestor, 'Tampermonkey');
  env.limpiar();
});

test('capabilities nombra la API ausente y para qué se usa', () => {
  const env = instalar();
  delete globalThis.GM_deleteValue;
  const ausentes = capabilities().ausentes;
  assert.equal(ausentes.length, 1);
  assert.match(ausentes[0], /^GM_deleteValue \(restablecer la configuración\)$/);
  env.limpiar();
});

test('managerName cae a desconocido sin GM_info', () => {
  const env = instalar();
  delete globalThis.GM_info;
  assert.equal(managerName(), 'desconocido');
  env.limpiar();
});

test('con GM_ usa el almacén del gestor y no toca localStorage', () => {
  const env = instalar();
  setValue('clave', { a: 1 });
  assert.deepEqual(env.memory.get('clave'), { a: 1 });
  assert.equal(env.local.size, 0);
  assert.deepEqual(getValue('clave', null), { a: 1 });
  deleteValue('clave');
  assert.equal(env.memory.has('clave'), false);
  env.limpiar();
});

test('sin GM_ cae a localStorage con el prefijo del proyecto', () => {
  const env = instalar();
  delete globalThis.GM_getValue;
  delete globalThis.GM_setValue;
  delete globalThis.GM_deleteValue;

  setValue('clave', [1, 2]);
  assert.equal(env.local.get('twpp:clave'), '[1,2]');
  assert.deepEqual(getValue('clave', null), [1, 2]);

  deleteValue('clave');
  assert.equal(env.local.has('twpp:clave'), false);
  assert.equal(getValue('clave', 'por defecto'), 'por defecto');
  env.limpiar();
});

test('getValue devuelve el fallback cuando el valor guardado es basura', () => {
  const env = instalar();
  delete globalThis.GM_getValue;
  env.local.set('twpp:roto', '{no es json');
  assert.equal(getValue('roto', 'por defecto'), 'por defecto');
  env.limpiar();
});
