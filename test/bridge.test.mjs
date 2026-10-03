/**
 * Puente de diagnostico (#117).
 *
 * El puente tiene que aguantar dos mundos y que lo que cruza sea una cadena, no
 * un objeto. En los wrappers entre mundos un objeto puede llegar vacio y el
 * fallo seria silencioso, que es justo lo que se intenta evitar.
 */
import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, it } from 'node:test';

import { start as startBridge } from '../src/core/bridge.js';

const NS_PETICION = 'twpp:diag:peticion';
const NS_RESPUESTA = 'twpp:diag:respuesta';

let listenersPeticion;
let listenersRespuesta;
let	globalThisAnterior;
let documentOriginal;

/** Sustituye window y document por los justos para no tocar el DOM real. */
function montar({ globalThisFalso } = {}) {
  listenersPeticion = [];
  listenersRespuesta = [];

  const ventana = {
    addEventListener: (tipo, fn) => {
      (tipo === NS_PETICION ? listenersPeticion : listenersRespuesta).push(fn);
    },
    removeEventListener: (tipo, fn) => {
      const lista = tipo === NS_PETICION ? listenersPeticion : listenersRespuesta;
      const i = lista.indexOf(fn);
      if (i >= 0) lista.splice(i, 1);
    },
    dispatchEvent: (evento) => {
      const lista = evento.type === NS_PETICION ? listenersPeticion : listenersRespuesta;
      for (const fn of [...lista]) fn(evento);
      return true;
    },
  };

  globalThisAnterior = globalThis.window;
  globalThis.window = ventana;
  globalThis.TwitchPP = globalThisFalso;
  return ventana;
}

/** Lo que la pagina hace: despachar la peticion y quedarse con la respuesta. */
function pedir(ventana, op) {
  return new Promise((resolve) => {
    ventana.addEventListener(NS_RESPUESTA, (ev) => {
      if (ev.detail && ev.detail.json) resolve(JSON.parse(ev.detail.json));
    });
    ventana.dispatchEvent({ type: NS_PETICION, detail: { id: 1, op } });
  });
}

beforeEach(() => {
  documentOriginal = globalThis.document;
});

afterEach(() => {
  if (globalThisAnterior) globalThis.window = globalThisAnterior;
  else delete globalThis.window;
  delete globalThis.TwitchPP;
  if (documentOriginal) globalThis.document = documentOriginal;
});

describe('puente de diagnostico', () => {
  it('responde al informe completo como JSON', async () => {
    const ventana = montar({
      globalThisFalso: { diagnostics: { report: () => ({ version: '9.9.9', features: [] }) } },
    });
    startBridge();

    const datos = await pedir(ventana, 'diagnostics');
    assert.equal(datos.version, '9.9.9');
    assert.deepEqual(datos.features, []);
  });

  it('no propaga una excepcion del informe: contesta con el error', async () => {
    const ventana = montar({
      globalThisFalso: {
        diagnostics: {
          report: () => {
            throw new Error('revento el informe');
          },
        },
      },
    });
    startBridge();

    const datos = await pedir(ventana, 'diagnostics');
    assert.match(datos.error, /revento el informe/);
  });

  it('informa de una operacion desconocida en vez de callarse', async () => {
    const ventana = montar({ globalThisFalso: { diagnostics: { report: () => ({}) } } });
    startBridge();

    const datos = await pedir(ventana, 'inventada');
    assert.match(datos.error, /operacion desconocida/);
  });

  it('ignora las peticiones sin forma en vez de lanzar', () => {
    const ventana = montar({ globalThisFalso: { diagnostics: { report: () => ({}) } } });
    startBridge();

    assert.doesNotThrow(() => {
      ventana.dispatchEvent({ type: NS_PETICION, detail: null });
      ventana.dispatchEvent({ type: NS_PETICION, detail: {} });
    });
  });

  it('no acumula listeners si se arranca mas de una vez', () => {
    const ventana = montar({ globalThisFalso: { diagnostics: { report: () => ({}) } } });
    startBridge();
    startBridge();
    startBridge();
    assert.equal(listenersPeticion.length, 1);
  });

  it('sigue vivo aunque no exista document', () => {
    delete globalThis.document;
    const ventana = montar({ globalThisFalso: { diagnostics: { report: () => ({}) } } });
    assert.doesNotThrow(() => startBridge());
    assert.equal(listenersPeticion.length, 1);
  });
});