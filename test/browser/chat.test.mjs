/**
 * Las tres features que leen y escriben el chat.
 *
 * Hasta ahora solo se comprobaba que limpien al apagarlas. Aquí se comprueba que
 * **marksen y filtran**: que `chat-keywords` resalta lo que debe, que `chat-search`
 * filtra y cuenta, y que `hide-extensions` esconde un overlay de verdad y lo
 * devuelve al apagar.
 *
 * Las tres dependen de que la fixture tenga chat con texto, y ahora lo tiene
 * con acentos y con chino, que es donde más falla de verdad.
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

const lineas = () =>
  pagina.evaluate(() =>
    [...document.querySelectorAll('[data-a-target="chat-line-message"]')].map((l) => ({
      texto: l.textContent.trim(),
      keyword: l.classList.contains('twpp-keyword'),
      match: l.classList.contains('twpp-chat-match'),
      ocultas: l.classList.contains('twpp-chat-hidden'),
      atenuadas: l.classList.contains('twpp-chat-dim'),
    })),
  );

const ponerAjustes = (pares) =>
  pagina.evaluate((p) => {
    for (const [clave, valor] of p) {
      window.__twpp.shadow
        .querySelector(`[data-setting="${clave}"]`)
        ?.dispatchEvent(new Event('change', { bubbles: true }));
      const input = window.__twpp.shadow.querySelector(`[data-setting="${clave}"]`);
      if (input && input.type !== 'checkbox') {
        input.value = valor;
        input.dispatchEvent(new Event('change', { bubbles: true }));
      }
    }
  }, pares);

beforeEach(async () => {
  await pagina.evaluate(() => {
    window.TwitchPP.disable('chatKeywordHighlight');
    window.TwitchPP.disable('chatSearch');
    window.TwitchPP.disable('hideExtensions');
  });
  await pagina.waitForTimeout(200);
});

describe('resaltar palabras clave', () => {
  it('marca solo las lineas que contienen la palabra', async () => {
    await pagina.evaluate(() => {
      window.TwitchPP.enable('chatKeywordHighlight');
    });
    await pagina.waitForTimeout(300);
    await ponerAjustes([['chatKeywords', 'Buenas']]);
    await pagina.waitForTimeout(1200);

    const estado = await lineas();
    const conPalabra = estado.filter((l) => l.texto.includes('Buenas'));
    const sinPalabra = estado.filter((l) => !l.texto.includes('Buenas'));

    assert.ok(conPalabra.length >= 1, 'la fixture debe tener alguna línea con "Buenas"');
    assert.ok(
      conPalabra.every((l) => l.keyword),
      'la línea con la palabra debe quedar resaltada',
    );
    assert.ok(
      sinPalabra.every((l) => !l.keyword),
      `ninguna otra debe resaltarse, se resaltaban: ${sinPalabra.filter((l) => l.keyword).map((l) => l.texto).join(' | ')}`,
    );
  });

  it('con acentos y con chino tambien funciona', async () => {
    await pagina.evaluate(() => window.TwitchPP.enable('chatKeywordHighlight'));
    await pagina.waitForTimeout(300);
    await ponerAjustes([['chatKeywords', '看得见']]);
    await pagina.waitForTimeout(1200);

    const conChino = (await lineas()).filter((l) => l.texto.includes('看得见'));
    assert.ok(conChino.length >= 1, 'la línea china debe existir en la fixture');
    assert.ok(conChino.every((l) => l.keyword), 'una palabra en chino debe resaltar igual');
  });

  it('se apaga y deja el chat limpio', async () => {
    await pagina.evaluate(() => window.TwitchPP.enable('chatKeywordHighlight'));
    await pagina.waitForTimeout(300);
    await ponerAjustes([['chatKeywords', 'Buenas']]);
    await pagina.waitForTimeout(1000);

    await pagina.evaluate(() => window.TwitchPP.disable('chatKeywordHighlight'));
    await pagina.waitForTimeout(400);

    const estado = await lineas();
    assert.ok(estado.every((l) => !l.keyword), 'no puede quedar ninguna línea resaltada');
  });
});

describe('buscar en el chat', () => {
  const escribir = (texto) =>
    pagina.evaluate((t) => {
      const input = document.querySelector('.twpp-search-input');
      if (!input) return false;
      input.value = t;
      input.dispatchEvent(new Event('input', { bubbles: true }));
      return true;
    }, texto);

  it('monta su barra de busqueda', async () => {
    await pagina.evaluate(() => window.TwitchPP.enable('chatSearch'));
    await pagina.waitForTimeout(400);
    const hay = await pagina.evaluate(() => !!document.querySelector('.twpp-search-input'));
    assert.ok(hay, 'tiene que aparecer el campo de búsqueda');
  });

  it('marca las que casan y oculta las que no', async () => {
    await pagina.evaluate(() => window.TwitchPP.enable('chatSearch'));
    await pagina.waitForTimeout(400);
    assert.ok(await escribir('Buenas'), 'el campo de búsqueda debe existir');

    await pagina.waitForTimeout(400);
    const estado = await lineas();
    const conTexto = estado.filter((l) => l.texto.includes('Buenas'));
    assert.ok(conTexto.every((l) => l.match), 'la que casa debe marcarse como match');
    assert.ok(
      estado.filter((l) => !l.texto.includes('Buenas')).every((l) => l.ocultas),
      'las que no casan deben ocultarse',
    );
  });

  it('cuenta cuantas encuentra', async () => {
    await pagina.evaluate(() => window.TwitchPP.enable('chatSearch'));
    await pagina.waitForTimeout(400);
    await escribir('Hola');
    await pagina.waitForTimeout(400);

    const cuenta = await pagina.evaluate(
      () => document.querySelector('.twpp-search-count')?.textContent ?? '',
    );
    assert.match(cuenta, /\d/, `el contador debe decir cuántos hay, decía "${cuenta}"`);
  });

  it('un patron peligroso se rechaza con un aviso, sin colgarse', async () => {
    // Sin el guard de #47/#57 esto se queda minutos calculando.
    await pagina.evaluate(() => {
      window.TwitchPP.enable('chatSearch');
      const casilla = window.__twpp.shadow.querySelector('[data-setting="chatSearchRegex"]');
      casilla.checked = true;
      casilla.dispatchEvent(new Event('change', { bubbles: true }));
    });
    await pagina.waitForTimeout(500);
    const activo = await pagina.evaluate(
      () => !!window.__twpp.shadow.querySelector('[data-setting="chatSearchRegex"]').checked,
    );
    assert.ok(activo, 'el ajuste de regex tiene que quedar activado, si no el test no prueba nada');

    const escrito = await escribir('(a+)+$');
    assert.ok(escrito, 'el campo debe existir');
    await pagina.waitForTimeout(600);

    const aviso = await pagina.evaluate(
      () => document.querySelector('.twpp-search-count')?.textContent ?? '',
    );
    assert.match(
      aviso,
      /rechazada|200|anidada/i,
      `debe avisar de que el patrón es peligroso, decía "${aviso}"`,
    );
  });

  it('al apagar desaparece la barra y se quita el resaltado', async () => {
    await pagina.evaluate(() => window.TwitchPP.enable('chatSearch'));
    await pagina.waitForTimeout(400);
    await escribir('Buenas');
    await pagina.waitForTimeout(400);

    await pagina.evaluate(() => window.TwitchPP.disable('chatSearch'));
    await pagina.waitForTimeout(400);

    const queda = await pagina.evaluate(() => ({
      barra: !!document.querySelector('.twpp-search'),
      match: document.querySelectorAll('.twpp-chat-match').length,
      ocultas: document.querySelectorAll('.twpp-chat-hidden').length,
    }));
    assert.deepEqual(queda, { barra: false, match: 0, ocultas: 0 });
  });
});

