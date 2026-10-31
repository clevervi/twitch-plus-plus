/**
 * Volver al canal cuando el streamer reanuda el directo.
 *
 * La feature se arma al salir de un canal que quedo offline (o directamente si
 * el salto es una raid) y consulta el GQL publico de Twitch. Aqui se prueba la
 * maquina entera con un `GM_xmlhttpRequest` falso: no sale ninguna peticion.
 */
import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, it } from 'node:test';

import { get as getFeature, motivoDe } from '../src/core/registry.js';
import { set as storeSet } from '../src/core/store.js';
import { estaEnDirecto } from '../src/features/live-return.js';

const ID = 'liveReturn';
const CLAVE_OBJETIVO = 'twpp:liveReturn.target';
const CLAVE_ULTIMO = 'twpp:liveReturn.last';
const CLAVE_RETORNO = 'twpp:liveReturn.retorno';

const LIVE = { data: { user: { stream: { id: 'stream-1' } } } };
const OFFLINE = { data: { user: { stream: null } } };

const original = {
  location: globalThis.location,
  document: globalThis.document,
  window: globalThis.window,
  sessionStorage: globalThis.sessionStorage,
  GM_xmlhttpRequest: globalThis.GM_xmlhttpRequest,
};

let feature;
let entorno;
let respuestaGQL;
let peticiones;

function instalar() {
  const datos = new Map();
  const asignaciones = [];
  const eventos = new Map();
  peticiones = 0;
  respuestaGQL = OFFLINE;

  globalThis.sessionStorage = {
    getItem: (clave) => (datos.has(clave) ? datos.get(clave) : null),
    setItem: (clave, valor) => datos.set(clave, String(valor)),
    removeItem: (clave) => datos.delete(clave),
  };

  globalThis.location = {
    pathname: '/ibai',
    search: '',
    assign(url) {
      asignaciones.push(url);
    },
  };

  globalThis.document = { readyState: 'loading' };
  globalThis.window = {
    addEventListener: (tipo, fn) => eventos.set(tipo, fn),
    removeEventListener: (tipo, fn) => {
      if (eventos.get(tipo) === fn) eventos.delete(tipo);
    },
  };

  globalThis.GM_xmlhttpRequest = (opciones) => {
    peticiones += 1;
    if (respuestaGQL === null) {
      opciones.onerror?.();
      return;
    }
    opciones.onload({ status: 200, responseText: JSON.stringify(respuestaGQL) });
  };

  return { datos, asignaciones, eventos };
}

function navegar(canal, { raid = false } = {}) {
  globalThis.location.pathname = canal ? `/${canal}` : '/';
  globalThis.location.search = raid ? '?referrer=raid' : '';
  feature.onRoute({ canal });
}

function esperar() {
  return new Promise((listo) => setTimeout(listo, 10));
}

function objetivoGuardado() {
  const raw = entorno.datos.get(CLAVE_OBJETIVO);
  return raw ? JSON.parse(raw) : null;
}

beforeEach(() => {
  feature = getFeature(ID);
  feature.onDisable?.();
  storeSet('liveReturnMax', '6');
  entorno = instalar();
});

afterEach(() => {
  feature.onDisable?.();
  storeSet('liveReturnMax', '6');
  for (const clave of Object.keys(original)) {
    if (original[clave] !== undefined) globalThis[clave] = original[clave];
    else delete globalThis[clave];
  }
});

describe('declaracion de la vuelta al canal', () => {
  it('existe, va en Automatizacion y arranca apagada', () => {
    assert.ok(feature, 'la feature deberia estar registrada');
    assert.equal(feature.section, 'auto');
    assert.equal(feature.default, false);
  });

  it('ofrece un limite de espera prudente', () => {
    const ajuste = feature.settings.find((s) => s.key === 'liveReturnMax');
    assert.ok(ajuste, 'deberia existir el ajuste de espera');
    assert.equal(ajuste.default, '6');
    assert.deepEqual(ajuste.options.map(([valor]) => valor), ['2', '6', '24']);
  });
});

describe('consulta del estado del canal', () => {
  it('distingue en directo, offline y canal inexistente', async () => {
    respuestaGQL = LIVE;
    assert.deepEqual(await estaEnDirecto('ibai'), { ok: true, existe: true, live: true });

    respuestaGQL = OFFLINE;
    assert.deepEqual(await estaEnDirecto('ibai'), { ok: true, existe: true, live: false });

    respuestaGQL = { data: { user: null } };
    assert.deepEqual(await estaEnDirecto('ibai'), { ok: true, existe: false, live: false });
  });

  it('trata un fallo de red o una respuesta rara como "no se pudo"', async () => {
    respuestaGQL = null;
    assert.deepEqual(await estaEnDirecto('ibai'), { ok: false });

    respuestaGQL = { data: {} };
    assert.deepEqual(await estaEnDirecto('ibai'), { ok: false });

    respuestaGQL = { data: { user: 'no es un objeto' } };
    assert.deepEqual(await estaEnDirecto('ibai'), { ok: false });
  });
});

