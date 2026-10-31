/**
 * El guardia de raids en un navegador de verdad.
 *
 * La suite unitaria comprueba la decision; esta comprueba lo que solo se ve con
 * un historial real: que `history.back()` devuelve la URL y que un clic manual
 * sobrevive a la recarga sin que el guardia lo deshaga.
 */
import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';

import { arrancar } from './harness.mjs';

let page;
let errores;
let cerrar;

before(async () => {
  ({ page, errores, cerrar } = await arrancar());
});

after(async () => {
  await cerrar();
});

const rutaActual = () => page.evaluate(() => `${location.pathname}${location.search}`);

describe('guardia de raids', () => {
  it('un pushState a una raid vuelve a la ruta anterior', async () => {
    await page.evaluate(() => window.TwitchPP.enable('raidGuard'));
    await page.evaluate(() => history.pushState({}, '', '/rubius?referrer=raid'));

    await page.waitForFunction(() => `${location.pathname}${location.search}` === '/', null, { timeout: 4000 });

    assert.equal(await rutaActual(), '/', 'deberia haber vuelto sin recargar');
  });

  it('un clic manual en un enlace de raid no se bloquea', async () => {
    await page.evaluate(() => {
      const enlace = document.createElement('a');
      enlace.id = 'raid-manual';
      enlace.href = '/rubius?referrer=raid';
      enlace.textContent = 'raid';
      document.body.append(enlace);
    });

    await page.click('#raid-manual');
    await page.waitForURL('**/rubius?referrer=raid', { timeout: 4000 });

    assert.match(page.url(), /\/rubius\?referrer=raid$/, 'el clic manual debe respetarse');
    assert.deepEqual(errores, [], `errores: ${errores.join(' | ')}`);
  });

  it('una raid con recarga completa tambien vuelve al canal anterior', async () => {
    await page.goto('https://www.twitch.tv/');
    await page.waitForFunction(() => Boolean(window.TwitchPP), null, { timeout: 8000 });

    // Navegacion programatica: no hay clic, asi que el guardia debe rebotar.
    await page.evaluate(() => {
      location.href = '/rubius?referrer=raid';
    }).catch(() => {
      /* la navegacion destruye el contexto de la evaluacion */
    });

    await page.waitForURL('**/rubius?referrer=raid', { timeout: 3000 }).catch(() => {});
    await page.waitForURL('https://www.twitch.tv/', { timeout: 5000 });

    assert.equal(await rutaActual(), '/', 'deberia haber vuelto tras la recarga');
  });
});
