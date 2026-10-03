/**
 * Registro y ciclo de vida de features.
 *
 * Cada feature es un objeto declarativo; el registry se encarga de:
 *  - declarar la clave en el store (con default y tipo bool)
 *  - activar/desactivar (clase CSS en <html> + hooks)
 *  - ejecutarla en el scheduler respetando su `interval`
 *  - aislar errores: una feature rota se apaga sola tras varios fallos seguidos
 */
import { emit } from './bus.js';
import { log, track, warn } from './log.js';
import { declare, get as storeGet, set as storeSet } from './store.js';

export const SECTIONS = [
  { id: 'visual', title: 'Visual' },
  { id: 'clean', title: 'Limpieza' },
  { id: 'sidebar', title: 'Sidebar' },
  { id: 'chat', title: 'Chat' },
  { id: 'auto', title: 'Automatización' },
  { id: 'advanced', title: 'Avanzado' },
];

const features = [];
const byId = new Map();
const failures = new Map();
const lastRun = new Map();
const guards = new Map();
const MAX_FAILURES = 3;

function scopeClass(id) {
  return `twpp-${id}`;
}

/**
 * `when()` permite que una feature esté activa solo bajo una condición (por
 * ejemplo, OLED solo con el tema oscuro de Twitch). Si el resultado cambia, la
 * feature se (des)aplica sola sin tocar la config del usuario.
 */
function allowed(feature) {
  if (typeof feature.when !== 'function') return true;
  try {
    return !!feature.when();
  } catch (error) {
    track(`when:${feature.id}`, error);
    return false;
  }
}

export function defineFeature(spec) {
  if (!spec || !spec.id) throw new Error('Feature sin id');
  if (byId.has(spec.id)) throw new Error(`Feature duplicada: ${spec.id}`);
  const section = SECTIONS.some((s) => s.id === spec.section) ? spec.section : 'advanced';
  const feature = { interval: 0, default: false, ...spec, section };
  byId.set(feature.id, feature);
  features.push(feature);
  declare(feature.id, 'bool', !!feature.default);
  for (const setting of feature.settings || []) {
    declare(setting.key, setting.type || 'string', setting.default ?? '');
  }
  return feature;
}

export function all() {
  return features;
}

export function get(id) {
  return byId.get(id) || null;
}

export function isEnabled(id) {
  return !!storeGet(id);
}

export function apply(id) {
  const feature = byId.get(id);
  if (!feature) return;
  const enabled = !!storeGet(id);
  const on = enabled && allowed(feature);
  const wasOn = document.documentElement.classList.contains(scopeClass(id));
  document.documentElement.classList.toggle(scopeClass(id), on);
  if (on) {
    // el contador de fallos se reinicia al (re)activar, no al apagar
    failures.delete(id);
    lastRun.delete(id);
  }
  try {
    if (on && !wasOn && feature.onEnable) feature.onEnable();
    if (!on && wasOn && feature.onDisable) feature.onDisable();
  } catch (error) {
    track(`enable:${id}`, error);
  }
  emit('feature:toggled', { id, on, enabled });
}

export function applyAll() {
  for (const feature of features) apply(feature.id);
}

/** `true` si la feature está habilitada y su condición se cumple. */
export function isActive(id) {
  const feature = byId.get(id);
  return !!feature && !!storeGet(id) && allowed(feature);
}

function fail(feature, error) {
  const count = (failures.get(feature.id) || 0) + 1;
  failures.set(feature.id, count);
  track(`tick:${feature.id}`, error);
  if (count >= MAX_FAILURES && isEnabled(feature.id)) {
    storeSet(feature.id, false);
    apply(feature.id);
    warn(`feature "${feature.id}" desactivada tras ${count} errores seguidos`);
    emit('feature:disabled', { id: feature.id, reason: 'errores' });
  }
}

export function tickAll(now = Date.now(), { force = false } = {}) {
  for (const feature of features) {
    if (!storeGet(feature.id)) continue;
    if (typeof feature.when === 'function') {
      const state = allowed(feature);
      if (guards.get(feature.id) !== state) {
        guards.set(feature.id, state);
        apply(feature.id);
      }
      if (!state) continue;
    }
    if (!feature.tick) continue;
    const last = lastRun.get(feature.id);
    if (!force && feature.interval && last !== undefined && now - last < feature.interval) continue;
    lastRun.set(feature.id, now);
    try {
      feature.tick(now);
      failures.delete(feature.id);
    } catch (error) {
      fail(feature, error);
    }
  }
}

export function onRouteAll(route) {
  for (const feature of features) {
    if (!feature.onRoute) continue;
    if (!storeGet(feature.id)) continue;
    try {
      feature.onRoute(route);
    } catch (error) {
      track(`route:${feature.id}`, error);
    }
  }
}

export function disableAll() {
  for (const feature of features) {
    storeSet(feature.id, false);
    apply(feature.id);
  }
  log('todas las features desactivadas');
}

export function statuses() {
  return features.map((feature) => ({
    id: feature.id,
    section: feature.section,
    enabled: !!storeGet(feature.id),
    active: isActive(feature.id),
    blocked: typeof feature.when === 'function' && !allowed(feature),
    remote: !!feature.remote,
    failures: failures.get(feature.id) || 0,
    motivo: reasons.get(feature.id) || '',
  }));
}

export function sectionOf(id) {
  return byId.get(id)?.section || 'advanced';
}

export function failureCount(id) {
  return failures.get(id) || 0;
}

/* ------------------------------------------------------------------ *
 * Motivo de inactividad.
 *
 * `failures` cuenta excepciones: la feature se rompió. Esto es otra cosa, la
 * feature esta activa, no ha petado y aun asi no ha hecho su trabajo. Sin esto
 * los dos casos se ven igual desde fuera, que es como se colaron #102 y #109.
 * ------------------------------------------------------------------ */

const reasons = new Map();

/** Anota por que una feature activa no esta haciendo nada ahora mismo. */
export function anotarMotivo(id, motivo) {
  reasons.set(id, String(motivo).slice(0, 120));
}

/** Lo llama la feature cuando por fin hace su trabajo. */
export function limpiarMotivo(id) {
  reasons.delete(id);
}

export function motivoDe(id) {
  return reasons.get(id) || '';
}

/** `{ id, motivo }` de las features activas que no estan haciendo nada. */
export function motivos() {
  return [...reasons].map(([id, motivo]) => ({ id, motivo }));
}
