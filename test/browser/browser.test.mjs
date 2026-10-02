/**
 * Suite de navegador.
 *
 *Va aparte de `node --test` a propósito: `npm run verify` tiene que seguir
 * funcionando sin `npm install` y en segundos. Esto necesita navegadores.
 *
 *   npm run test:browser
 *
 * Lo que se comprueba aquí es lo que `tools/dom-stub.mjs` no puede: estilos
 * computados, medidas, `pointer-events` y stacking real.
 */
import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { chromium } from 'playwright';

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const FIXTURE = resolve(RAIZ, 'test/browser/fixtures/twitch.html');
const BUNDLE = resolve(RAIZ, 'dist/twitch-plus-plus.user.js');

let browser;
let page;
let errores = [];

before(async () => {
  const fixture = readFileSync(FIXTURE, 'utf8');
  const bundle = readFileSync(BUNDLE, 'utf8');

  browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1400, height: 900 } });

  // El bundle aborta si el host no es twitch.tv (app.js:62). Esa comprobación es
  // correcta en producción y aquí no se relaja. Se resuelve con un proxy de
  // Playwright: el navegador navega a twitch.tv de verdad y todas las
  // peticiones se sirven desde la fixture, así que el script ve el host que
  // espera sin que haya que tocar su código ni pedir el DNS de twitch.tv.
  await context.route('**/*', (ruta) => {
    const url = ruta.request().url();
    if (url.startsWith('data:') || url.startsWith('about:') || url.startsWith('blob:')) return ruta.abort();
    // Solo el documento principal devuelve la fixture. Cualquier otra cosa
    // (el catálogo remoto, imágenes) responde vacío: si se sirviera el HTML
    // para todo, el bundle se leería a sí mismo y la página se llenaría de
    // copias del fixture.
    if (ruta.request().resourceType() !== 'document') {
      return ruta.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
    }
    return ruta.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: fixture });
  });
  // El bundle lo carga el propio fixture con un <script> normal, en el
  // <head>. Con `addInitScript` se ejecutaría antes de que exista ningún nodo
  // del documento, y entonces document.head y document.documentElement son
  // los dos null y el script aborta al construir sus estilos. Hay una nota
  // sobre esto en el fixture.
  await context.route('**/bundle.js', (ruta) => ruta.fulfill({ status: 200, contentType: 'text/javascript; charset=utf-8', body: bundle }));

  // El scheduler sale por `if (running || document.hidden) return`, así que si
  // la página llegara a estar oculta no correría ni un tick y toda feature con
  // `interval` parecería rota sin estarlo. Hoy Chromium headless ya reporta
  // visible, pero el test `el scheduler avanza` vigila que siga siendo así y
  // avisa con un número en vez de dejar tests que pasan por la razón equivocada.
  await context.addInitScript(() => {
    Object.defineProperty(document, 'hidden', { get: () => false, configurable: true });
    Object.defineProperty(document, 'visibilityState', { get: () => 'visible', configurable: true });
  });

  page = await context.newPage();
  page.on('pageerror', (error) => errores.push(String(error)));
  await page.goto('https://www.twitch.tv/');
  // Con `@run-at document-start` el script corre antes de que exista el DOM.
  // Se espera a lo que la suite necesita de verdad, en vez de dormir un rato y
  // confiar: la sidebar, el panel montado y el player presente.
  // `attached` y no `visible`: la fixture es un esqueleto sin estilos reales
  // de Twitch, así que algunos contenedores tienen tamaño cero y la espera
  // por visibilidad nunca se cumpliría. Lo que importa es que estén en el DOM.
  await page.waitForSelector('[data-a-target="side-nav-bar"]', { state: 'attached' });
  await page.waitForSelector('[data-a-target="video-player"]', { state: 'attached' });
  await page.waitForFunction(() => {
    const raiz = document.body || document.documentElement;
    if (!raiz) return false;
    return [...raiz.querySelectorAll('*')].some((n) => n.shadowRoot?.querySelector('.fab'));
  }, { timeout: 8000 });
  await page.evaluate(AYUDANTE);
});

after(async () => {
  await browser?.close();
});

/**
 * El panel se monta en un `<div>` sin atributos con un shadow root abierto
 * (panel.js), colgado del body. `querySelector('*')` no vale porque devuelve
 * el `<html>`, así que se busca el primer nodo cuyo shadow root contenga el
 * botón. El ayudante se inyecta una vez y se reutiliza desde los tests.
 */
