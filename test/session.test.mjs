import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, it } from 'node:test';

import { read, remove, write } from '../src/core/session.js';

const original = globalThis.sessionStorage;

function instalar(storage) {
  globalThis.sessionStorage = storage;
}

beforeEach(() => {
  const datos = new Map();
  instalar({
    getItem: (clave) => (datos.has(clave) ? datos.get(clave) : null),
    setItem: (clave, valor) => datos.set(clave, String(valor)),
    removeItem: (clave) => datos.delete(clave),
  });
});

afterEach(() => {
  if (original) globalThis.sessionStorage = original;
  else delete globalThis.sessionStorage;
});

describe('sessionStorage con JSON', () => {
  it('guarda y recupera objetos', () => {
    write('clave', { canal: 'ibai', at: 123 });
    assert.deepEqual(read('clave'), { canal: 'ibai', at: 123 });
  });

  it('devuelve null si no hay nada', () => {
    assert.equal(read('no-existe'), null);
  });

  it('devuelve null si el JSON está roto', () => {
    globalThis.sessionStorage.setItem('roto', '{no es json');
    assert.equal(read('roto'), null);
  });

  it('borra la clave', () => {
    write('clave', 1);
    remove('clave');
    assert.equal(read('clave'), null);
  });

  it('no lanza si sessionStorage no existe', () => {
    delete globalThis.sessionStorage;
    assert.equal(read('clave'), null);
    assert.doesNotThrow(() => write('clave', 1));
    assert.doesNotThrow(() => remove('clave'));
  });

  it('no lanza si el navegador rechaza el acceso', () => {
    instalar({
      getItem: () => {
        throw new Error('bloqueado');
      },
      setItem: () => {
        throw new Error('bloqueado');
      },
      removeItem: () => {
        throw new Error('bloqueado');
      },
    });
    assert.equal(read('clave'), null);
    assert.doesNotThrow(() => write('clave', 1));
    assert.doesNotThrow(() => remove('clave'));
  });
});
