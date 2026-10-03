/**
 * Motivo de inactividad.
 *
 * Una feature activa que no hace su trabajo se ve igual desde fuera que una que
 * se ha roto: ninguna de las dos da error. Esto es lo que hacia que #102 y #109
 * fueran invisibles. El motivo solo no arregla la feature, pero convierte
 * "no funciona" en una frase concreta.
 */
import assert from 'node:assert/strict';
import { afterEach, describe, it } from 'node:test';

import {
  anotarMotivo,
  limpiarMotivo,
  motivoDe,
  motivos,
  statuses,
} from '../src/core/registry.js';
// Sin esto la feature no existe en el registro y `statuses()` no la lista.
import '../src/features/sidebar-thumbnails.js';

const FEATURE_FICTICIA = 'sidebarThumbnailPreview';

afterEach(() => limpiarMotivo(FEATURE_FICTICIA));

describe('motivo de inactividad', () => {
  it('guarda y devuelve el motivo de una feature', () => {
    anotarMotivo(FEATURE_FICTICIA, 'la card no tiene href de canal');
    assert.equal(motivoDe(FEATURE_FICTICIA), 'la card no tiene href de canal');
  });

  it('motivos() solo lista las features con motivo', () => {
    assert.deepEqual(motivos(), [], 'sin anotar no debe listar nada');

    anotarMotivo(FEATURE_FICTICIA, 'sin tooltip vivo');
    const lista = motivos();
    assert.equal(lista.length, 1);
    assert.deepEqual(lista[0], { id: FEATURE_FICTICIA, motivo: 'sin tooltip vivo' });
  });

  it('limpiarMotivo lo borra y es lo que hace la feature cuando por fin actua', () => {
    anotarMotivo(FEATURE_FICTICIA, 'algo se atascó');
    limpiarMotivo(FEATURE_FICTICIA);
    assert.equal(motivoDe(FEATURE_FICTICIA), '');
    assert.deepEqual(motivos(), []);
  });

  it('aparece en statuses() para poder mostrarlo junto a la feature', () => {
    anotarMotivo(FEATURE_FICTICIA, 'la card no esta dentro de la sidebar');
    const fila = statuses().find((f) => f.id === FEATURE_FICTICIA);
    assert.ok(fila, 'la feature deberia estar registrada');
    assert.equal(fila.motivo, 'la card no esta dentro de la sidebar');
  });

  it('sin motivo, statuses() lo deja en cadena vacia y no undefined', () => {
    limpiarMotivo(FEATURE_FICTICIA);
    const fila = statuses().find((f) => f.id === FEATURE_FICTICIA);
    assert.equal(fila.motivo, '');
  });

  it('un motivo sobreescribe al anterior en vez de acumular', () => {
    anotarMotivo(FEATURE_FICTICIA, 'primero');
    anotarMotivo(FEATURE_FICTICIA, 'segundo');
    assert.equal(motivoDe(FEATURE_FICTICIA), 'segundo');
    assert.equal(motivos().length, 1);
  });

  it('recorta el motivo para que una excepcion larga no se trague el informe', () => {
    anotarMotivo(FEATURE_FICTICIA, 'x'.repeat(500));
    assert.equal(motivoDe(FEATURE_FICTICIA).length, 120);
  });

  it('acepta cualquier valor y lo convierte a texto', () => {
    anotarMotivo(FEATURE_FICTICIA, undefined);
    assert.equal(motivoDe(FEATURE_FICTICIA), 'undefined');
  });
});