const AYUDANTE = () => {
  // El panel se cuelga de body o documentElement (panel.js), y con
  // document-start puede no existir body todavía. Se espera a que haya.
  const raiz = document.body || document.documentElement;
  if (!raiz) {
    window.__twpp = { shadow: null, host: null };
    return;
  }
  const host = [...raiz.querySelectorAll('*')].find((nodo) => nodo.shadowRoot?.querySelector('.fab'));
  window.__twpp = { shadow: host?.shadowRoot ?? null, host: host ?? null };
};

async function enElPanel(fn, arg) {
  return page.evaluate(({ cuerpo, valor }) => {
    const { shadow } = window.__twpp || {};
    if (!shadow) return null;
    // eslint-disable-next-line no-new-func
    return new Function('shadow', 'arg', `return (${cuerpo})(shadow, arg);`)(shadow, valor);
  }, { cuerpo: fn, arg });
}

async function estilosFab() {
  return enElPanel(`(shadow) => {
    const boton = shadow.querySelector('.fab');
    if (!boton) return null;
    const cs = getComputedStyle(boton);
    const rect = boton.getBoundingClientRect();
    return {
      opacity: Number.parseFloat(cs.opacity),
      pointerEvents: cs.pointerEvents,
      display: cs.display,
      visibility: cs.visibility,
      width: rect.width,
      height: rect.height,
      visible: rect.width > 0 && rect.height > 0,
    };
  }`);
}

const contarBadges = () => page.evaluate(() => document.querySelectorAll('.twpp-viewer-badge').length);

describe('el harness ejecuta de verdad lo que dice ejecutar', () => {
  // Estos tres tests no comprueban el script: comprueban que el entorno de
  // pruebas sirve para comprobar el script. Sin ellos, una feature que no hace
  // nada por falta de un ancla en el DOM pasa igual que una feature correcta.
  it('el scheduler avanza', async () => {
    const antes = await page.evaluate(() => window.TwitchPP.diagnostics.perf().ticks);
    await page.waitForTimeout(1200);
    const despues = await page.evaluate(() => window.TwitchPP.diagnostics.perf().ticks);
    assert.ok(despues > antes, `los ticks deben avanzar (antes ${antes}, despues ${despues})`);
  });

  it('la pagina no esta oculta', async () => {
    const oculto = await page.evaluate(() => document.hidden);
    assert.equal(oculto, false, 'con document.hidden en true el scheduler no ejecuta nada');
  });

  it('la fixture da lo que necesitan las features de chat', async () => {
    const listo = await page.evaluate(() => ({
      cabecera: !!document.querySelector('[data-a-target="animated-channel-viewers-count"]'),
      menuConAlt: !!document.querySelector('[data-a-target="user-menu-button"] img[alt]'),
      lineasChat: document.querySelectorAll('[data-a-target="chat-line-message"]').length,
      conMencia: [...document.querySelectorAll('[data-a-target="chat-line-message"]')].filter((l) =>
        /@darkt/.test(l.textContent),
      ).length,
    }));
    assert.ok(listo.cabecera, 'sin contador de viewers, viewer-analytics no inserta nada');
    assert.ok(listo.menuConAlt, 'sin img.alt, currentUsername() devuelve null y las menciones no funcionan');
    assert.ok(listo.lineasChat >= 3, 'hacen falta lineas de chat para probar');
    assert.ok(listo.conMencia >= 1, 'hace falta al menos una linea que sea mencion');
  });
});

