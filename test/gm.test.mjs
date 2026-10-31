import assert from 'node:assert/strict';
import test from 'node:test';

import { capabilities, deleteValue, getJson, getValue, managerName, postJson, setValue } from '../src/core/gm.js';

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

test('getJson aborta el fetch de respaldo al agotar el timeout', async () => {
  const env = instalar();
  delete globalThis.GM_xmlhttpRequest;
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (_url, options = {}) =>
    new Promise((_resolve, reject) => {
      options.signal?.addEventListener('abort', () => reject(new Error('abortado')));
    });

  try {
    const resultado = await Promise.race([
      getJson('https://example.test/datos.json', { timeout: 50 }),
      new Promise((resolve) => setTimeout(() => resolve('sin-timeout'), 1000)),
    ]);
    assert.equal(resultado, null, 'debe resolver null en vez de quedarse colgado');
  } finally {
    globalThis.fetch = originalFetch;
    env.limpiar();
  }
});

test('getJson resuelve null si GM_xmlhttpRequest lanza sincronamente', async () => {
  const env = instalar();
  globalThis.GM_xmlhttpRequest = () => {
    throw new Error('boom');
  };

  try {
    const resultado = await getJson('https://example.test/datos.json', { timeout: 50 });
    assert.equal(resultado, null, 'debe resolver null en vez de rechazar');
  } finally {
    env.limpiar();
  }
});

test('getJson resuelve null si onload lanza', async () => {
  const env = instalar();
  const res = {};
  Object.defineProperty(res, 'status', {
    get() {
      throw new Error('boom');
    },
  });
  globalThis.GM_xmlhttpRequest = (options) => {
    options.onload(res);
  };

  try {
    const resultado = await getJson('https://example.test/datos.json', { timeout: 50 });
    assert.equal(resultado, null, 'debe resolver null en vez de rechazar');
  } finally {
    env.limpiar();
  }
});

test('getValue lee de memoria si localStorage no puede guardar', async () => {
  const env = instalar();
  delete globalThis.GM_getValue;
  delete globalThis.GM_setValue;
  delete globalThis.GM_deleteValue;
  globalThis.localStorage = {
    getItem: (key) => (env.local.has(key) ? env.local.get(key) : null),
    setItem: () => {
      throw new Error('sin espacio');
    },
    removeItem: (key) => env.local.delete(key),
  };

  try {
    setValue('clave', 42);
    assert.equal(getValue('clave', 'por defecto'), 42, 'el fallback en memoria debe ser legible');
  } finally {
    env.limpiar();
  }
});

test('deleteValue limpia también la memoria de fallback', async () => {
  const env = instalar();
  delete globalThis.GM_getValue;
  delete globalThis.GM_setValue;
  delete globalThis.GM_deleteValue;
  globalThis.localStorage = {
    getItem: (key) => (env.local.has(key) ? env.local.get(key) : null),
    setItem: () => {
      throw new Error('sin espacio');
    },
    removeItem: () => {
      throw new Error('sin acceso');
    },
  };

  try {
    setValue('clave', 42);
    deleteValue('clave');
    assert.equal(getValue('clave', 'por defecto'), 'por defecto', 'memoria borrada');
  } finally {
    env.limpiar();
  }
});

test('postJson manda POST con el cuerpo JSON y las cabeceras', async () => {
  const env = instalar();
  let capturado = null;
  globalThis.GM_xmlhttpRequest = (opciones) => {
    capturado = opciones;
    opciones.onload({ status: 200, responseText: '{"ok":true}' });
  };

  try {
    const resultado = await postJson(
      'https://gql.twitch.tv/gql',
      { query: 'q' },
      { headers: { 'Client-ID': 'cliente' } },
    );
    assert.deepEqual(resultado, { ok: true });
    assert.equal(capturado.method, 'POST');
    assert.equal(capturado.data, '{"query":"q"}');
    assert.equal(capturado.headers['Content-Type'], 'application/json');
    assert.equal(capturado.headers['Client-ID'], 'cliente');
  } finally {
    env.limpiar();
  }
});

test('postJson usa fetch cuando no hay GM_xmlhttpRequest', async () => {
  const env = instalar();
  delete globalThis.GM_xmlhttpRequest;
  const originalFetch = globalThis.fetch;
  let capturado = null;
  globalThis.fetch = (url, opciones) => {
    capturado = { url, opciones };
    return Promise.resolve({ ok: true, json: async () => ({ ok: 1 }) });
  };

  try {
    const resultado = await postJson('https://gql.twitch.tv/gql', { query: 'q' });
    assert.deepEqual(resultado, { ok: 1 });
    assert.equal(capturado.opciones.method, 'POST');
    assert.equal(capturado.opciones.body, '{"query":"q"}');
    assert.equal(capturado.opciones.headers['Content-Type'], 'application/json');
  } finally {
    globalThis.fetch = originalFetch;
    env.limpiar();
  }
});

test('postJson resuelve null si la respuesta no es 2xx', async () => {
  const env = instalar();
  globalThis.GM_xmlhttpRequest = (opciones) => opciones.onload({ status: 500, responseText: 'boom' });

  try {
    assert.equal(await postJson('https://gql.twitch.tv/gql', {}), null);
  } finally {
    env.limpiar();
  }
});
