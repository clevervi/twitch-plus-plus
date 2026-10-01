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
const MIN_RUN_GAP = 200;

let timer = null;
let observer = null;
let queued = false;
let running = false;
let lastRunTime = 0;

function run() {
  if (running || document.hidden) return;
  const now = Date.now();
  if (now - lastRunTime < MIN_RUN_GAP) return;
  lastRunTime = now;
  running = true;
  try {
    tickAll(now);
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

const observedTargets = new WeakSet();

function attachTargets() {
  if (!observer || typeof document === 'undefined') return;
  const targets = [
    document.querySelector('[data-a-target="side-nav-bar"]'),
    document.querySelector('[data-a-target="video-player"]'),
    document.querySelector('[data-a-target="chat-room-component-layout"]'),
  ].filter(Boolean);

  for (const target of targets) {
    if (!observedTargets.has(target)) {
      observedTargets.add(target);
      observer.observe(target, { childList: true, subtree: true });
    }
  }
}

function observe() {
  if (observer || typeof MutationObserver !== 'function') return;
  const signal = throttle(() => {
    attachTargets();
    request();
  }, 400);
  observer = new MutationObserver(signal);
  attachTargets();
  if (document.body) {
    observer.observe(document.body, { childList: true, subtree: false });
  }
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

export const scheduleRoute = debounce(() => {
  attachTargets();
  request();
}, 120);

export function isRunning() {
  return !!timer;
}
