/** Detección de navegación SPA (Twitch no recarga la página al cambiar de canal). */
import { emit } from './bus.js';
import { log } from './log.js';

let routeSeq = 0;
let bound = false;
let lastRoute = null;

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

export function start() {
  if (bound) return;
  bound = true;
  patch('pushState');
  patch('replaceState');
  if (typeof window !== 'undefined' && window.addEventListener) {
    window.addEventListener('popstate', () => notify('popstate'));
    window.addEventListener('hashchange', () => notify('hashchange'));
  }
  notify('initial');
}
