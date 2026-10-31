/**
 * El panel, medido por lo que hace: FAB usable, cierre, secciones, buscador,
 * tema y estados. Son las cosas que no se pueden comprobar con el DOM de
 * mentira porque dependen de estilos computados o de eventos reales.
 */
import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';

import { arrancar } from './harness.mjs';

let page;
let cerrar;

before(async () => {
  ({ page, cerrar } = await arrancar());
});

after(async () => {
  await cerrar();
});

const abrir = () =>
  page.evaluate(() => {
    const { shadow } = window.__twpp;
    if (shadow.querySelector('.panel').hidden) shadow.querySelector('.fab').click();
  });

describe('el panel tiene una entrada clara y se puede cerrar', () => {
  it('el FAB es grande y el cierre devuelve el foco', async () => {
    const datos = await page.evaluate(() => {
      const { shadow } = window.__twpp;
      const fab = shadow.querySelector('.fab');
      const rect = fab.getBoundingClientRect();
      fab.click();
      const panel = shadow.querySelector('.panel');
      return {
        width: rect.width,
        height: rect.height,
        open: !panel.hidden,
        expanded: fab.getAttribute('aria-expanded'),
        hasClose: Boolean(shadow.getElementById('close')),
      };
    });

    assert.ok(datos.width >= 38 && datos.height >= 38, `FAB ${datos.width}x${datos.height}`);
    assert.equal(datos.open, true);
    assert.equal(datos.expanded, 'true');
    assert.equal(datos.hasClose, true);

    const cerrado = await page.evaluate(() => {
      const { shadow } = window.__twpp;
      shadow.getElementById('close').click();
      return {
        hidden: shadow.querySelector('.panel').hidden,
        expanded: shadow.querySelector('.fab').getAttribute('aria-expanded'),
      };
    });
    assert.equal(cerrado.hidden, true);
    assert.equal(cerrado.expanded, 'false');
  });
});

describe('acción principal separada del mantenimiento', () => {
  it('solo Pausar chat queda en la barra inferior', async () => {
    const datos = await page.evaluate(() => {
      const { shadow } = window.__twpp;
      const advanced = shadow.querySelector('.section[data-section="advanced"]');
      return {
        resetEnAvanzado: Boolean(advanced?.querySelector('[data-action="reset"]')),
        updateEnAcciones: Boolean(shadow.querySelector('.actions [data-action="update"]')),
        pauseEnAcciones: Boolean(shadow.querySelector('.actions [data-action="pause"]')),
        accionesAvanzadas: [...advanced.querySelectorAll('.advanced-actions [data-action]')].map((b) => b.dataset.action),
      };
    });

    assert.equal(datos.resetEnAvanzado, true);
    assert.equal(datos.updateEnAcciones, false);
    assert.equal(datos.pauseEnAcciones, true);
    assert.deepEqual(datos.accionesAvanzadas, ['update', 'catalog', 'export', 'import', 'diagnostics', 'reset']);
  });
});

describe('secciones accesibles', () => {
  it('son botones y actualizan aria-expanded al colapsar', async () => {
    await abrir();
    const antes = await page.evaluate(() => {
      const title = window.__twpp.shadow.querySelector('.section[data-section="chat"] .section-title');
      return { tag: title.tagName, expanded: title.getAttribute('aria-expanded') };
    });
    assert.equal(antes.tag, 'BUTTON');
    assert.equal(antes.expanded, 'true');

    const despues = await page.evaluate(() => {
      const { shadow } = window.__twpp;
      const title = shadow.querySelector('.section[data-section="chat"] .section-title');
      title.click();
      return {
        expanded: title.getAttribute('aria-expanded'),
        collapsed: title.closest('.section').classList.contains('collapsed'),
      };
    });
    assert.equal(despues.expanded, 'false');
    assert.equal(despues.collapsed, true);

    await page.evaluate(() =>
      window.__twpp.shadow.querySelector('.section[data-section="chat"] .section-title').click(),
    );
  });
});

describe('buscador del panel', () => {
  it('encuentra ajustes y oculta la feature entera, no solo el título', async () => {
    await abrir();
    const buscar = (texto) =>
      page.evaluate((valor) => {
        const input = window.__twpp.shadow.getElementById('search');
        input.value = valor;
        input.dispatchEvent(new Event('input', { bubbles: true }));
      }, texto);

    await buscar('espera');
    const porAjuste = await page.evaluate(() => {
      const { shadow } = window.__twpp;
      return {
        feature: shadow.querySelector('.feature[data-feature="autoReconnect"]').style.display,
        otra: shadow.querySelector('.feature[data-feature="darkMode"]').style.display,
      };
    });
    assert.notEqual(porAjuste.feature, 'none', 'el ajuste "Espera inicial" debe encontrar su feature');
    assert.equal(porAjuste.otra, 'none');

    await buscar('ancho');
    const porAncho = await page.evaluate(
      () => window.__twpp.shadow.querySelector('.feature[data-feature="sidebarCompact"]').style.display,
    );
    assert.notEqual(porAncho, 'none', 'el ajuste "Ancho (px)" debe encontrar la feature');

    await buscar('zzzz');
    const sinResultados = await page.evaluate(
      () => window.__twpp.shadow.querySelector('.section[data-section="chat"]').style.display,
    );
    assert.equal(sinResultados, 'none');

    await buscar('');
  });
});

describe('tema y estado', () => {
  it('sigue el tema de Twitch y explica una feature bloqueada', async () => {
    await abrir();
    await page.evaluate(() => {
      document.documentElement.classList.add('tw-root--theme-light');
      history.pushState({}, '', '/panel-claro');
    });
    await page.waitForTimeout(80);

    const claro = await page.evaluate(() => {
      const { shadow } = window.__twpp;
      const panel = shadow.querySelector('.panel');
      const status = shadow.querySelector('[data-status="darkMode"]');
      return {
        theme: panel.dataset.theme,
        bg: getComputedStyle(panel).backgroundColor,
        note: status.textContent,
        hidden: status.hidden,
      };
    });
    assert.equal(claro.theme, 'light');
    assert.equal(claro.bg, 'rgb(255, 255, 255)');
    assert.match(claro.note, /inactiva/);
    assert.equal(claro.hidden, false);

    await page.evaluate(() => {
      document.documentElement.classList.remove('tw-root--theme-light');
      history.pushState({}, '', '/panel-oscuro');
    });
    await page.waitForTimeout(80);

    const oscuro = await page.evaluate(() => {
      const { shadow } = window.__twpp;
      return {
        theme: shadow.querySelector('.panel').dataset.theme,
        hidden: shadow.querySelector('[data-status="darkMode"]').hidden,
      };
    });
    assert.equal(oscuro.theme, 'dark');
    assert.equal(oscuro.hidden, true);
  });
});
