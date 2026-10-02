/**
 * Las features que cambian el aspecto de la página, medidas por lo que hacen.
 *
 * `theater-clean` es la más delicada de las dos: pone `opacity: 0` en toda la
 * barra de navegación superior. Lo único que la devuelve a la vista son las
 * reglas `:hover` y `:focus-within`. Si `:focus-within` fallara, quien navega
 * solo con teclado se quedaría sin barra de navegación y sin ninguna pista de
 * por qué.
 */
import assert from 'node:assert/strict';
import { after, before, beforeEach, describe, it } from 'node:test';

import { arrancar } from './harness.mjs';

let pagina;
let cerrar;

before(async () => {
  ({ page: pagina, cerrar } = await arrancar());
});

after(async () => {
  await cerrar();
});

const TOP_NAV = '[data-a-target="top-nav-container"]';
const SIDEBAR = '[data-a-target="side-nav-bar"]';

const opacidad = (selector) =>
  pagina.evaluate((sel) => {
    const el = document.querySelector(sel);
    return el ? Number(getComputedStyle(el).opacity) : null;
  }, selector);

const ancho = (selector) =>
  pagina.evaluate((sel) => {
    const el = document.querySelector(sel);
    return el ? Math.round(el.getBoundingClientRect().width) : null;
  }, selector);

/**
 * `theater-clean` anima la opacidad con `transition: opacity .25s`. Sin esperar,
 * se mide a mitad de camino y el test falla por la transición, no por el código.
 *
 * Devuelve si **se alcanzó** el objetivo, no el valor: la transición puede
 * acabar en `1e-7` y no en `0`, y comparar números en coma flotante con
 * igualdad da falsos rojos.
 */
async function esperarOpacidad(selector, objetivo, margen = 0.02) {
  for (let intento = 0; intento < 30; intento += 1) {
    const valor = await opacidad(selector);
    if (valor !== null && Math.abs(valor - objetivo) <= margen) return true;
    await pagina.waitForTimeout(60);
  }
  return false;
}

beforeEach(async () => {
  await pagina.evaluate(() => {
    window.TwitchPP.disable('theaterClean');
    window.TwitchPP.disable('sidebarCompact');
  });
  await pagina.waitForTimeout(200);
});

describe('teatro limpio', () => {
  it('esconde la barra de navegacion', async () => {
    assert.ok(await esperarOpacidad(TOP_NAV, 1), 'sin la feature se ve');

    await pagina.evaluate(() => window.TwitchPP.enable('theaterClean'));
    assert.ok(await esperarOpacidad(TOP_NAV, 0), 'con la feature se esconde del todo');
  });

  it('vuelve al pasar el raton', async () => {
    await pagina.evaluate(() => window.TwitchPP.enable('theaterClean'));
    await esperarOpacidad(TOP_NAV, 0);

    await pagina.hover(TOP_NAV);
    assert.ok(await esperarOpacidad(TOP_NAV, 1), 'al pasar el raton tiene que verse');
  });

  it('vuelve al tabular dentro: quien no usa raton no se queda sin barra', async () => {
    // La regla que salva a quien navega con teclado. Si esta deja de funcionar,
    // el fallo no se ve mirando la página con ratón y sí se nota usándola.
    //
    // El ratón se aparta antes de nada porque si no, el `:hover` del test
    // anterior sigue puesto y la opacidad es 1 de todas formas: el test pasaba
    // con la regla `:focus-within` borrada. Comprobado.
    await pagina.evaluate(() => window.TwitchPP.enable('theaterClean'));
    await pagina.mouse.move(700, 850);
    assert.ok(await esperarOpacidad(TOP_NAV, 0), 'con el ratón lejos tiene que estar escondida');

    await pagina.focus('[data-a-target="user-menu-button"]');
    assert.ok(
      await esperarOpacidad(TOP_NAV, 1),
      'solo el foco dentro puede sacarla de 0: si no, no hay salida para teclado',
    );
  });

  it('apagarla la devuelve a la vista', async () => {
    await pagina.evaluate(() => window.TwitchPP.enable('theaterClean'));
    await esperarOpacidad(TOP_NAV, 0);

    await pagina.evaluate(() => window.TwitchPP.disable('theaterClean'));
    assert.ok(
      await esperarOpacidad(TOP_NAV, 1),
      'al apagar tiene que verse otra vez, no quedarse en invisible',
    );
  });
});

describe('sidebar compacta', () => {
  it('estrecha la barra lateral al ancho configurado', async () => {
    const antes = await ancho(SIDEBAR);
    await pagina.evaluate(() => window.TwitchPP.enable('sidebarCompact'));
    await pagina.waitForTimeout(250);

    const variable = await pagina.evaluate(() =>
      document.documentElement.style.getPropertyValue('--twpp-sidebar-width'),
    );
    assert.equal(variable, '72px', 'la variable CSS es la que manda sobre el ancho');
    assert.ok(
      (await ancho(SIDEBAR)) < antes,
      `debe estrechar: ${antes}px -> ${await ancho(SIDEBAR)}px`,
    );
  });

  it('respeta el ancho que el usuario configure', async () => {
    await pagina.evaluate(() => window.TwitchPP.enable('sidebarCompact'));
    // `sidebarWidth` es un número, y la feature lo acota a 50..120.
    await pagina.evaluate(() => {
      const { shadow } = window.__twpp;
      const input = shadow.querySelector('[data-setting="sidebarWidth"]');
      input.value = '120';
      input.dispatchEvent(new Event('change', { bubbles: true }));
    });
    await pagina.waitForTimeout(250);

    const variable = await pagina.evaluate(() =>
      document.documentElement.style.getPropertyValue('--twpp-sidebar-width'),
    );
    assert.equal(variable, '120px', 'cambiar el ajuste cambia el ancho en vivo');
  });

  it('apagarla devuelve el ancho original y quita la variable', async () => {
    const antes = await ancho(SIDEBAR);
    await pagina.evaluate(() => window.TwitchPP.enable('sidebarCompact'));
    await pagina.waitForTimeout(250);
    assert.notEqual(await ancho(SIDEBAR), antes, 'antes de apagar está estrecha');

    await pagina.evaluate(() => window.TwitchPP.disable('sidebarCompact'));
    await pagina.waitForTimeout(250);

    assert.equal(await ancho(SIDEBAR), antes, 'vuelve al ancho que tenía');
    assert.equal(
      await pagina.evaluate(() =>
        document.documentElement.style.getPropertyValue('--twpp-sidebar-width'),
      ),
      '',
      'y la variable CSS se quita, no se deja puesta',
    );
  });
});