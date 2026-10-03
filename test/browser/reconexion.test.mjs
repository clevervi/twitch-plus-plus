/**
 * Reconexion cuando el directo se corta a mitad.
 *
 * Se prueba en Chromium porque la feature depende de `Date.now()` y de un
 * temporizador real. Laحل es falsear el reloj de la pagina para que el tiempo de
 * espera se agote en un par de segundos de reloj real.
 *
 * Lo que mas importa es lo que NO debe hacer: no tocar un player pausado a
 * proposito, no tocar un VOD, y no recargar la pagina sin permiso. Un bucle de
 * recargas puede acabar con la IP bloqueada por Twitch.
 */
import assert from 'node:assert/strict';
import { after, afterEach, before, describe, it } from 'node:test';

import { arrancar } from './harness.mjs';

const ID = 'autoReconnect';

let pagina;
let cerrar;

before(async () => {
  ({ page: pagina, cerrar } = await arrancar());
});

after(async () => {
  await cerrar();
});

afterEach(async () => {
  await pagina.evaluate((f) => window.TwitchPP.disable(f), ID);
  await pagina.evaluate(() => {
    document.querySelector('#prueba-video')?.remove();
    delete window.__originalNow;
    delete window.__plays;
  });
});

/**
 * Inyecta un `<video>` falso. `currentTime` y `duration` son getters sin setter en
 * el elemento real, de ahi el defineProperty.
 */
async function ponerVideo({ congelado, duracion, paused }) {
  await pagina.evaluate(
    ({ congelado, duracion, paused }) => {
      window.__plays = 0;
      const video = document.createElement('video');
      video.id = 'prueba-video';
      Object.defineProperty(video, 'duration', { get: () => duracion });
      Object.defineProperty(video, 'currentTime', { get: () => (window.__t ?? 0) });
      Object.defineProperty(video, 'readyState', { get: () => 4 });
      Object.defineProperty(video, 'ended', { get: () => false });
      Object.defineProperty(video, 'paused', { get: () => paused });
      // OJO: play() NO avanza el tiempo. Simula un corte que no se recupera,
      // que es el caso interesante. Si el stream avanzase aqui, la feature lo
      // daria por bueno y nunca llegaria a agotar los intentos.
      video.play = () => {
        window.__plays += 1;
        return Promise.resolve();
      };
      window.__t = congelado ? 0 : 0;
      document.body.prepend(video);

      // El reloj avanza 30 s por segundo real: la espera se agota enseguida.
      const real = Date.now;
      window.__originalNow = Date.now;
      let arranque = real();
      Date.now = () => arranque + (real() - window.__t0) * 30;
      window.__t0 = real();
    },
    { congelado, duracion, paused },
  );
}

const plays = () => pagina.evaluate(() => window.__plays);

describe('reconexion del directo', () => {
  it('llama a play() cuando el directo lleva congelado', async () => {
    await ponerVideo({ congelado: true, duracion: Infinity, paused: false });
    await pagina.evaluate((f) => window.TwitchPP.enable(f), ID);
    await pagina.waitForTimeout(2000);
    assert.ok((await plays()) > 0, 'deberia haber intentado reproducir');
  });

  it('no toca un player pausado a proposito', async () => {
    await ponerVideo({ congelado: true, duracion: Infinity, paused: true });
    await pagina.evaluate((f) => window.TwitchPP.enable(f), ID);
    await pagina.waitForTimeout(2000);
    assert.equal(await plays(), 0);
  });

  it('no toca un VOD: su duracion es finita', async () => {
    await ponerVideo({ congelado: true, duracion: 3600, paused: false });
    await pagina.evaluate((f) => window.TwitchPP.enable(f), ID);
    await pagina.waitForTimeout(2000);
    assert.equal(await plays(), 0);
  });

  it('no hace nada si el player va bien', async () => {
    await ponerVideo({ congelado: false, duracion: Infinity, paused: false });
    await pagina.evaluate((f) => window.TwitchPP.enable(f), ID);
    // El player avanza solo cada vez que play() lo empuja, asi que forzamos
    // que currentTime cambie con el tiempo.
    await pagina.evaluate(() => {
      window.__avanzar = setInterval(() => { window.__t += 1; }, 50);
    });
    await pagina.waitForTimeout(2000);
    await pagina.evaluate(() => clearInterval(window.__avanzar));
    assert.equal(await plays(), 0);
  });

  it('no reintenta sin parar: se detiene, se queda sin hacer nada y lo explica', async () => {
    await ponerVideo({ congelado: true, duracion: Infinity, paused: false });
    await pagina.evaluate((f) => window.TwitchPP.enable(f), ID);
    // Con el reloj a 30x la espera progresiva (5s, 10s, 20s, 40s) agota los 4
    // intentos en el tick 7, unos 7 s reales. El tick que lo anota tiene que
    // haber ocurrido ya, asi que se espera de sobra.
    await pagina.waitForTimeout(8500);

    const estado = await pagina.evaluate((f) => {
      const fila = window.TwitchPP.diagnostics.features().find((x) => x.id === f);
      return { motivo: fila?.motivo || '', plays: window.__plays };
    }, ID);

    assert.match(estado.motivo, /congelado/, `motivo: "${estado.motivo}"`);
    // Agotados los 4 intentos, el contador se para: 60 llamadas a play() en
    // 3 s significaria un bucle sin fin, que es justo lo que hay que evitar.
    assert.ok(estado.plays <= 4, `llamó a play() ${estado.plays} veces y el tope son 4`);
  });
});