describe('ninguna feature deja restos al apagarse', () => {
  /**
   * Cualquier marca que el script ponga en el DOM con nombre `twpp-*` o
   * `data-twpp-*`. Cuando una feature se apaga, no puede quedar ninguna.
   *
   * Esto no es un test de una feature concreta: es la red que cubre toda la
   * familia de fallos «el estado se marca en un sitio y se limpia en otro»,
   * que han sido tres de los cinco bugs encontrados en la auditoría.
   */
  const marcasQueQuedan = () =>
    page.evaluate(() => {
      const found = [];
      for (const el of document.querySelectorAll('*')) {
        for (const clase of el.classList || []) {
          if (clase.startsWith('twpp-')) found.push(`clase ${clase} en <${el.tagName.toLowerCase()}>`);
        }
        for (const attr of el.getAttributeNames()) {
          if (attr.startsWith('data-twpp')) found.push(`atributo ${attr} en <${el.tagName.toLowerCase()}>`);
        }
      }
      return {
        found,
        scopeHtml: document.documentElement.className,
        declaracionesHtml: [...document.documentElement.style].map(
          (prop) => `${prop}=${document.documentElement.style.getPropertyValue(prop)}`,
        ),
      };
    });

  const todasLasFeatures = () => page.evaluate(() => window.TwitchPP.diagnostics.features().map((f) => f.id));

  const ponerTodas = (accion) =>
    page.evaluate((acc) => {
      const f = window.TwitchPP;
      window.TwitchPP.diagnostics.features().forEach((x) => f[acc](x.id));
    }, accion);

  it('encender y apagar del todo no deja ni una marca', async () => {
    const ids = await todasLasFeatures();
    assert.ok(ids.length >= 15, `se esperaban todas las features, hay ${ids.length}`);

    await ponerTodas('enable');
    await page.waitForTimeout(2000);
    const encendidas = await marcasQueQuedan();
    assert.ok(encendidas.found.length > 0, 'con las features encendidas tiene que haber marcas: si no, el test no comprueba nada');

    await ponerTodas('disable');
    await page.waitForTimeout(2500);

    const apagadas = await marcasQueQuedan();
    assert.deepEqual(apagadas.found, [], `marcas sin limpiar: ${apagadas.found.join(', ')}`);
    assert.equal(apagadas.scopeHtml, '', 'las clases de scope del <html> deben desaparecer');
    // Se mira el estilo *declarado*, no el atributo: removeProperty() deja un
    // `style=""` vacío detrás, que es ruido del navegador y no del script.
    // `sidebarCompact` es la única que escribe aquí (`--twpp-sidebar-width`).
    assert.deepEqual(apagadas.declaracionesHtml, [], `variables CSS sin limpiar: ${apagadas.declaracionesHtml.join(', ')}`);
  });

  it('apagar enseguida tampoco deja marcas: ningun temporizador puede revivir', async () => {
    // Este es el escenario que pilla los setTimeout sin handle guardado. El
    // primero espera 2 s antes de apagar, y ahí el temporizador ya ha disparado
    // y su efecto lo limpia teardown(): el bug no se ve.
    await ponerTodas('enable');
    await page.waitForTimeout(50); // dentro de la ventana de viewer-analytics (400 ms)
    await ponerTodas('disable');
    await page.waitForTimeout(2000);

    const restos = await marcasQueQuedan();
    assert.deepEqual(
      restos.found,
      [],
      `un temporizador revivio la feature tras apagarla: ${restos.found.join(', ')}`,
    );
  });
});

describe('mention-highlight marca menciones y limpia al apagar', () => {
  const lineaDe = (indice) =>
    page.evaluate((i) => {
      const l = document.querySelectorAll('[data-a-target="chat-line-message"]')[i];
      return {
        texto: l.textContent.trim(),
        attr: l.hasAttribute('data-twpp-mention'),
        clase: l.classList.contains('twpp-mention'),
      };
    }, indice);

  it('resalta la linea con mencion y no las otras', async () => {
    await page.evaluate(() => window.TwitchPP.enable('mentionHighlight'));
    await page.waitForTimeout(1200);

    const conMencion = await lineaDe(2);
    assert.match(conMencion.texto, /@darkt/, 'la linea 2 de la fixture es una mencion');
    assert.equal(conMencion.clase, true, 'una mencion debe quedar resaltada');

    const sinMencion = await lineaDe(0);
    assert.doesNotMatch(sinMencion.texto, /@darkt/);
    assert.equal(sinMencion.clase, false, 'una linea corriente no debe resaltarse');
  });

  it('apagar quita el atributo de TODAS las lineas, no solo de las resaltadas', async () => {
    await page.evaluate(() => window.TwitchPP.enable('mentionHighlight'));
    await page.waitForTimeout(1000);

    const antes = await page.evaluate(
      () => document.querySelectorAll('[data-a-target="chat-line-message"][data-twpp-mention]').length,
    );
    assert.ok(antes >= 3, `sweep() marca todas las lineas, no solo las que casa (habia ${antes})`);

    await page.evaluate(() => window.TwitchPP.disable('mentionHighlight'));

    const despues = await page.evaluate(() => ({
      attr: document.querySelectorAll('[data-twpp-mention]').length,
      clase: document.querySelectorAll('.twpp-mention').length,
    }));
    // Con clear() buscando solo `.twpp-mention` quedaban atributos sin limpiar,
    // y esas lineas ya no se reevaluaban nunca al reactivar.
    assert.deepEqual(despues, { attr: 0, clase: 0 }, 'no puede quedar ni un atributo sin limpiar');
  });
});

