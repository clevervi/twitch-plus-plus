/**
 * Miniatura en sidebar, de punta a punta.
 *
 * `sidebar-preload.test.mjs` cubre solo la programación del precargado; su
 * propio comentario admite que el DOM stub no resuelve `nav a[href^="/"]`, así
 * que nunca llega a la inyección. Aquí sí se llega: se dispara el `mouseover`
 * real sobre la card y se comprueba la imagen.
 *
 * Esto habría cogido los dos bugs que hizo falta que reportara el usuario:
 * que la card es el propio `<a>` (#102) y que hay que ignorar el tooltip que
 * Twitch está retirando (#109).
 */
import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';

import { arrancar } from './harness.mjs';

const ID = 'sidebarThumbnailPreview';

// GIF de 1x1 transparente. Sin esto la peticion al CDN falla, salta el `error`
// que lleva su propio manejador y la imagen se borra antes de poder comprobarla.
const GIF = Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64');

let pagina;
let cerrar;

before(async () => {
  ({ page: pagina, cerrar } = await arrancar());
  await pagina.context().route('**/static-cdn.jtvnw.net/**', (ruta) =>
    ruta.fulfill({ status: 200, contentType: 'image/gif', body: GIF }),
  );
  await pagina.evaluate((f) => window.TwitchPP.enable(f), ID);
});

after(async () => {
  await cerrar();
});

/**
 * Monta el tooltip como lo haria Twitch: junto a la card y con el nombre del
 * canal dentro. La fixture es un esqueleto sin los estilos de Twitch, asi que
 * sin darle geometria explicita las comprobaciones de distancia no podrian
 * cumplirse nunca y el test pasaria por el motivo equivocado.
 */
async function abrirTooltip(canal, { ocultarAnterior = false } = {}) {
  await pagina.evaluate(
    ({ canal, ocultarAnterior }) => {
      // `ocultarAnterior` reproduce lo que hace Twitch al cambiar de canal: el
      // tooltip saliente NO se destruye, sigue conectado y en el documento
      // (ademas por delante), y solo se marca aria-hidden mientras se retira.
      for (const viejo of document.querySelectorAll('.online-side-nav-channel-tooltip__body')) {
        const capa = viejo.parentElement;
        if (ocultarAnterior) capa.setAttribute('aria-hidden', 'true');
        else capa.remove();
      }

      const card = document.querySelector(`.side-nav-card[href="/${canal}"]`);
      const r = card.getBoundingClientRect();

      const tip = document.createElement('div');
      tip.className = 'online-side-nav-channel-tooltip__body';
      tip.textContent = canal;
      tip.style.cssText =
        `position:fixed;left:${r.right + 8}px;top:${r.top}px;` +
        'width:260px;height:90px;background:#18181b;color:#efeff1;';

      const capa = document.createElement('div');
      capa.append(tip);
      document.body.append(capa);
    },
    { canal, ocultarAnterior },
  );
}

/** Pasa el raton por la card de un canal y devuelve el src de la miniatura. */
async function pasarRaton(canal) {
  await pagina.evaluate(
    (c) => document.querySelector(`.side-nav-card[href="/${c}"]`)
      .dispatchEvent(new MouseEvent('mouseover', { bubbles: true })),
    canal,
  );
  // El codigo reintenta hasta 8 veces cada 50 ms mientras Twitch abre el
  // tooltip, asi que hay que darle margen antes de mirar.
  await pagina.waitForTimeout(700);
  return pagina.evaluate(() => {
    const img = document.querySelector('img.twpp-sidebar-thumb');
    return img ? img.getAttribute('src') : null;
  });
}

/**
 * Dónde ha quedado la miniatura: en qué tooltip y si ese tooltip es el retirado.
 *
 * Comprobar solo el `src` no basta. El fallo anterior no ponia la imagen
 * equivocada: la ponia en el tooltip equivocado, el que Twitch ya estaba
 * retirando. Con el src correcto y el destino incorrecto, un test que solo
 * mire la URL pasa siempre.
 */
async function dondeEstaLaMiniatura() {
  return pagina.evaluate(() => {
    const img = document.querySelector('img.twpp-sidebar-thumb');
    if (!img) return null;
    const tip = img.closest('.online-side-nav-channel-tooltip__body');
    return {
      src: img.getAttribute('src'),
      canalDelTooltip: tip ? tip.textContent.trim() : null,
      dentroDeOculto: Boolean(img.closest('[aria-hidden="true"]')),
    };
  });
}

describe('miniatura en sidebar', () => {
  it('inyecta la miniatura al pasar el raton por una card', async () => {
    await abrirTooltip('ibai');
    const src = await pasarRaton('ibai');
    assert.match(src, /live_user_ibai-320x180\.jpg$/);
  });

  it('inyecta en el tooltip nuevo aunque el anterior siga conectado delante', async () => {
    await abrirTooltip('auronplay');
    assert.match(await pasarRaton('auronplay'), /live_user_auronplay-/);

    // Ahora el de ibai, dejando el de auronplay conectado, por delante y con
    // aria-hidden. Un querySelector a secas devuelve el viejo: ese era el fallo.
    await abrirTooltip('ibai', { ocultarAnterior: true });
    await pasarRaton('ibai');

    const donde = await dondeEstaLaMiniatura();
    assert.ok(donde, 'no se inyecto ninguna miniatura');
    assert.match(donde.src, /live_user_ibai-320x180\.jpg$/);
    assert.equal(donde.canalDelTooltip, 'ibai', 'la imagen cayo en el tooltip equivocado');
    assert.equal(
      donde.dentroDeOculto,
      false,
      'la imagen quedo dentro del tooltip que Twitch esta retirando',
    );
  });

  it('deja como mucho una miniatura, no las apila', async () => {
    await abrirTooltip('ibai');
    await pasarRaton('ibai');
    await abrirTooltip('auronplay');
    await pasarRaton('auronplay');
    const total = await pagina.evaluate(
      () => document.querySelectorAll('img.twpp-sidebar-thumb').length,
    );
    assert.equal(total, 1);
  });

  it('quita la miniatura y restaura los estilos al apagar la feature', async () => {
    await abrirTooltip('ibai');
    await pasarRaton('ibai');

    await pagina.evaluate((f) => window.TwitchPP.disable(f), ID);
    await pagina.waitForTimeout(200);

    const restos = await pagina.evaluate(() => ({
      imagenes: document.querySelectorAll('img.twpp-sidebar-thumb').length,
      inline: [...document.querySelectorAll('[style*="width"]')].filter(
        (n) => n.style.width === '320px',
      ).length,
    }));
    assert.equal(restos.imagenes, 0);
    assert.equal(restos.inline, 0);

    await pagina.evaluate((f) => window.TwitchPP.enable(f), ID);
  });
});