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
      body: JSON.stringify({ data: { user: { stream: null } } }),
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
});