describe('viewer-analytics no deja el badge huerfano al apagarla', () => {
  it('apagarla despues de 1 s no deja nada', async () => {
    await page.evaluate(() => window.TwitchPP.enable('viewerAnalytics'));
    await page.waitForTimeout(900);
    assert.equal(await contarBadges(), 1, 'con la feature activa hay un badge');

    await page.evaluate(() => window.TwitchPP.disable('viewerAnalytics'));
    assert.equal(await contarBadges(), 0, 'teardown lo quita en el acto');
    await page.waitForTimeout(700);
    assert.equal(await contarBadges(), 0, 'y no reaparece');
  });

  it('apagarla dentro de los 400 ms cancela el temporizador', async () => {
    await page.evaluate(() => window.TwitchPP.enable('viewerAnalytics'));
    // 50 ms: el setTimeout de 400 ms de onEnable sigue pendiente.
    await page.waitForTimeout(50);
    await page.evaluate(() => window.TwitchPP.disable('viewerAnalytics'));
    assert.equal(await contarBadges(), 0, 'todavia no hay nada');

    // Sin el clearTimeout, update() dispara aqui y ensureBadge() reinserta el
    // badge con la feature apagada. Reproducido en Chromium: 1 badge huerfano.
    await page.waitForTimeout(800);
    assert.equal(await contarBadges(), 0, 'el temporador no puede recrear el badge tras apagar');
  });
});

describe('el boton flotante se ve y se puede pulsar', () => {
  it('el panel monta un shadow root con el boton dentro', async () => {
    const estilos = await estilosFab();
    assert.ok(estilos, 'debe existir un shadow root con .fab');
  });

  it('tiene tamano real, no esta colapsado a cero', async () => {
    const e = await estilosFab();
    assert.equal(e.visible, true, `tamano ${e.width}x${e.height}`);
    assert.ok(e.width >= 20 && e.height >= 20, `se esperaba al menos 20x20, hay ${e.width}x${e.height}`);
  });

  it('no esta en display:none ni visibility:hidden', async () => {
    const e = await estilosFab();
    assert.notEqual(e.display, 'none', 'display: none lo saca de la pantalla');
    assert.notEqual(e.visibility, 'hidden', 'visibility: hidden lo saca de la pantalla');
  });

  it('tiene opacidad suficiente para verse', async () => {
    // Esta es la regresion que costó el bug del boton invisible: opacity 0 con
    // pointer-events none. Se comprueba el valor COMPUTADO, no la cadena CSS.
    const e = await estilosFab();
    assert.ok(e.opacity >= 0.25, `opacidad computada ${e.opacity}, se esperaba >= 0.25`);
  });

  it('acepta el raton sin tener que acertar en el boton', async () => {
    const e = await estilosFab();
    assert.notEqual(e.pointerEvents, 'none', 'con pointer-events: none no se puede pulsar');
  });

  it('un clic real en el boton abre el panel', async () => {
    const abierto = await enElPanel(`(shadow) => {
      const boton = shadow.querySelector('.fab');
      if (!boton) return 'sin boton';
      boton.click();
      const panel = shadow.querySelector('.panel');
      return Boolean(panel && !panel.hidden);
    }`);
    assert.equal(abierto, true, 'el clic deberia abrir el panel');
  });
});

describe('la pagina de mentira engancha los selectores clave', () => {
  const claves = ['chat.container', 'chat.line', 'chat.username', 'chat.input', 'sideNav.root', 'sideNav.card', 'sideNav.group', 'player'];

  for (const clave of claves) {
    it(`${clave} resuelve contra la fixture`, async () => {
      const ok = await page.evaluate((k) => {
        const entrada = window.TwitchPP?.diagnostics?.selectors?.();
        const fila = entrada?.find((r) => r.key === k);
        return fila ? fila.ok : null;
      }, clave);
      assert.equal(ok, true, `${clave} deberia resolver en la fixture`);
    });
  }
});

describe('el script no lanza errores en la fixture', () => {
  it('ningun error de pagina', () => {
    assert.deepEqual(errores, [], `errores: ${errores.join(' | ')}`);
  });
});
