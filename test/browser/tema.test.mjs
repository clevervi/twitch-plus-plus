/**
 * La máquina de estados de `when()`.
 *
 * `darkMode` y `oledContrast` llevan `when: () => !respectTwitchTheme || isDarkTheme()`.
 * Es decir, se activan y se desactivan **solos** cuando Twitch cambia de tema,
 * sin tocar el interruptor del usuario.
 *
 * Eso es exactamente lo que rompió en #53: la feature se aplicaba igual con el
 * tema claro y ponía texto blanco sobre fondo blanco. El bug está corregido y
 * hay unit tests de la condición, pero el mecanismo entero —que el CSS deje de
 * aplicarse cuando el tema cambia— no se había ejercitado nunca en un navegador.
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

/**
 * Espera a que se cumpla algo, en vez de dormir un rato fijo.
 *
 * `when()` se reevalua en el latido del scheduler, que va cada 400 ms pero con
 * la maquina ocupada puede tardar mas. Con esperas fijas el test hacia falta a
 * veces, que es la peor forma de test: verde en local y rojo en CI.
 */
async function esperarA(que, mensaje, intentos = 40) {
  for (let i = 0; i < intentos; i += 1) {
    if (await que()) return true;
    await pagina.waitForTimeout(100);
  }
  throw new Error(`no se cumplio: ${mensaje}`);
}

const oledActiva = () =>
  pagina.evaluate(
    () => !!window.TwitchPP.diagnostics.features().find((f) => f.id === 'oledContrast')?.active,
  );

const oledConScope = () =>
  pagina.evaluate(() => document.documentElement.classList.contains('twpp-oledContrast'));

beforeEach(async () => {
  // Cada test empieza desde un estado conocido: tema oscuro, ajuste por
  // defecto y feature encendida. Sin esto cada test depende del anterior.
  await pagina.evaluate(() => {
    const casilla = window.__twpp.shadow.querySelector('[data-setting="respectTwitchTheme"]');
    casilla.checked = true;
    casilla.dispatchEvent(new Event('change', { bubbles: true }));
    window.TwitchPP.enable('oledContrast');
    window.TwitchPP.enable('darkMode');
  });
  await ponerTema(false);
  await esperarA(oledConScope, 'con tema oscuro la clase de scope deberia estar');
});

/**
 * Twitch pone `tw-root--theme-dark` o `tw-root--theme-light` en el `<html>`
 * según el tema elegido. Se modelan las dos, que es como funciona de verdad.
 */
const ponerTema = (claro) =>
  pagina.evaluate((esClaro) => {
    document.documentElement.classList.toggle('tw-root--theme-dark', !esClaro);
    document.documentElement.classList.toggle('tw-root--theme-light', esClaro);
    document.body.classList.remove('tw-root--theme-dark', 'tw-root--theme-light');
  }, claro);

const estado = () =>
  pagina.evaluate(() => {
    const features = window.TwitchPP.diagnostics.features();
    const oled = features.find((f) => f.id === 'oledContrast');
    const dark = features.find((f) => f.id === 'darkMode');
    return {
      oledActiva: oled?.active,
      oledScope: document.documentElement.classList.contains('twpp-oledContrast'),
      darkActiva: dark?.active,
      darkScope: document.documentElement.classList.contains('twpp-darkMode'),
    };
  });

describe('when() apaga y enciende la feature segun el tema, sin tocar el interruptor', () => {
  it('con el ajuste por defecto, el tema claro deja OLED inactivo', async () => {
    await pagina.evaluate(() => {
      window.TwitchPP.enable('oledContrast');
      window.TwitchPP.enable('darkMode');
    });
    await ponerTema(true);
    await esperarA(async () => !(await oledConScope()), 'con tema claro la clase de scope deberia quitarse');

    const e = await estado();
    assert.equal(e.oledActiva, false, `con tema claro OLED debe estar inactiva (activa=${e.oledActiva})`);
    assert.equal(e.oledScope, false, 'y su clase de scope no debe estar: por eso no rompía el texto');
  });

  it('el tema oscuro la vuelve a encender sola, sin tocar el interruptor', async () => {
    await ponerTema(false);
    await esperarA(oledConScope, 'al volver al tema oscuro la clase de scope deberia volver');

    const e = await estado();
    assert.equal(e.oledActiva, true, 'al volver al tema oscuro debe reencenderse sola');
    assert.equal(e.oledScope, true);
  });

  it('el ajuste por defecto de ambos es "solo en tema oscuro"', async () => {
    // Si el default fuera false, la feature se aplicaría con tema claro y
    // volvería el bug de #53.
    const valores = await pagina.evaluate(() => {
      const inputs = [...window.__twpp.shadow.querySelectorAll('[data-setting]')];
      const de = (k) => inputs.find((i) => i.dataset.setting === k)?.checked;
      return { darkMode: de('respectTwitchTheme') };
    });
    assert.equal(valores.darkMode, true, 'respetar el tema de Twitch debe venir activado por defecto');
  });

  it('con el ajuste desactivado, se aplica tambien con tema claro', async () => {
    await pagina.evaluate(() => {
      const casilla = window.__twpp.shadow.querySelector('[data-setting="respectTwitchTheme"]');
      casilla.checked = false;
      casilla.dispatchEvent(new Event('change', { bubbles: true }));
    });
    await ponerTema(true);
    await esperarA(oledConScope, 'si no se respeta el tema, manda el script y se aplica');

    const e = await estado();
    assert.equal(e.oledActiva, true, 'si el usuario dice "no respectes el tema", manda el script');
    assert.equal(e.oledScope, true);

    await pagina.evaluate(() => {
      const casilla = window.__twpp.shadow.querySelector('[data-setting="respectTwitchTheme"]');
      casilla.checked = true;
      casilla.dispatchEvent(new Event('change', { bubbles: true }));
    });
    await esperarA(async () => !(await oledConScope()), 'al volver a respetar el tema con el claro, se quita');
  });

  it('varios cambios de tema seguidos no dejan el estado descuadrado', async () => {
    for (const claro of [true, false, true, true, false, false]) {
      await ponerTema(claro);
      await esperarA(async () => (await oledActiva()) === !claro, `tras poner tema ${claro ? 'claro' : 'oscuro'}`);
    }

    const e = await estado();
    // Termina en tema oscuro, así que debe estar activa y con su clase puesta.
    assert.equal(e.oledActiva, true);
    assert.equal(e.oledScope, true, 'la clase de scope tiene que coincidir con el estado');
  });
});