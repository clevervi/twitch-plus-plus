/**
 * Fugas de suscripciones al store.
 *
 * Varias features se apuntan con `onChange()` y se dan de baja en `onDisable`.
 * Si una se olvidara, cada cambio de configuración quedaría con N escuchas y el
 * síntoma sería «a veces va lento», que es imposible de atribuir sin un contador.
 *
 * Este fichero incluye el **control positivo**: primero se comprueba que el
 * observador ve una suscripción nueva. Sin esa parte, el resto de los tests
 * pasarían igual con el observador roto, que es justo lo que pasó al intentar
 * detectar esto contando efectos en el DOM.
 */
import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';

import { arrancar } from './harness.mjs';

let pagina;
let cerrar;

const suscribidas = () => pagina.evaluate(() => window.TwitchPP.diagnostics.subscriptions());

before(async () => {
  ({ page: pagina, cerrar } = await arrancar());
});

after(async () => {
  await cerrar();
});

describe('el contador de suscripciones al store funciona', () => {
  it('control positivo: encender una feature que se suscribe lo aumenta', async () => {
    // `sidebarCompact` se apunta con `onChange(applyWidth)` en su `onEnable`.
    const antes = await suscribidas();

    await pagina.evaluate(() => window.TwitchPP.enable('sidebarCompact'));
    await pagina.waitForTimeout(200);
    const encendida = await suscribidas();
    assert.equal(encendida, antes + 1, 'al encender hay una suscripción más');

    await pagina.evaluate(() => window.TwitchPP.disable('sidebarCompact'));
    await pagina.waitForTimeout(200);
    assert.equal(await suscribidas(), antes, 'y al apagar vuelve al valor anterior');
  });

  it('devuelve un numero, no un objeto', async () => {
    const n = await suscribidas();
    assert.equal(typeof n, 'number');
    assert.ok(n >= 0);
  });
});

describe('encender y apagar features no deja suscripciones colgando', () => {
  it('tres ciclos de todas las features vuelven al numero inicial', async () => {
    const base = await suscribidas();

    for (let vuelta = 0; vuelta < 3; vuelta += 1) {
      await pagina.evaluate(() =>
        window.TwitchPP.diagnostics.features().forEach((f) => window.TwitchPP.enable(f.id)),
      );
      await pagina.waitForTimeout(200);
      await pagina.evaluate(() =>
        window.TwitchPP.diagnostics.features().forEach((f) => window.TwitchPP.disable(f.id)),
      );
      await pagina.waitForTimeout(200);

      const ahora = await suscribidas();
      assert.equal(ahora, base, `tras la vuelta ${vuelta + 1} quedaron suscripciones de sobra`);
    }
  });

  it('cada feature que se suscribe se da de baja sola', async () => {
    const base = await suscribidas();
    // Las dos que usan `onChange()`: sidebarCompact y chatKeywordHighlight.
    for (const id of ['sidebarCompact', 'chatKeywordHighlight']) {
      for (let i = 0; i < 4; i += 1) {
        await pagina.evaluate((f) => window.TwitchPP.enable(f), id);
        await pagina.waitForTimeout(60);
        await pagina.evaluate((f) => window.TwitchPP.disable(f), id);
        await pagina.waitForTimeout(60);
      }
      assert.equal(await suscribidas(), base, `${id} no se da de baja tras 4 ciclos`);
    }
  });
});