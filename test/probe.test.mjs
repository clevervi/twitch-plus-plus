import assert from 'node:assert/strict';
import { afterEach, describe, it } from 'node:test';

import { createDomStub } from '../tools/dom-stub.mjs';
import { apply, defineFeature } from '../src/core/registry.js';
import { probe } from '../src/core/probe.js';
import { get as storeGet, set as storeSet } from '../src/core/store.js';

const documentOriginal = globalThis.document;

function conDom() {
  const stub = createDomStub();
  globalThis.document = stub.document;
  return stub;
}

let contador = 0;

/**
 * La sonda enciende TODAS las features y luego restaura. Para que un test
 * detecte que la restauración no ocurrió, hace falta una feature que empiece
 * APAGADA: si la sonda la deja encendida, el estado observable cambia.
 *
 * El id lleva un contador porque `defineFeature` lanza ante duplicados y el
 * registro es de módulo, compartido entre los tests de este archivo.
 */
function featureApagada(nombre) {
  const id = `${nombre}${++contador}`;
  defineFeature({ id, label: nombre, default: false, tick() {} });
  storeSet(id, false);
  apply(id);
  return id;
}

/** Feature cuyo tick siempre revienta, para probar el aislamiento de errores. */
function featureQueLanza(nombre) {
  const id = `${nombre}${++contador}`;
  defineFeature({
    id,
    label: nombre,
    default: false,
    tick() {
      throw new Error('boom en tick');
    },
  });
  storeSet(id, false);
  apply(id);
  return id;
}

/**
 * Cómo se rompe la sonda a mitad, de verdad.
 *
 * La restauración va justo antes del `return`, así que un fallo en el objeto
 * de salida no sirve: llegaría tarde. Lo que hay que romper es algo del
 * `all().map()` que construye la lista de features, que corre DESPUÉS de
 * encender todo y ANTES de restaurar, y que no está dentro de ningún
 * try/catch.
 *
 * Se usa un getter en `section`, que la sonda lee en ese map y que nadie
 * envuelve. El registro de features es de módulo y no se puede deshacer, así
 * que la feature solo revienta mientras `sondaRota` está activo; si no, es
 * inofensiva para los tests siguientes.
 */
let sondaRota = false;

function registrarFeatureRota() {
  const feature = defineFeature({ id: `rota${++contador}`, label: 'Rota', default: false, tick() {} });
  Object.defineProperty(feature, 'section', {
    get() {
      if (sondaRota) throw new Error('boom en section');
      return 'advanced';
    },
  });
  return feature;
}

afterEach(() => {
  globalThis.document = documentOriginal;
  sondaRota = false;
});

describe('probe', () => {
  it('restaura la configuración cuando el trabajo termina bien', () => {
    conDom();
    defineFeature({ id: 'probeOk', label: 'Bien', default: true, tick() {} });
    const apagada = featureApagada('probeSana');

    const data = probe();
    assert.equal(storeGet(apagada), false, 'lo apagado sigue apagado');
    assert.ok(data.summary.featuresTotal >= 1);
  });

  it('restaura la configuración cuando una feature lanza en su tick', () => {
    conDom();
    featureQueLanza('probeExplota');
    const testigo = featureApagada('probeTestigo');

    probe();
    assert.equal(storeGet(testigo), false, 'una feature con errores no debe arrastrar a las demás');
  });

  it('restaura la configuración si algo revienta a mitad', () => {
    conDom();
    const id = featureApagada('probeMedio');
    registrarFeatureRota();
    sondaRota = true;
    assert.equal(!!storeGet(id), false, 'punto de partida: apagada');

    assert.throws(() => probe({ ticks: 1 }), /boom en section/);

    assert.equal(storeGet(id), false, 'la sonda no debe dejar la feature encendida');
  });

  it('no deja ninguna feature encendida ni clases de scope tras fallar', () => {
    const stub = conDom();
    const ids = [featureApagada('probeA'), featureApagada('probeB'), featureApagada('probeC')];
    registrarFeatureRota();
    sondaRota = true;

    assert.throws(() => probe({ ticks: 1 }));

    for (const id of ids) {
      assert.equal(storeGet(id), false, `${id} debe quedar apagada`);
      assert.equal(stub.document.documentElement.classList.contains(`twpp-${id}`), false, `${id} sin clase`);
    }
  });

  it('sigue restaurando cuando la sonda no encuentra ningún selector', () => {
    conDom();
    const id = featureApagada('probeVacio');

    const data = probe({ root: { querySelector: () => null, querySelectorAll: () => [] } });
    assert.equal(storeGet(id), false);
    assert.equal(data.url, '');
  });

  it('devuelve el resumen de las features con su estado', () => {
    conDom();
    const id = featureApagada('probeResumen');

    const data = probe();
    const fila = data.features.find((f) => f.id === id);
    assert.ok(fila, 'la feature aparece en el informe');
    assert.equal(fila.hasTick, true);
  });
});
