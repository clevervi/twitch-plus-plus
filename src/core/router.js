/** Detección de navegación SPA (Twitch no recarga la página al cambiar de canal). */
import { emit } from './bus.js';
import { log } from './log.js';

let routeSeq = 0;
let bound = false;

function currentRoute() {
  return {
    seq: ++routeSeq,
    path: location.pathname,
    channel: (location.pathname.match(/^\/([^/]+)/) || [])[1] || '',
    at: Date.now(),
  };
}

function notify() {
  const route = currentRoute();
  log('ruta:', route.path);
  emit('route', route);
  window.dispatchEvent(new CustomEvent('twpp:route', { detail: route }));
}

function patch(type) {
  const original = history[type];
  if (typeof original !== 'function') return;
  history[type] = function patched(...args) {
    const result = original.apply(this, args);
    notify();
    return result;
  };
}

export function start() {
  if (bound) return;
  bound = true;
  patch('pushState');
  patch('replaceState');
  window.addEventListener('popstate', notify);
  window.addEventListener('hashchange', notify);
  emit('route', currentRoute());
}
