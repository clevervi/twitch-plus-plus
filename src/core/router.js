/** Detección de navegación SPA (Twitch no recarga la página al cambiar de canal). */
import { emit } from './bus.js';
import { log } from './log.js';
import { getValue, setValue } from './gm.js';

const CLAVE = 'nav.log';
const MAX = 30;

let routeSeq = 0;
let bound = false;
let lastRoute = null;

/**
 * Historial de navegacion, para averiguar que hace Twitch cuando nos saca de
 * donde estamos. Vive en memoria y solo se escribe al almacenamiento cuando la
 * pagina se va, que es justo cuando hay que conservarlo: si no, un salto con
 * recarga se llevaria por delante la evidencia.
 */
let entradas = [];
let salida = null;

function cargar() {
  const guardado = getValue(CLAVE, null);
  if (!guardado) return;
  if (Array.isArray(guardado.entradas)) entradas = guardado.entradas.slice(-MAX);
  if (guardado.salida) salida = guardado.salida;
}

/** Ultimo estado conocido: las rutas y, si hubo recarga, de donde salimos. */
export function navegacion() {
  return {
    entradas: [...entradas],
    salida,
    actual: lastRoute ? { path: lastRoute.path, canal: lastRoute.channel } : null,
  };
}

export function currentRoute(razon = 'navigation') {
  const path = typeof location !== 'undefined' ? location.pathname : '/';
  const channel = (path.match(/^\/([^/]+)/) || [])[1] || '';
  const now = Date.now();
  const route = {
    seq: ++routeSeq,
    path,
    channel,
    canal: channel,
    anterior: lastRoute ? lastRoute.channel : null,
    tiempoVisible: lastRoute ? now - lastRoute.at : 0,
    razon,
    at: now,
  };
  lastRoute = route;
  return route;
}

function notify(razon = 'navigation') {
  const route = currentRoute(razon);
  entradas.push({ seq: route.seq, path: route.path, razon, at: route.at });
  if (entradas.length > MAX) entradas = entradas.slice(-MAX);
  log('ruta:', route.path);
  emit('route', route);
  if (typeof window !== 'undefined' && window.dispatchEvent) {
    window.dispatchEvent(new CustomEvent('twpp:route', { detail: route }));
  }
}

function patch(type) {
  if (typeof history === 'undefined') return;
  const original = history[type];
  if (typeof original !== 'function') return;
  history[type] = function patched(...args) {
    const result = original.apply(this, args);
    notify(type);
    return result;
  };
}

/**
 * Al irse la pagina se guarda de donde salimos. Si luego el script arranca
 * otra vez en otro canal, la comparacion de las dos rutas dice si Twitch
 * recarga la pagina o solo cambia la ruta.
 */
function alSalir() {
  salida = {
    path: lastRoute ? lastRoute.path : null,
    canal: lastRoute ? lastRoute.channel : null,
    at: Date.now(),
  };
  setValue(CLAVE, { entradas, salida });
}

export function start() {
  if (bound) return;
  bound = true;
  cargar();
  patch('pushState');
  patch('replaceState');
  if (typeof window !== 'undefined' && window.addEventListener) {
    window.addEventListener('popstate', () => notify('popstate'));
    window.addEventListener('hashchange', () => notify('hashchange'));
    window.addEventListener('pagehide', alSalir);
  }
  notify('initial');
}
