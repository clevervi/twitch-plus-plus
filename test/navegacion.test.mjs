/**
 * Historial de navegacion.
 *
 * Existe para responder a una pregunta que no se puede contestar leyendo el
 * codigo: cuando Twitch termina un directo con raid y te saca de donde estas,
 * ¿cambia la ruta sin recargar, o recarga la pagina? Segun cual sea, taparlo es
 * un trabajo distinto. #113 esta bloqueado por esa medicion.
 *
 * Solo se escribe en disco cuando la pagina se va. Durante el uso normal no hay
 * ninguna escritura, y ese es justo el momento en que hay que guardar: un salto
 * con recarga se llevaria por delante la evidencia.
 */
import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';

import { navegacion, start } from '../src/core/router.js';

const windowOriginal = globalThis.window;
const locationOriginal = globalThis.location;
const historyOriginal = globalThis.history;

before(() => {
  const location = { pathname: '/ibai' };
  const history = {
    pushState(_estado, _titulo, url) {
      if (url) location.pathname = url;
    },
    replaceState(_estado, _titulo, url) {
      if (url) location.pathname = url;
    },
  };

  globalThis.location = location;
  globalThis.history = history;
  globalThis.window = {
    history,
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => true,
  };

  start();
});

after(() => {
  if (windowOriginal) globalThis.window = windowOriginal;
  else delete globalThis.window;
  if (locationOriginal) globalThis.location = locationOriginal;
  else delete globalThis.location;
  if (historyOriginal) globalThis.history = historyOriginal;
  else delete globalThis.history;
});

/** Navega como lo haria Twitch, pasando por el patch que instalo `start`. */
function irA(ruta) {
  globalThis.history.pushState({}, '', ruta);
}

describe('historial de navegacion', () => {
  it('arranca registrando la ruta inicial', () => {
    const estado = navegacion();
    assert.equal(estado.actual.path, '/ibai');
    assert.equal(estado.actual.canal, 'ibai');
    assert.equal(estado.entradas.at(-1).razon, 'initial');
  });

  it('anota cada ruta con el motivo del salto', () => {
    const antes = navegacion().entradas.length;
    irA('/auronplay');
    const estado = navegacion();
    assert.equal(estado.entradas.length, antes + 1);
    assert.equal(estado.actual.path, '/auronplay');
    assert.equal(estado.actual.canal, 'auronplay');
    assert.equal(estado.entradas.at(-1).razon, 'pushState');
  });

  it('distingue pushState de replaceState', () => {
    irA('/midudl');
    globalThis.history.replaceState({}, '', '/rubius');
    assert.equal(navegacion().entradas.at(-1).razon, 'replaceState');
    assert.equal(navegacion().actual.path, '/rubius');
  });

  it('no crece sin limite aunque se navegue mucho', () => {
    const antes = navegacion().entradas.length;
    for (let i = 0; i < 60; i += 1) irA(`/canal${i}`);
    const total = navegacion().entradas.length;
    assert.ok(total <= 30, `se guardaron ${total} entradas y el tope son 30`);
    assert.ok(total >= antes, 'debe conservar lo que ya habia');
  });

  it('sin recarga anterior, salida es null', () => {
    assert.equal(navegacion().salida, null);
  });

  it('devuelve copias, no el array interno', () => {
    const estado = navegacion();
    estado.entradas.push({ path: '/inventado' });
    assert.ok(
      !navegacion().entradas.some((e) => e.path === '/inventado'),
      'no debe filtrar el array interno',
    );
  });
});