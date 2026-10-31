/**
 * Evitar el salto automatico a la raid.
 *
 * Twitch puede sacarte del canal de dos maneras: cambiando la ruta sin recargar
 * (`pushState`/`replaceState`) o recargando la pagina. Las dos se cubren aqui:
 * la primera se deshace con `history.back()` o `location.replace()`, y la
 * segunda se reconoce al arrancar porque la URL trae `referrer=raid`.
 *
 * Un clic deliberado en un enlace de raid siempre gana: si el usuario lo ha
 * pedido, el guardia no toca nada.
 */
import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, it } from 'node:test';

import { get as getFeature, motivoDe } from '../src/core/registry.js';
import '../src/features/raid-guard.js';

const ID = 'raidGuard';
const CLAVE = 'twpp:raidGuard';

const original = {
  location: globalThis.location,
  history: globalThis.history,
  sessionStorage: globalThis.sessionStorage,
  document: globalThis.document,
  window: globalThis.window,
};

let entorno;
let feature;

function instalarEntorno({ pathname = '/ibai', search = '' } = {}) {
  const datos = new Map();
  const eventos = new Map();
  const llamadas = { back: 0, replace: [], motivo: '' };

  const location = {
    pathname,
    search,
    hash: '',
    get href() {
      return `${this.pathname}${this.search}${this.hash}`;
    },
    replace(url) {
      llamadas.replace.push(url);
    },
  };

  const history = {
    back() {
      llamadas.back += 1;
    },
  };

  const sessionStorage = {
    getItem: (clave) => (datos.has(clave) ? datos.get(clave) : null),
    setItem: (clave, valor) => datos.set(clave, String(valor)),
    removeItem: (clave) => datos.delete(clave),
  };

  const document = {
    readyState: 'loading',
    addEventListener: (tipo, fn) => eventos.set(tipo, fn),
    removeEventListener: (tipo, fn) => {
      if (eventos.get(tipo) === fn) eventos.delete(tipo);
    },
  };

  const window = {
    addEventListener: (tipo, fn) => eventos.set(`window:${tipo}`, fn),
    removeEventListener: (tipo, fn) => {
      if (eventos.get(`window:${tipo}`) === fn) eventos.delete(`window:${tipo}`);
    },
  };

  globalThis.location = location;
  globalThis.history = history;
  globalThis.sessionStorage = sessionStorage;
  globalThis.document = document;
  globalThis.window = window;

  return { datos, eventos, llamadas, location, history, sessionStorage };
}

function irA(pathname, search = '') {
  entorno.location.pathname = pathname;
  entorno.location.search = search;
}

function ruta(pathname, canal, razon = 'pushState') {
  return { path: pathname, canal, channel: canal, razon };
}

function pulsar(target) {
  entorno.eventos.get('click')?.({ target });
}

beforeEach(() => {
  feature = getFeature(ID);
  feature.onDisable?.();
  entorno = instalarEntorno();
  feature.onEnable();
});

afterEach(() => {
  feature.onDisable?.();
  if (original.location) globalThis.location = original.location;
  else delete globalThis.location;
  if (original.history) globalThis.history = original.history;
  else delete globalThis.history;
  if (original.sessionStorage) globalThis.sessionStorage = original.sessionStorage;
  else delete globalThis.sessionStorage;
  if (original.document) globalThis.document = original.document;
  else delete globalThis.document;
  if (original.window) globalThis.window = original.window;
  else delete globalThis.window;
});

describe('declaracion del guardia de raids', () => {
  it('existe, vive en Automatizacion y arranca apagado', () => {
    assert.ok(feature, 'la feature deberia estar registrada');
    assert.equal(feature.section, 'auto');
    assert.equal(feature.default, false);
  });
});

