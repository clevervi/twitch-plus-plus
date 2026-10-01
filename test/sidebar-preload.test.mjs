import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, it } from 'node:test';

import { createDomStub } from '../tools/dom-stub.mjs';
import { apply, get as getFeature } from '../src/core/registry.js';
import { set as storeSet } from '../src/core/store.js';
import '../src/features/sidebar-thumbnails.js';

const ID = 'sidebarThumbnailPreview';
const MS_PRECARGADO = 2000;

const documentOriginal = globalThis.document;
const windowOriginal = globalThis.window;
const setTimeoutOriginal = globalThis.setTimeout;
const clearTimeoutOriginal = globalThis.clearTimeout;

/**
 * El DOM stub no resuelve `nav a[href^="/"]`, así que `visibleChannels()`
 * devolvería vacío y una prueba sobre cuántas miniaturas se piden pasaría
 * siempre, con o sin el bug. Lo que se comprueba aquí es el contrato:
 * `onEnable` programa el precargado y apagarlo lo cancela.
 */
function espiarTemporizadores() {
  const registrados = [];
  const cancelados = [];
  globalThis.setTimeout = (fn, ms) => {
    registrados.push({ id: registrados.length + 1, fn, ms });
    return registrados.length;
  };
  globalThis.clearTimeout = (id) => cancelados.push(id);
  return { registrados, cancelados };
}

function activada(on) {
  storeSet(ID, on);
  apply(ID);
}

beforeEach(() => {
  const stub = createDomStub();
  globalThis.document = stub.document;
  globalThis.window = {
    innerWidth: 1200,
    innerHeight: 800,
    addEventListener() {},
    removeEventListener() {},
  };
});

afterEach(() => {
  // Primero se deja la feature en un estado conocido, con el DOM todavía en
  // su sitio: `apply` necesita `document`.
  storeSet(ID, false);
  globalThis.document = documentOriginal;
  globalThis.window = windowOriginal;
  globalThis.setTimeout = setTimeoutOriginal;
  globalThis.clearTimeout = clearTimeoutOriginal;
});

describe('precargado diferido de miniaturas', () => {
  it('onEnable lo programa a 2 s', () => {
    const { registrados } = espiarTemporizadores();
    activada(true);
    assert.ok(
      registrados.some((t) => t.ms === MS_PRECARGADO),
      'debe programarse el precargado diferido',
    );
  });

  it('apagar la feature lo cancela', () => {
    const { registrados, cancelados } = espiarTemporizadores();

    activada(true);
    const precargado = registrados.find((t) => t.ms === MS_PRECARGADO);
    activada(false);

    assert.ok(
      cancelados.includes(precargado.id),
      'apagar antes de 2 s no debe dejar el precargado pidiendo miniaturas al CDN',
    );
  });

  it('navegar también lo cancela', () => {
    const { registrados, cancelados } = espiarTemporizadores();

    activada(true);
    const precargado = registrados.find((t) => t.ms === MS_PRECARGADO);
    getFeature(ID).onRoute();

    assert.ok(cancelados.includes(precargado.id), 'onRoute llama a teardown y debe cancelar el precargado');
  });

  it('reactivar no acumula temporizadores: solo queda vivo el último', () => {
    const { registrados, cancelados } = espiarTemporizadores();

    activada(true);
    activada(false);
    activada(true);
    activada(false);
    activada(true);

    const precargados = registrados.filter((t) => t.ms === MS_PRECARGADO);
    const siguenVivos = precargados.filter((t) => !cancelados.includes(t.id));
    assert.equal(siguenVivos.length, 1, 'tras varios ciclos solo queda un precargado pendiente');
  });
});
