/**
 * El armado de la vuelta al canal en un navegador real.
 *
 * Aqui importa el camino completo: `router` detecta el salto, la feature
 * pregunta por el canal anterior y `postJson` sale por `fetch` (en la fixture no
 * hay GM_xmlhttpRequest). La respuesta del GQL se intercepta con Playwright.
 */
import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';

import { arrancar } from './harness.mjs';

let page;
let errores;
let cerrar;
const consultas = [];
let live = false;

before(async () => {
  ({ page, errores, cerrar } = await arrancar());
  await page.route('https://gql.twitch.tv/gql', async (ruta) => {
    const cuerpo = ruta.request().postDataJSON();
    consultas.push({
      login: cuerpo?.variables?.login,
      clientId: ruta.request().headers()['client-id'],
    });
    await ruta.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ data: { user: { stream: live ? { id: 'stream-1' } : null } } }),
    });
  });
});

after(async () => {
  await cerrar();
});

describe('vuelta cuando el canal reanuda', () => {
  it('al salir de un canal offline lo deja armado', async () => {
    await page.evaluate(() => window.TwitchPP.enable('liveReturn'));
    await page.evaluate(() => history.pushState({}, '', '/ibai'));
    await page.evaluate(() => history.pushState({}, '', '/auronplay'));

    await page.waitForFunction(
      () => {
        const raw = sessionStorage.getItem('twpp:liveReturn.target');
        return Boolean(raw && JSON.parse(raw).canal === 'ibai');
      },
      null,
      { timeout: 4000 },
    );

    assert.deepEqual(consultas.map((c) => c.login), ['ibai']);
    assert.equal(consultas[0].clientId, 'kimne78kx3ncx6brgo4mv6wki5h1ko');
    assert.deepEqual(errores, []);
  });

  it('cuando el canal vuelve a emitir, navega de vuelta', async () => {
    // El objetivo sigue armado del test anterior. Se instala el reloj falso
    // después de armar y se salta al futuro sin disparar el timeout de 8 s del
    // fetch: `setSystemTime` mueve `Date.now()` pero no ejecuta temporizadores.
    await page.clock.install();
    live = true;
    const ahora = await page.evaluate(() => Date.now());
    await page.clock.setSystemTime(ahora + 61_000);

    // Despierta al scheduler con una ruta que no cambia de canal.
    await page.evaluate(() => history.pushState({}, '', '/auronplay?kick=1'));

    await page.waitForURL('**/ibai', { timeout: 8000 });
    assert.equal(await page.evaluate(() => location.pathname), '/ibai');
    assert.equal(consultas.at(-1).login, 'ibai', 'la vuelta se decide con una consulta al canal');
    assert.deepEqual(errores, []);
  });
});
