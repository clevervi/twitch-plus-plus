/**
 * Scheduler: un único latido en vez de un bucle agresivo por feature.
 * Se despierta por eventos (mutaciones, cambio de ruta, visibilidad) y cada
 * feature decide su frecuencia con `interval`. Se detiene con la pestaña oculta.
 */
import { debounce, onIdle, throttle } from './dom.js';
import { log, track } from './log.js';
import { contar, registrarTick } from './perf.js';
import { tickAll } from './registry.js';
import { emit } from './bus.js';

const HEARTBEAT = 400;
const MIN_RUN_GAP = 200;

let timer = null;
let observer = null;
let queued = false;
let running = false;
let lastRunTime = 0;

const tareas = new Set();

/**
 * Tarea periódica que no pertenece a ninguna feature (por ejemplo, reconciliar
 * la UI con un botón nativo de Twitch). Se ejecuta con el mismo latido y se
 * detiene con la pestaña oculta, sin sumar otro `setInterval`. Devuelve la
 * funcion para darla de baja.
 */
export function every(intervalo, fn) {
  const tarea = { intervalo: Math.max(100, Number(intervalo) || 1000), fn, ultima: 0 };
  tareas.add(tarea);
  return () => tareas.delete(tarea);
}

function runTasks(now) {
  for (const tarea of tareas) {
    if (now - tarea.ultima < tarea.intervalo) continue;
    tarea.ultima = now;
    try {
      tarea.fn(now);
    } catch (error) {
      track('scheduler:task', error);
    }
  }
}

function run() {
  if (running || document.hidden) return;
  const now = Date.now();
  if (now - lastRunTime < MIN_RUN_GAP) return;
  lastRunTime = now;
  running = true;
  try {
    registrarTick();
    tickAll(now);
    runTasks(now);
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

// Los nodos observados se recuerdan para no registrar el mismo target dos
// veces. Tiene que ser un Set y no un WeakSet: al parar (pestaña oculta) el
// observer se destruye, y un WeakSet no se puede vaciar, así que al volver los
// nodos seguían "vistos" y el nuevo observer no observaba ninguno.
let observedTargets = new Set();

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
    contar('mutaciones');
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
  observedTargets.clear();
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
