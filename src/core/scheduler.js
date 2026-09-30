/**
 * Scheduler: un único latido en vez de un bucle agresivo por feature.
 * Se despierta por eventos (mutaciones, cambio de ruta, visibilidad) y cada
 * feature decide su frecuencia con `interval`. Se detiene con la pestaña oculta.
 */
import { debounce, onIdle, throttle } from './dom.js';
import { log } from './log.js';
import { tickAll } from './registry.js';
import { emit } from './bus.js';

const HEARTBEAT = 400;

let timer = null;
let observer = null;
let queued = false;
let running = false;

function run() {
  if (running || document.hidden) return;
  running = true;
  try {
    tickAll(Date.now());
  } finally {
    running = false;
  }
}

export function request() {
  if (queued) return;
  queued = true;
  onIdle(() => {
    queued = false;
    run();
  });
}

function observe() {
  if (observer || typeof MutationObserver !== 'function') return;
  const signal = throttle(() => request(), 400);
  observer = new MutationObserver(signal);
  
  // Observar áreas específicas sin profundidad extrema
  const targets = [
    document.querySelector('[data-a-target="side-nav-bar"]'),
    document.querySelector('[data-a-target="video-player"]'),
    document.querySelector('[data-a-target="chat-room-component-layout"]'),
  ].filter(Boolean);
  
  // Observar estos con subtree limitado
  for (const target of targets) {
    observer.observe(target, { childList: true, subtree: true });
  }
  
  // Observar body solo para detectar si se recrea algún contenedor principal
  observer.observe(document.body, { childList: true, subtree: false });
}

export function start() {
  if (timer) return;
  observe();
  timer = setInterval(run, HEARTBEAT);
  document.addEventListener('visibilitychange', onVisibility);
  request();
  log('scheduler iniciado');
}

export function stop() {
  clearInterval(timer);
  timer = null;
  observer?.disconnect();
  observer = null;
}

function onVisibility() {
  if (document.hidden) {
    stop();
    return;
  }
  start();
  request();
  emit('scheduler:resumed');
}

export function kick() {
  request();
}

export const scheduleRoute = debounce(() => request(), 120);

export function isRunning() {
  return !!timer;
}
