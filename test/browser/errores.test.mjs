/**
 * Ninguna feature puede lanzar.
 *
 * Este es el test que faltaba cuando v2.2.16 salió con dos `ReferenceError` de
 * una linea:
 *
 * - `partas` por `partes` en `isDarkTheme()`. Como `allowed()` envuelve `when()`
 *   en un `try/catch` que devuelve `false`, la excepcion se convertia en "feature
 *   apagada". Tema OLED y contraste alto dejaron de funcionar para todo el
 *   mundo y ningun test fallo.
 * - `element` por `elemento` en `restaurar()`. `apply()` se traga la excepcion
 *   de los hooks con un `track()`, asi que tampoco se veia.
 *
 * Un test que comprueba el resultado no distingue "la logica funciona" de "la
 * funcion revienta": en los dos casos el resultado es "no hace nada".
 * Lo que si distingue es mirar si se registro alguna excepcion.
 */
import assert from 'node:assert/strict';
import { after, before, beforeEach, describe, it } from 'node:test';

import { arrancar } from './harness.mjs';

let pagina;
let cerrar;

const errores = () => pagina.evaluate(() => window.TwitchPP.diagnostics.errors());

/** Las excepciones de una lectura, en texto corto para comparar. */
const resumenErrores = async () =>
  (await errores()).map((e) => `${e.scope}: ${e.message}`);

const ponerTodas = (accion) =>
  pagina.evaluate((acc) => {
    window.TwitchPP.diagnostics.features().forEach((f) => window.TwitchPP[acc](f.id));
  }, accion);

before(async () => {
  ({ page: pagina, cerrar } = await arrancar());
});

after(async () => {
  await cerrar();
});

beforeEach(async () => {
  await ponerTodas('disable');
  await pagina.waitForTimeout(300);

  // Overlay de extensión dentro del player, para que `kill()` tenga algo que
  // matar. Sin esto `ocultos` queda vacío, `restore()` itera sobre nada y
  // `restaurar()` no llega a llamarse: el bug de `element` por `elemento` no se
  // reproduce y el test pasa sin comprobar lo que dice comprobar.
  await pagina.evaluate(() => {
    if (document.getElementById('ext-error')) return;
    const player = document.querySelector('[data-a-target="video-player"]');
    const box = document.createElement('div');
    box.id = 'ext-error';
    box.className = 'extension-view';
    box.innerHTML = '<iframe src="about:blank"></iframe>';
    player.appendChild(box);
  });
});

describe('ninguna feature lanza excepciones', () => {
  it('encenderlas todas y esperar a que corran no registra ni una', async () => {
    await ponerTodas('enable');
    // Dos ticks largos: hay features con interval de 1500 y 2000 ms, y el tick
    // es donde se ejecutan casi todas las rutas.
    await pagina.waitForTimeout(3200);

    const registrados = await resumenErrores();
    assert.deepEqual(registrados, [], `excepciones al encender: ${registrados.join(' | ')}`);
  });

  it('apagarlas todas tampoco registra ni una', async () => {
    await ponerTodas('enable');
    await pagina.waitForTimeout(3200);
    await ponerTodas('disable');
    await pagina.waitForTimeout(500);

    const registrados = await resumenErrores();
    // Aqui es donde moria `restaurar()`: el onDisable lanzaba y `apply()` lo
    // registraba como `enable:hideExtensions`.
    assert.deepEqual(registrados, [], `excepciones al apagar: ${registrados.join(' | ')}`);
  });

  it('tres ciclos seguidos siguen sin registrar nada', async () => {
    for (let vuelta = 0; vuelta < 3; vuelta += 1) {
      await ponerTodas('enable');
      await pagina.waitForTimeout(1700);
      await ponerTodas('disable');
      await pagina.waitForTimeout(400);
    }

    const registrados = await resumenErrores();
    assert.deepEqual(registrados, [], `excepciones en 3 ciclos: ${registrados.join(' | ')}`);
  });

  it('las features con when() se encienden y apagan sin lanzar', async () => {
    // Aislado porque es donde fallo `isDarkTheme()`. Sin `respectTwitchTheme`
    // el `when()` no llega a llamar a la deteccion.
    const conWhen = await pagina.evaluate(() =>
      window.TwitchPP.diagnostics.features().filter((f) => !f.blocked).map((f) => f.id),
    );
    assert.ok(conWhen.length > 0, 'debe haber features que comprobar');

    await pagina.evaluate(() => {
      const casilla = window.__twpp.shadow.querySelector('[data-setting="respectTwitchTheme"]');
      casilla.checked = true;
      casilla.dispatchEvent(new Event('change', { bubbles: true }));
    });
    await pagina.waitForTimeout(300);

    for (const id of ['darkMode', 'oledContrast']) {
      await pagina.evaluate((f) => window.TwitchPP.enable(f), id);
    }
    await pagina.waitForTimeout(1600);

    const registrados = await resumenErrores();
    assert.deepEqual(
      registrados,
      [],
      `cuando() no debe lanzar: ${registrados.filter((e) => e.includes('when:')).join(' | ') || registrados.join(' | ')}`,
    );
  });
});