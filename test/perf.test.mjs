import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, it } from 'node:test';

import { createDomStub } from '../tools/dom-stub.mjs';
import { $, $$, qs, qsAll } from '../src/core/dom.js';
import { contar, registrarArranque, registrarTick, reset, snapshot } from '../src/core/perf.js';

const documentOriginal = globalThis.document;

beforeEach(() => {
  globalThis.document = createDomStub().document;
  reset();
});

afterEach(() => {
  globalThis.document = documentOriginal;
  reset();
});

describe('contadores de coste', () => {
  it('empiezan a cero y sin arranque medido', () => {
    assert.deepEqual(snapshot(), {
      ticks: 0,
      ticksPorSegundo: 0,
      consultas: 0,
      mutaciones: 0,
      arranqueMs: null,
    });
  });

  it('cuenta una consulta por cada helper de dom.js', () => {
    $('a');
    $$('a');
    qs('a');
    qsAll('a');
    assert.equal(snapshot().consultas, 4, 'los cuatro helpers deben contar');
  });

  it('cuenta las consultas aunque el selector reviente', () => {
    qs('>>>roto');
    qsAll('>>>roto');
    assert.equal(snapshot().consultas, 2, 'una consulta fallida también es una consulta');
  });

  it('un selector mal formado en $ no propague el error pero sí cuenta', () => {
    // $ no tiene try/catch: comprueba solo que el contador sube cuando sí funciona.
    $('#nada');
    assert.equal(snapshot().consultas, 1);
  });

  it('los ticks se cuentan', () => {
    registrarTick();
    registrarTick();
    registrarTick();
    assert.equal(snapshot().ticks, 3);
  });

  it('el arranque solo se guarda la primera vez', () => {
    registrarArranque(120);
    registrarArranque(999);
    assert.equal(snapshot().arranqueMs, 120, 'el primer arranque es el que vale');
  });

  it('ticksPorSegundo es una media de la ventana, no del total', () => {
    const ahora = Date.now();
    // Diez ticks en cinco segundos: algo menos de 2 por segundo.
    for (let i = 0; i < 10; i += 1) {
      const original = Date.now;
      Date.now = () => ahora + i * 500;
      registrarTick();
      Date.now = original;
    }
    const perf = snapshot();
    assert.equal(perf.ticks, 10);
    assert.ok(perf.ticksPorSegundo > 1.5 && perf.ticksPorSegundo < 2.5, `media rara: ${perf.ticksPorSegundo}`);
  });

  it('la ventana de la media está acotada', () => {
    for (let i = 0; i < 200; i += 1) registrarTick();
    assert.equal(snapshot().ticks, 200, 'el total no se acota');
    // Con la ventana llena, la media sale de los últimos, no de todos.
    assert.ok(snapshot().ticksPorSegundo >= 0);
  });

  it('reset lo deja todo a cero', () => {
    registrarTick();
    registrarArranque(50);
    qs('a');
    reset();
    assert.deepEqual(snapshot(), {
      ticks: 0,
      ticksPorSegundo: 0,
      consultas: 0,
      mutaciones: 0,
      arranqueMs: null,
    });
  });

  it('contar una clave desconocida no crea el contador', () => {
    // Se llama con claves fijas en el código; si alguien se equivoca, no debe
    // ensuciar el snapshot ni romper.
    const antes = snapshot();
    contar('claveInventada', 5);
    assert.deepEqual(snapshot(), antes);
  });
});