describe('salto sin recarga', () => {
  it('con pushState vuelve atras en lugar de recargar', async () => {
    irA('/rubius', '?referrer=raid');
    feature.onRoute(ruta('/rubius', 'rubius'));

    await new Promise((listo) => setTimeout(listo, 5));

    assert.equal(entorno.llamadas.back, 1, 'deberia usar history.back()');
    assert.deepEqual(entorno.llamadas.replace, [], 'no hace falta recargar');
  });

  it('con replaceState recarga la url anterior porque ya no hay entrada', async () => {
    irA('/rubius', '?referrer=raid');
    feature.onRoute(ruta('/rubius', 'rubius', 'replaceState'));

    await new Promise((listo) => setTimeout(listo, 5));

    assert.deepEqual(entorno.llamadas.replace, ['/ibai']);
    assert.equal(entorno.llamadas.back, 0);
  });

  it('no toca una navegacion normal', async () => {
    irA('/rubius');
    feature.onRoute(ruta('/rubius', 'rubius'));

    await new Promise((listo) => setTimeout(listo, 5));

    assert.equal(entorno.llamadas.back, 0);
    assert.deepEqual(entorno.llamadas.replace, []);
  });

  it('no toca volver atras a mano (popstate)', async () => {
    irA('/rubius', '?referrer=raid');
    feature.onRoute(ruta('/rubius', 'rubius', 'popstate'));

    await new Promise((listo) => setTimeout(listo, 5));

    assert.equal(entorno.llamadas.back, 0);
    assert.deepEqual(entorno.llamadas.replace, []);
  });

  it('si la pagina ya estaba en una raid, no rebota hacia otra raid', async () => {
    feature.onDisable();
    irA('/rubius', '?referrer=raid');
    feature.onEnable();

    irA('/auronplay', '?referrer=raid');
    feature.onRoute(ruta('/auronplay', 'auronplay'));

    await new Promise((listo) => setTimeout(listo, 5));

    assert.equal(entorno.llamadas.back, 0, 'volver a la raid anterior no arregla nada');
    assert.deepEqual(entorno.llamadas.replace, []);
  });

  it('un clic deliberado en el enlace de raid no se bloquea', async () => {
    pulsar({
      closest(selector) {
        if (selector === 'a[href]') {
          return { getAttribute: () => '/rubius?referrer=raid' };
        }
        return null;
      },
    });

    irA('/rubius', '?referrer=raid');
    feature.onRoute(ruta('/rubius', 'rubius'));

    await new Promise((listo) => setTimeout(listo, 5));

    assert.equal(entorno.llamadas.back, 0);
    assert.deepEqual(entorno.llamadas.replace, []);
  });
});

describe('salto con recarga', () => {
  it('al arrancar en una raid vuelve al canal anterior', () => {
    feature.onDisable();
    entorno.sessionStorage.setItem(CLAVE, JSON.stringify({ url: '/ibai', at: Date.now() }));
    irA('/rubius', '?referrer=raid');

    feature.onEnable();

    assert.deepEqual(entorno.llamadas.replace, ['/ibai']);
  });

  it('sin canal anterior no inventa un destino', () => {
    irA('/rubius', '?referrer=raid');

    feature.onDisable();
    feature.onEnable();

    assert.deepEqual(entorno.llamadas.replace, []);
  });

  it('ignora una salida vieja y limpia la clave', () => {
    feature.onDisable();
    entorno.sessionStorage.setItem(CLAVE, JSON.stringify({ url: '/ibai', at: Date.now() - 70_000 }));
    irA('/rubius', '?referrer=raid');

    feature.onEnable();

    assert.deepEqual(entorno.llamadas.replace, []);
    assert.equal(entorno.sessionStorage.getItem(CLAVE), null);
  });

  it('respeta un clic manual guardado antes de recargar', () => {
    feature.onDisable();
    entorno.sessionStorage.setItem(CLAVE, JSON.stringify({ url: '/ibai', at: Date.now() }));
    entorno.sessionStorage.setItem(`${CLAVE}.manual`, JSON.stringify({ at: Date.now(), destino: 'rubius' }));
    irA('/rubius', '?referrer=raid');

    feature.onEnable();

    assert.deepEqual(entorno.llamadas.replace, []);
    assert.equal(entorno.sessionStorage.getItem(CLAVE), null, 'no debe reutilizar el canal anterior');
  });

  it('un clic manual vale aunque la pagina tarde en cargar', () => {
    feature.onDisable();
    entorno.sessionStorage.setItem(CLAVE, JSON.stringify({ url: '/ibai', at: Date.now() }));
    entorno.sessionStorage.setItem(
      `${CLAVE}.manual`,
      JSON.stringify({ at: Date.now() - 10_000, destino: 'rubius' }),
    );
    irA('/rubius', '?referrer=raid');

    feature.onEnable();

    assert.deepEqual(entorno.llamadas.replace, []);
  });

  it('encenderla desde el panel no rebota a una salida vieja', () => {
    feature.onDisable();
    entorno.sessionStorage.setItem(CLAVE, JSON.stringify({ url: '/ibai', at: Date.now() }));
    irA('/rubius', '?referrer=raid');
    globalThis.document.readyState = 'complete';

    feature.onEnable();

    assert.deepEqual(entorno.llamadas.replace, []);
  });
});

describe('anti-bucle', () => {
  it('tras varios intentos deja pasar la raid y lo anota', async () => {
    for (let intento = 0; intento < 4; intento += 1) {
      irA('/rubius', '?referrer=raid');
      feature.onRoute(ruta('/rubius', 'rubius'));
      await new Promise((listo) => setTimeout(listo, 5));

      // Simula que el navegador volvio al canal anterior entre intentos. En el
      // ultimo no se vuelve: ahi el guardia ya se ha rendido.
      if (intento < 3) {
        irA('/ibai');
        feature.onRoute(ruta('/ibai', 'ibai', 'popstate'));
        await new Promise((listo) => setTimeout(listo, 5));
      }
    }

    const total = entorno.llamadas.back + entorno.llamadas.replace.length;
    assert.equal(total, 3, `deberia bloquear 3 veces y rendirse, bloqueo ${total}`);
    assert.match(motivoDe(ID), /insiste/i);
  });
});
