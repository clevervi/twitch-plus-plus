/**
 * Las features de ocultación, comprobadas por lo que hacen y no por si están
 * activas.
 *
 * El test de fugas demuestra que limpian al apagarlas. Este demuestra lo otro:
 * que `display: none` llega de verdad al elemento correcto, medido con estilos
 * calculados, que es justo lo que `tools/dom-stub.mjs` no puede dar.
 */
import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';

import { arrancar, estaOculto } from './harness.mjs';

let pagina;
let cerrar;

before(async () => {
  ({ page: pagina, cerrar } = await arrancar());
});

after(async () => {
  await cerrar();
});

/** Activa la feature, mide y la vuelve a apagar. */
async function conLaFeature(id, selector) {
  await pagina.evaluate((f) => window.TwitchPP.enable(f), id);
  await pagina.waitForTimeout(150);
  const resultado = await estaOculto(pagina, selector);
  await pagina.evaluate((f) => window.TwitchPP.disable(f), id);
  await pagina.waitForTimeout(150);
  return resultado;
}

describe('cada feature de ocultacion oculta lo que dice', () => {
  it('sin el contador de viewers, el contador desaparece', async () => {
    const sel = 'strong[data-a-target="animated-channel-viewers-count"]';
    assert.equal(await conLaFeature('hideViewerCount', sel), true);
  });

  it('sin barra lateral, la barra desaparece', async () => {
    assert.equal(await conLaFeature('hideSidebar', '[data-a-target="side-nav-bar"]'), true);
  });

  it('modo limpio esconde los bloques de promocion', async () => {
    for (const sel of [
      '[data-a-target="prime-offer"]',
      '[data-a-target="chat-input-upsell"]',
      '[data-a-target="gift-sub-banner"]',
    ]) {
      assert.equal(await conLaFeature('cleanMode', sel), true, `debería esconder ${sel}`);
    }
  });

  it('sin "A continuacion" esconde la cola', async () => {
    for (const sel of ['[data-a-target="up-next-queue"]', '[data-a-target="recommended-channels"]']) {
      assert.equal(await conLaFeature('hideUpNext', sel), true, `debería esconder ${sel}`);
    }
  });

  it('sin Stories esconde la bandeja', async () => {
    for (const sel of ['[data-a-target="stories-tray"]', '[data-a-target="stories-button"]']) {
      assert.equal(await conLaFeature('hideStories', sel), true, `debería esconder ${sel}`);
    }
  });

  it('sin Bits ni normas esconde los botones del chat', async () => {
    for (const sel of [
      '[data-a-target="bits-button"]',
      '[data-a-target="chat-rules-button"]',
      '[data-a-target="chat-commands-button"]',
    ]) {
      assert.equal(await conLaFeature('hideChatExtras', sel), true, `debería esconder ${sel}`);
    }
  });

  it('sin sidebar, el resto de la pagina sigue visible', async () => {
    // Una feature de ocultación que se lleva por delante lo que no debe.
    await pagina.evaluate(() => window.TwitchPP.enable('hideSidebar'));
    await pagina.waitForTimeout(150);
    const chat = await estaOculto(pagina, '.chat-scrollable-area__message-container');
    const input = await estaOculto(pagina, '[data-a-target="chat-input"]');
    await pagina.evaluate(() => window.TwitchPP.disable('hideSidebar'));
    assert.equal(chat, false, 'ocultar la sidebar no puede ocultar el chat');
    assert.equal(input, false, 'ni la caja de escribir');
  });
});

describe('hide-offline-channels decide bien que cards esconder', () => {
  const estadoDe = () =>
    pagina.evaluate(() =>
      [...document.querySelectorAll('[data-test-selector="cards-prueba"] [data-a-target="side-nav-card"]')].map(
        (card) => ({
          caso: card.dataset.estado,
          offline: card.getAttribute('data-twpp-offline'),
          oculto: getComputedStyle(card).display === 'none',
        }),
      ),
    );

  it('esconde las tres formas de card desconectada', async () => {
    await pagina.evaluate(() => window.TwitchPP.enable('hideOfflineChannels'));
    await pagina.waitForTimeout(1200);
    const estado = await estadoDe();
    assert.equal(estado.length, 6, 'la fixture debe traer las seis cards de prueba');

    for (const caso of ['offline-texto', 'offline-clase', 'offline-aria']) {
      const fila = estado.find((x) => x.caso === caso);
      assert.equal(fila.offline, '1', `${caso} debería marcarse como offline`);
      assert.equal(fila.oculto, true, `${caso} debería esconderse`);
    }
  });

  it('NO esconde las cards que estan en directo', async () => {
    await pagina.evaluate(() => window.TwitchPP.enable('hideOfflineChannels'));
    await pagina.waitForTimeout(1200);
    const estado = await estadoDe();

    for (const caso of ['vivo-indicador', 'vivo-contador']) {
      const fila = estado.find((x) => x.caso === caso);
      assert.equal(fila.offline, '0', `${caso} no es offline`);
      assert.equal(fila.oculto, false, `${caso} no debe esconderse`);
    }
  });

  it('NO esconde un canal en directo que se llama "offline_tv"', async () => {
    // El caso que de verdad importa: la feature busca la palabra "offline" en el
    // texto de la card, así que un canal en directo llamado así no puede
    // desaparecer. Lo que lo evita es que el indicador de directo se comprueba
    // antes que el texto.
    await pagina.evaluate(() => window.TwitchPP.enable('hideOfflineChannels'));
    await pagina.waitForTimeout(1200);
    const fila = (await estadoDe()).find((x) => x.caso === 'vivo-se-llama-offline');

    assert.ok(fila, 'la card debe existir en la fixture');
    assert.equal(fila.offline, '0');
    assert.equal(fila.oculto, false, 'un canal en directo no puede esconderse por llamarse offline');
  });

  it('apagar la quita el atributo de todas', async () => {
    await pagina.evaluate(() => window.TwitchPP.enable('hideOfflineChannels'));
    await pagina.waitForTimeout(1000);
    await pagina.evaluate(() => window.TwitchPP.disable('hideOfflineChannels'));

    const atributos = await pagina.evaluate(
      () => document.querySelectorAll('[data-twpp-offline]').length,
    );
    assert.equal(atributos, 0, 'no puede quedar ninguna card marcada');
  });
});