describe('armado del objetivo', () => {
  it('una raid arma el canal anterior sin consultar nada', () => {
    feature.onEnable();
    navegar('rubius', { raid: true });

    assert.equal(objetivoGuardado().canal, 'ibai');
    assert.equal(peticiones, 0, 'la raid ya demuestra que el canal anterior termino');
  });

  it('salir de un canal offline lo arma aunque no haya raid', async () => {
    respuestaGQL = OFFLINE;
    feature.onEnable();
    navegar('rubius');
    await esperar();

    assert.equal(objetivoGuardado().canal, 'ibai');
    assert.equal(peticiones, 1);
  });

  it('si el canal seguia en directo al salir, no se arma', async () => {
    respuestaGQL = LIVE;
    feature.onEnable();
    navegar('rubius');
    await esperar();

    assert.equal(objetivoGuardado(), null);
    assert.equal(peticiones, 1);
  });

  it('al arrancar en una raid recupera el canal guardado y lo arma', () => {
    feature.onDisable();
    globalThis.location.pathname = '/rubius';
    globalThis.location.search = '?referrer=raid';
    entorno.datos.set(CLAVE_ULTIMO, JSON.stringify({ canal: 'ibai', at: Date.now() }));

    feature.onEnable();
    feature.onRoute({ canal: 'rubius' });

    assert.equal(objetivoGuardado().canal, 'ibai');
  });
});

describe('vuelta cuando el canal reanuda', () => {
  it('vuelve al canal en cuanto el GQL dice que esta en directo', async () => {
    feature.onEnable();
    navegar('rubius', { raid: true });

    respuestaGQL = LIVE;
    feature.tick(Date.now() + 61_000);
    await esperar();

    assert.deepEqual(entorno.asignaciones, ['/ibai']);
    assert.equal(objetivoGuardado(), null, 'tras volver ya no hay nada que vigilar');
  });

  it('mientras siga offline no navega y conserva el objetivo', async () => {
    feature.onEnable();
    navegar('rubius', { raid: true });

    respuestaGQL = OFFLINE;
    feature.tick(Date.now() + 61_000);
    await esperar();

    assert.deepEqual(entorno.asignaciones, []);
    assert.equal(objetivoGuardado().canal, 'ibai');
  });

  it('si ya estas en el canal, solo deja de vigilar', async () => {
    feature.onEnable();
    navegar('rubius', { raid: true });

    respuestaGQL = LIVE;
    navegar('ibai');

    assert.equal(objetivoGuardado(), null);
    assert.deepEqual(entorno.asignaciones, []);
  });

  it('recupera un objetivo guardado tras recargar la pagina', async () => {
    feature.onDisable();
    const ahora = Date.now();
    globalThis.location.pathname = '/rubius';
    entorno.datos.set(
      CLAVE_OBJETIVO,
      JSON.stringify({ canal: 'ibai', desde: ahora, limite: ahora + 3_600_000 }),
    );
    entorno.datos.set(CLAVE_ULTIMO, JSON.stringify({ canal: 'ibai', at: ahora - 1000 }));

    feature.onEnable();
    respuestaGQL = LIVE;
    feature.tick(ahora + 61_000);
    await esperar();

    assert.deepEqual(entorno.asignaciones, ['/ibai']);
  });
});

describe('limites y fallos', () => {
  it('no restaura un objetivo caducado', () => {
    feature.onDisable();
    globalThis.location.pathname = '/rubius';
    entorno.datos.set(
      CLAVE_OBJETIVO,
      JSON.stringify({ canal: 'ibai', desde: Date.now() - 1000, limite: Date.now() - 1 }),
    );

    feature.onEnable();

    assert.equal(objetivoGuardado(), null);
  });

  it('tras cinco fallos de red deja de insistir y lo explica', async () => {
    feature.onEnable();
    navegar('rubius', { raid: true });
    respuestaGQL = null;

    for (let intento = 0; intento < 5; intento += 1) {
      feature.tick(Date.now() + 11 * 60_000);
      await esperar();
    }

    assert.equal(objetivoGuardado(), null);
    assert.match(motivoDe(ID), /no se pudo comprobar/i);
  });

  it('apagarla borra el objetivo y no deja nada en la sesion', () => {
    feature.onEnable();
    navegar('rubius', { raid: true });
    feature.onDisable();

    assert.equal(objetivoGuardado(), null);
    assert.equal(entorno.datos.get(CLAVE_ULTIMO), undefined);
    assert.equal(entorno.datos.get(CLAVE_RETORNO), undefined);
  });

  it('pagehide guarda el canal para sobrevivir a una recarga', () => {
    feature.onEnable();
    navegar('rubius');
    entorno.eventos.get('pagehide')();

    assert.equal(JSON.parse(entorno.datos.get(CLAVE_ULTIMO)).canal, 'rubius');
  });
});
