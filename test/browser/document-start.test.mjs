/**
 * Regresión de arranque en document-start.
 *
 * Tampermonkey puede ejecutar el userscript antes de que exista <html>; en ese
 * momento `document.documentElement` es null. El arranque debe esperar a la
 * raíz, no abortar en `bootStyles`.
 */
import assert from 'node:assert/strict';
import { after, before, it } from 'node:test';

import { arrancar } from './harness.mjs';

let page;
let cerrar;
let errores;

before(async () => {
  ({ page, cerrar, errores } = await arrancar({ documentStart: true }));
});

after(async () => {
  await cerrar();
});

it('arranca cuando documentElement todavía no existe', async () => {
  const estado = await page.evaluate(() => ({
    panel: Boolean(window.__twpp?.shadow),
    fab: Boolean(window.__twpp?.shadow?.querySelector('.fab')),
    style: Boolean(document.getElementById('twpp-style')),
  }));

  assert.equal(estado.panel, true, 'el panel debe montarse');
  assert.equal(estado.fab, true, 'el botón flotante debe existir');
  assert.equal(estado.style, true, 'el CSS debe inyectarse al aparecer la raíz');
  assert.deepEqual(errores, []);
});
