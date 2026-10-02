/**
 * Arranque compartido de la suite de navegador.
 *
 * Vive aparte para que añadir un fichero de tests no obligue a copiar el
 * `before()`. `node --test` ejecuta cada fichero en su propio proceso, así que
 * cada uno monta su Chromium: lo que se evita es tener el arranque duplicado,
 * no el coste de lanzarlo.
 */
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { chromium } from 'playwright';

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const FIXTURE = resolve(RAIZ, 'test/browser/fixtures/twitch.html');
const BUNDLE = resolve(RAIZ, 'dist/twitch-plus-plus.user.js');

/**
 * El panel se monta en un `<div>` sin atributos con un shadow root abierto
 * (panel.js), colgado del body. `querySelector('*')` no vale porque devuelve
 * el `<html>`, así que se busca el primer nodo cuyo shadow root contenga el
 * botón. El ayudante se inyecta una vez y se reutiliza desde los tests.
 */
const AYUDANTE = () => {
  const host = [...document.querySelectorAll('*')].find((n) => n.shadowRoot?.querySelector('.fab'));
  window.__twpp = { shadow: host?.shadowRoot ?? null, host: host ?? null };
};

/** Devuelve `{ page, errores }` con la página ya cargada y el script arrancado. */
export async function arrancar() {
  const fixture = readFileSync(FIXTURE, 'utf8');
  const bundle = readFileSync(BUNDLE, 'utf8');

  const browser = await chromium.launch();
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
    // copias de la fixture.
    if (ruta.request().resourceType() !== 'document') {
      return ruta.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
    }
    return ruta.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: fixture });
  });
  // El bundle lo carga el propio fixture con un <script> normal, en el
  // <head>. Con `addInitScript` se ejecutaría antes de que exista ningún nodo
  // del documento, y entonces document.head y document.documentElement son
  // los dos null y el script aborta al construir sus estilos. Hay una nota
  // sobre esto en la fixture.
  await context.route('**/bundle.js', (ruta) =>
    ruta.fulfill({ status: 200, contentType: 'text/javascript; charset=utf-8', body: bundle }),
  );

  // El scheduler sale por `if (running || document.hidden) return`, así que si
  // la página llegara a estar oculta no correría ni un tick y toda feature con
  // `interval` parecería rota sin estarlo. Hoy Chromium headless ya reporta
  // visible, pero el test `el scheduler avanza` vigila que siga siendo así y
  // avisa con un número en vez de dejar tests que pasan por la razón equivocada.
  await context.addInitScript(() => {
    Object.defineProperty(document, 'hidden', { get: () => false, configurable: true });
    Object.defineProperty(document, 'visibilityState', { get: () => 'visible', configurable: true });
  });

  const page = await context.newPage();
  const errores = [];
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
  await page.waitForFunction(
    () => {
      const raiz = document.body || document.documentElement;
      if (!raiz) return false;
      return [...raiz.querySelectorAll('*')].some((n) => n.shadowRoot?.querySelector('.fab'));
    },
    { timeout: 8000 },
  );
  await page.evaluate(AYUDANTE);

  return {
    page,
    errores,
    cerrar: () => browser.close(),
  };
}

/** `true` si el elemento existe y tiene `display: none`. `'NO EXISTE'` si no está. */
export function estaOculto(pagina, selector) {
  return pagina.evaluate((sel) => {
    const el = document.querySelector(sel);
    if (!el) return 'NO EXISTE';
    return getComputedStyle(el).display === 'none';
  }, selector);
}