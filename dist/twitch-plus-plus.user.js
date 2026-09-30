// ==UserScript==
// @name         Twitch++
// @namespace    https://github.com/clevervi
// @version      2.2.0
// @description  Twitch limpio, modular y autoactualizable: OLED, sidebar, chat, analítica de viewers, auto Channel Points y pausa de chat.
// @author       clevervi
// @license      MIT
// @homepageURL  https://github.com/clevervi/twitch-plus-plus/blob/main/README.md
// @supportURL   https://github.com/clevervi/twitch-plus-plus/issues
// @downloadURL  https://raw.githubusercontent.com/clevervi/twitch-plus-plus/main/dist/twitch-plus-plus.user.js
// @updateURL    https://raw.githubusercontent.com/clevervi/twitch-plus-plus/main/dist/latest.json
// @icon         data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'><rect width='32' height='32' rx='8' fill='%239147ff'/><text x='16' y='23' text-anchor='middle' font-family='sans-serif' font-size='17' font-weight='700' fill='%23ffffff'>%2B%2B</text></svg>
// @match        https://*.twitch.tv/*
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_xmlhttpRequest
// @grant        GM_openInTab
// @grant        GM_info
// @connect      raw.githubusercontent.com
// @run-at       document-start
// @noframes
// ==/UserScript==

(function () {
'use strict';
/* Twitch++ — bundle generado por scripts/build.mjs. No editar a mano. */

/* ---- src/core/bus.js ---- */
const __m0 = (function () {
/** Bus mínimo de eventos internos (sin dependencias). */
const handlers = new Map();

function on(event, fn) {
  if (!handlers.has(event)) handlers.set(event, new Set());
  handlers.get(event).add(fn);
  return () => off(event, fn);
}

function off(event, fn) {
  handlers.get(event)?.delete(fn);
}

function emit(event, payload) {
  const set = handlers.get(event);
  if (!set) return;
  for (const fn of [...set]) {
    try {
      fn(payload);
    } catch {
      /* un listener roto no puede tumpar al resto */
    }
  }
}
return {
  on: on,
  off: off,
  emit: emit,
};
})();

/* ---- src/core/gm.js ---- */
const __m1 = (function () {
/** Adaptador de las APIs GM_* con fallback a localStorage (así el bundle también arranca fuera de Tampermonkey). */

const has = (name) => typeof globalThis[name] === 'function';

const memory = new Map();
const PREFIX = 'twpp:';

function localGet(key) {
  try {
    return globalThis.localStorage ? globalThis.localStorage.getItem(PREFIX + key) : null;
  } catch {
    return null;
  }
}

function localSet(key, value) {
  try {
    if (globalThis.localStorage) globalThis.localStorage.setItem(PREFIX + key, value);
  } catch {
    memory.set(key, value);
  }
}

function getValue(key, fallback) {
  try {
    if (has('GM_getValue')) {
      const value = globalThis.GM_getValue(key, undefined);
      return value === undefined ? fallback : value;
    }
  } catch {
    /* caída a localStorage */
  }
  const raw = localGet(key);
  if (raw === null) return fallback;
  try {
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

function setValue(key, value) {
  try {
    if (has('GM_setValue')) return globalThis.GM_setValue(key, value);
  } catch {
    /* caída a localStorage */
  }
  localSet(key, JSON.stringify(value));
  return value;
}

function deleteValue(key) {
  try {
    if (has('GM_deleteValue')) return globalThis.GM_deleteValue(key);
  } catch {
    /* ignore */
  }
  try {
    globalThis.localStorage && globalThis.localStorage.removeItem(PREFIX + key);
  } catch {
    /* ignore */
  }
}

function openInTab(url) {
  if (has('GM_openInTab')) return globalThis.GM_openInTab(url, { active: true });
  globalThis.open(url, '_blank', 'noopener');
  return null;
}

/** GET JSON con timeout. Devuelve `null` en cualquier fallo (sin lanzar). */
function getJson(url, { timeout = 10000, headers } = {}) {
  return new Promise((resolve) => {
    let settled = false;
    const done = (value) => {
      if (settled) return;
      settled = true;
      resolve(value);
    };

    if (!has('GM_xmlhttpRequest')) {
      fetch(url, { headers })
        .then((res) => (res.ok ? res.json() : null))
        .then(done)
        .catch(() => done(null));
      return;
    }

    globalThis.GM_xmlhttpRequest({
      method: 'GET',
      url,
      timeout,
      headers,
      onload(res) {
        if (!res || res.status < 200 || res.status >= 300) return done(null);
        try {
          done(JSON.parse(res.responseText));
        } catch {
          done(null);
        }
      },
      onerror: () => done(null),
      ontimeout: () => done(null),
    });
  });
}

function managerName() {
  try {
    if (has('GM_info') && globalThis.GM_info) return String(globalThis.GM_info.scriptHandler || 'otro');
  } catch {
    /* ignore */
  }
  return 'desconocido';
}
return {
  getValue: getValue,
  setValue: setValue,
  deleteValue: deleteValue,
  openInTab: openInTab,
  getJson: getJson,
  managerName: managerName,
};
})();

/* ---- src/core/log.js ---- */
const __m2 = (function () {
const NS = 'twpp';
const MAX_REPORTS = 50;

const reports = [];
let debugEnabled = false;

function paint(color) {
  return `color:${color};font-weight:bold`;
}

function fmt(args) {
  return [`%c[${NS}]`, paint('#9147ff'), ...args];
}

function setDebug(value) {
  debugEnabled = !!value;
}

function isDebug() {
  return debugEnabled;
}

function log(...args) {
  if (debugEnabled) console.log(...fmt(args));
}

function warn(...args) {
  console.warn(...fmt(args));
}

function err(...args) {
  console.error(...fmt(args));
}

function track(scope, error) {
  const entry = {
    scope,
    message: String((error && error.message) || error),
    stack: String((error && error.stack) || '').split('\n').slice(0, 4).join('\n'),
    at: new Date().toISOString(),
    url: typeof location !== 'undefined' ? location.pathname : '',
  };
  reports.push(entry);
  if (reports.length > MAX_REPORTS) reports.shift();
  err(scope, error);
  return entry;
}

function trackedErrors() {
  return reports.slice();
}

function clearTrackedErrors() {
  reports.length = 0;
}
return {
  setDebug: setDebug,
  isDebug: isDebug,
  log: log,
  warn: warn,
  err: err,
  track: track,
  trackedErrors: trackedErrors,
  clearTrackedErrors: clearTrackedErrors,
};
})();

/* ---- src/core/selectors.js ---- */
const __m3 = (function () {
const { log: log, warn: warn } = __m2;

/**
 * Registro central de selectores.
 *
 * Cada clave tiene una lista de candidatos: se prueban en orden hasta que uno
 * funciona. El catálogo remoto del repo puede anteponer candidatos nuevos
 * (los fixes de la comunidad entran sin publicar una release del script) y el
 * fallback local sigue funcionando si el repo no responde o algo se rompe.
 */


const BASE = {
  'chat.container': [
    '[data-test-selector="chat-scrollable-area__message-container"]',
    '.chat-scrollable-area__message-container',
  ],
  'chat.line': ['[data-a-target="chat-line-message"]', '.chat-line__message'],
  'chat.username': ['.chat-line__username', '[data-a-target="chat-message-username"]'],
  'chat.input': ['.chat-input__textarea-container textarea', '.chat-input textarea', '[data-a-target="chat-input"] textarea'],
  'sideNav.root': ['[data-a-target="side-nav-bar"]', '.side-nav', '[data-test-selector="side-nav"]'],
  'sideNav.card': ['[data-a-target="side-nav-card"]', '.side-nav-card'],
  'sideNav.group': ['nav .tw-transition-group', '.side-nav__section'],
  'sideNav.more': ['[data-a-target="side-nav-more"]', '.side-nav__more'],
  'sideNav.link': ['[data-a-target="side-nav-link"]', '.side-nav-card__link'],
  'player': ['[data-a-target="video-player"]', '.video-player', '.persistent-player'],
  'topNav': ['[data-a-target="top-nav-container"]', '.top-nav'],
  'viewerCount': [
    'strong[data-a-target="animated-channel-viewers-count"]',
    '[data-test-selector="viewer-count"]',
    '.channel-info-bar__viewers',
  ],
  'channelPoints': [
    '[data-test-selector="community-points-summary"]',
    '.community-points-summary',
    '[data-a-target="community-points-summary"]',
  ],
  'claimBonus': [
    'button[aria-label="Claim Bonus"]',
    '.claimable-bonus__icon',
    '[data-test-selector="claimable-bonus-icon"]',
  ],
  'pauseChat': [
    'button[aria-label="Pause Chat"]',
    'button[aria-label="Pausar chat"]',
    '[data-test-selector="chat-pause-button"]',
  ],
  'upNext': ['[data-a-target="up-next-queue"]', '.up-next-queue', '[data-test-selector="up-next-queue"]'],
  'stories': ['[data-a-target="stories-tray"]', '.stories-tray', '[data-test-selector="stories-tray"]'],
  'userMenu': ['[data-a-target="user-menu-toggle"]', '[data-a-target="user-menu-button"]'],
};

const MAX_CANDIDATES = 8;
const MAX_LENGTH = 300;
const FORBIDDEN = /[{};@]|url\(|expression\(|javascript:|\\|\/\*/i;

const state = new Map();
for (const [key, list] of Object.entries(BASE)) state.set(key, { local: list, remote: [] });

/** Salud por clave: cuál candidato sigue funcionando y cuánto falla. */
const health = new Map();

function list(key) {
  const entry = state.get(key);
  if (!entry) return [];
  return entry.remote.concat(entry.local);
}

function note(key, matched) {
  let entry = health.get(key);
  if (!entry) {
    entry = { hits: 0, misses: 0, ok: null, matched: null, lastHitAt: 0, lastMissAt: 0 };
    health.set(key, entry);
  }
  const hit = !!matched;
  if (entry.ok === hit) {
    if (hit) entry.matched = matched;
    return;
  }
  const now = Date.now();
  if (hit) {
    entry.hits += 1;
    entry.lastHitAt = now;
    entry.matched = matched;
  } else {
    entry.misses += 1;
    entry.lastMissAt = now;
  }
  entry.ok = hit;
}

function candidates(key) {
  return list(key);
}

function select(key, root = document) {
  for (const selector of list(key)) {
    try {
      const found = root.querySelector(selector);
      if (found) {
        note(key, selector);
        return found;
      }
    } catch {
      /* candidato inválido: se ignora */
    }
  }
  note(key, null);
  return null;
}

function selectAll(key, root = document) {
  for (const selector of list(key)) {
    try {
      const found = root.querySelectorAll(selector);
      if (found && found.length) {
        note(key, selector);
        return Array.from(found);
      }
    } catch {
      /* ignorar */
    }
  }
  note(key, null);
  return [];
}

function isValidSelector(selector) {
  return (
    typeof selector === 'string' &&
    selector.trim().length > 0 &&
    selector.length <= MAX_LENGTH &&
    !FORBIDDEN.test(selector)
  );
}

/** Aplica selectores remotos. Devuelve cuántos se aceptaron y cuáles se rechazaron. */
function applyRemote(map) {
  const applied = [];
  const rejected = [];
  if (!map || typeof map !== 'object') return { applied, rejected };

  for (const [key, raw] of Object.entries(map)) {
    const entry = state.get(key);
    if (!entry) {
      rejected.push(key);
      continue;
    }
    const incoming = (Array.isArray(raw) ? raw : [raw]).filter(isValidSelector);
    if (!incoming.length) {
      rejected.push(key);
      continue;
    }
    entry.remote = incoming.slice(0, MAX_CANDIDATES);
    applied.push(key);
  }

  if (applied.length) log('selectores remotos aplicados:', applied.join(', '));
  if (rejected.length) warn('selectores remotos rechazados:', rejected.join(', '));
  return { applied, rejected };
}

function clearRemote() {
  for (const entry of state.values()) entry.remote = [];
}

function snapshot() {
  const out = {};
  for (const [key, entry] of state) out[key] = list(key);
  return out;
}

/**
 * Estado de todas las claves: qué selector sigue funcionando y cuáles han
 * dejado de existir. Es el dato que dice "qué se rompió" sin adivinar.
 */
function selectorReport(root = document) {
  return [...state.keys()].map((key) => {
    const matched = select(key, root);
    const stats = health.get(key) || { hits: 0, misses: 0 };
    return {
      key,
      ok: !!matched,
      matched: stats.matched,
      total: list(key).length,
      remote: state.get(key).remote.length,
      misses: stats.misses,
    };
  });
}

function brokenSelectors(root = document) {
  return selectorReport(root).filter((row) => !row.ok);
}

function resetHealth() {
  health.clear();
}
return {
  candidates: candidates,
  select: select,
  selectAll: selectAll,
  isValidSelector: isValidSelector,
  applyRemote: applyRemote,
  clearRemote: clearRemote,
  snapshot: snapshot,
  selectorReport: selectorReport,
  brokenSelectors: brokenSelectors,
  resetHealth: resetHealth,
};
})();

/* ---- src/core/migrations.js ---- */
const __m4 = (function () {
/** Migraciones de configuración. Añadir una entrada nueva es lo único que hay que tocar al tocar el formato. */

const CONFIG_VERSION = 5;

const MIGRATIONS = [
  {
    to: 1,
    run(cfg) {
      if (cfg.hideExt !== undefined && cfg.hideExtensions === undefined) {
        cfg.hideExtensions = cfg.hideExt;
        delete cfg.hideExt;
      }
      if (cfg.cleanMode === undefined) cfg.cleanMode = true;
    },
  },
  { to: 2, run: (cfg) => void (cfg.viewerAnalytics ??= false) },
  { to: 3, run: (cfg) => void (cfg.sidebarThumbnailPreview ??= false) },
  {
    to: 4,
    run: (cfg) => {
      cfg.sidebarCompact ??= false;
      cfg.hideOfflineChannels ??= false;
      cfg.chatSearch ??= false;
    },
  },
  {
    to: 5,
    run: (cfg) => {
      cfg.chatKeywordHighlight ??= false;
      cfg.mentionHighlight ??= false;
      cfg.catalog ??= true;
      cfg.autoUpdate ??= true;
      cfg.debug ??= false;
      if (!cfg.keybinds || typeof cfg.keybinds !== 'object') cfg.keybinds = {};
    },
  },
];

function migrate(input) {
  const cfg = { ...(input || {}) };
  let from = Number.isFinite(cfg._v) ? cfg._v : 0;
  if (from > CONFIG_VERSION) from = 0; // config de una versión futura: se normaliza a los defaults

  for (const step of MIGRATIONS) {
    if (step.to <= from) continue;
    try {
      step.run(cfg);
    } catch {
      /* una migración rota no debe tumbar el arranque */
    }
    from = step.to;
  }

  cfg._v = CONFIG_VERSION;
  return cfg;
}
return {
  CONFIG_VERSION: CONFIG_VERSION,
  MIGRATIONS: MIGRATIONS,
  migrate: migrate,
};
})();

/* ---- src/core/store.js ---- */
const __m5 = (function () {
const { deleteValue: deleteValue, getValue: getValue, setValue: setValue } = __m1;
const { log: log, warn: warn } = __m2;
const { CONFIG_VERSION: CONFIG_VERSION, migrate: migrate } = __m4;

/**
 * Store con esquema declarado: cada clave tiene tipo y default, así una config
 * corrupta, de una versión vieja o editada a mano nunca rompe el arranque.
 */




const KEY = 'twpp.config';
const LEGACY_KEYS = ['twpp'];

const schema = new Map();
const listeners = new Set();
let cache = null;
let importedFromLegacy = null;

function coerce(value, type) {
  switch (type) {
    case 'bool':
      if (typeof value === 'boolean') return value;
      if (value === 'true') return true;
      if (value === 'false') return false;
      return undefined;
    case 'string':
      return typeof value === 'string' ? value : undefined;
    case 'number':
      return Number.isFinite(value) ? value : undefined;
    case 'object':
      return value && typeof value === 'object' && !Array.isArray(value) ? value : undefined;
    case 'array':
      return Array.isArray(value) ? value : undefined;
    default:
      return value;
  }
}

function declare(key, type, fallback) {
  schema.set(key, { type, fallback });
  if (cache) cache[key] = coerce(cache[key], type) ?? fallback;
}

function all() {
  if (cache) return cache;
  const migrated = migrate(readConfig());
  importedFromLegacy = importedFromLegacy || { imported: false, from: null };

  const next = {};
  let repaired = 0;
  for (const [key, { type, fallback }] of schema) {
    const value = coerce(migrated[key], type);
    if (value === undefined) {
      if (migrated[key] !== undefined) {
        repaired += 1;
        log('valor inválido reemplazado por default:', key);
      }
      next[key] = typeof fallback === 'object' && fallback !== null ? clone(fallback) : fallback;
    } else {
      next[key] = value;
    }
  }
  next._v = CONFIG_VERSION;
  if (repaired) warn('claves reparadas:', repaired);

  cache = next;
  if (importedFromLegacy.imported) {
    log(`configuración migrada desde "${importedFromLegacy.from}"`);
    persist();
  }
  return cache;
}

/** Lee la config actual y, si no hay, la del script de un solo archivo (v1). */
function readConfig() {
  const current = getValue(KEY, null);
  if (current && typeof current === 'object') return current;

  for (const legacy of LEGACY_KEYS) {
    const old = getValue(legacy, null);
    if (!old || typeof old !== 'object' || Array.isArray(old)) continue;
    importedFromLegacy = { imported: true, from: legacy };
    return { ...old, _v: Number.isFinite(old._v) ? old._v : 0 };
  }
  return current;
}

/** `true` si esta sesión importó la configuración del script anterior. */
function migratedFrom() {
  return importedFromLegacy?.imported ? importedFromLegacy.from : null;
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function get(key) {
  return all()[key];
}

function changed(key) {
  for (const fn of listeners) {
    try {
      fn(key, cache[key]);
    } catch (error) {
      warn('listener de store falló', error);
    }
  }
}

function set(key, value) {
  const current = all();
  if (current[key] === value) return value;
  current[key] = value;
  persist();
  changed(key);
  return value;
}

function setMany(entries) {
  const current = all();
  const keys = Object.keys(entries).filter((key) => current[key] !== entries[key]);
  if (!keys.length) return current;
  Object.assign(current, entries);
  persist();
  for (const key of keys) changed(key);
  return current;
}

function onChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function persist() {
  try {
    setValue(KEY, cache);
  } catch (error) {
    warn('no se pudo guardar la configuración', error);
  }
}

function exportJSON() {
  return JSON.stringify({ ...all(), _v: CONFIG_VERSION }, null, 2);
}

function importJSON(text) {
  const parsed = JSON.parse(text);
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('JSON inválido');
  cache = all();
  for (const [key, { type, fallback }] of schema) {
    const value = coerce(parsed[key], type);
    cache[key] = value === undefined ? (typeof fallback === 'object' ? clone(fallback) : fallback) : value;
  }
  cache._v = CONFIG_VERSION;
  persist();
  for (const key of Object.keys(cache)) changed(key);
  return cache;
}

function reset() {
  deleteValue(KEY);
  const fresh = { _v: CONFIG_VERSION };
  for (const [key, { fallback }] of schema) {
    fresh[key] = typeof fallback === 'object' && fallback !== null ? clone(fallback) : fallback;
  }
  cache = fresh;
  persist();
  for (const key of Object.keys(cache)) changed(key);
  return cache;
}

function schemaSnapshot() {
  return Object.fromEntries([...schema].map(([key, def]) => [key, def.type]));
}
return {
  declare: declare,
  all: all,
  migratedFrom: migratedFrom,
  get: get,
  set: set,
  setMany: setMany,
  onChange: onChange,
  exportJSON: exportJSON,
  importJSON: importJSON,
  reset: reset,
  schemaSnapshot: schemaSnapshot,
};
})();

/* ---- src/core/registry.js ---- */
const __m6 = (function () {
const { emit: emit } = __m0;
const { log: log, track: track, warn: warn } = __m2;
const { declare: declare, get: storeGet, set: storeSet } = __m5;

/**
 * Registro y ciclo de vida de features.
 *
 * Cada feature es un objeto declarativo; el registry se encarga de:
 *  - declarar la clave en el store (con default y tipo bool)
 *  - activar/desactivar (clase CSS en <html> + hooks)
 *  - ejecutarla en el scheduler respetando su `interval`
 *  - aislar errores: una feature rota se apaga sola tras varios fallos seguidos
 */




const SECTIONS = [
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

function defineFeature(spec) {
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

function all() {
  return features;
}

function get(id) {
  return byId.get(id) || null;
}

function isEnabled(id) {
  return !!storeGet(id);
}

function apply(id) {
  const feature = byId.get(id);
  if (!feature) return;
  const enabled = !!storeGet(id);
  const on = enabled && allowed(feature);
  document.documentElement.classList.toggle(scopeClass(id), on);
  if (on) {
    // el contador de fallos se reinicia al (re)activar, no al apagar
    failures.delete(id);
    lastRun.delete(id);
  }
  try {
    if (on && feature.onEnable) feature.onEnable();
    if (!on && feature.onDisable) feature.onDisable();
  } catch (error) {
    track(`enable:${id}`, error);
  }
  emit('feature:toggled', { id, on, enabled });
}

function applyAll() {
  for (const feature of features) apply(feature.id);
}

/** `true` si la feature está habilitada y su condición se cumple. */
function isActive(id) {
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

function tickAll(now = Date.now(), { force = false } = {}) {
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

function onRouteAll(route) {
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

function disableAll() {
  for (const feature of features) {
    storeSet(feature.id, false);
    apply(feature.id);
  }
  log('todas las features desactivadas');
}

function statuses() {
  return features.map((feature) => ({
    id: feature.id,
    section: feature.section,
    enabled: !!storeGet(feature.id),
    active: isActive(feature.id),
    blocked: typeof feature.when === 'function' && !allowed(feature),
    remote: !!feature.remote,
    failures: failures.get(feature.id) || 0,
  }));
}

function sectionOf(id) {
  return byId.get(id)?.section || 'advanced';
}

function failureCount(id) {
  return failures.get(id) || 0;
}
return {
  SECTIONS: SECTIONS,
  defineFeature: defineFeature,
  all: all,
  get: get,
  isEnabled: isEnabled,
  apply: apply,
  applyAll: applyAll,
  isActive: isActive,
  tickAll: tickAll,
  onRouteAll: onRouteAll,
  disableAll: disableAll,
  statuses: statuses,
  sectionOf: sectionOf,
  failureCount: failureCount,
};
})();

/* ---- src/core/styles.js ---- */
const __m7 = (function () {
const { log: log } = __m2;
const { all: all } = __m6;

const STYLE_ID = 'twpp-style';
let current = '';

function sheet() {
  let node = document.getElementById(STYLE_ID);
  if (!node) {
    node = document.createElement('style');
    node.id = STYLE_ID;
    (document.head || document.documentElement).appendChild(node);
  }
  return node;
}

function build() {
  const chunks = [];
  for (const feature of all()) {
    if (!feature.css) continue;
    chunks.push(feature.css.replace(/%SCOPE%/g, `html.twpp-${feature.id}`));
  }
  return chunks.join('\n');
}

/** Reconstruye el CSS consolidado (llamar tras añadir features remotas). */
function rebuild() {
  current = build();
  sheet().textContent = current;
  log('CSS reconstruido:', `${(current.length / 1024).toFixed(1)} KB`);
  return current;
}

function css() {
  if (!current) rebuild();
  return current;
}
return {
  rebuild: rebuild,
  css: css,
};
})();

/* ---- src/core/version.js ---- */
const __m8 = (function () {
/** Sustituido en build. Fuente única de verdad: package.json + header del userscript. */
const VERSION = '2.2.0';
const REPO_URL = 'https://github.com/clevervi/twitch-plus-plus';
const RAW_URL = 'https://raw.githubusercontent.com/clevervi/twitch-plus-plus/main';
const BRANCH = 'main';
const CATALOG_URL = `${RAW_URL}/catalog.json`;
const LATEST_URL = `${RAW_URL}/dist/latest.json`;
const SCRIPT_URL = `${RAW_URL}/dist/twitch-plus-plus.user.js`;
return {
  VERSION: VERSION,
  REPO_URL: REPO_URL,
  RAW_URL: RAW_URL,
  BRANCH: BRANCH,
  CATALOG_URL: CATALOG_URL,
  LATEST_URL: LATEST_URL,
  SCRIPT_URL: SCRIPT_URL,
};
})();

/* ---- src/core/catalog.js ---- */
const __m9 = (function () {
const { emit: emit } = __m0;
const { getJson: getJson, getValue: getValue, setValue: setValue } = __m1;
const { log: log, warn: warn } = __m2;
const { applyRemote: applyRemoteSelectors, clearRemote: clearRemoteSelectors } = __m3;
const { SECTIONS: SECTIONS, all: all, apply: apply, defineFeature: defineFeature } = __m6;
const { rebuild: rebuildStyles } = __m7;
const { get: storeGet } = __m5;
const { CATALOG_URL: CATALOG_URL } = __m8;

/**
 * Catálogo remoto: el repo (no el script) es la fuente de estabilidad.
 *
 * Permite (a) que la comunidadlice selectores nuevos cuando Twitch cambia el DOM
 * y (b) publicar features experimentales en CSS sin sacar una release del
 * userscript. Todo es opcional y validado: si el repo no responde, si el JSON es
 * inválido o si un selector es sospechoso, se ignora y se sigue con lo local.
 */









const CACHE_KEY = 'twpp.catalog.cache';
const SCHEMA = 1;
const TTL = 6 * 60 * 60 * 1000;
const MAX_CSS = 20000;
const CSS_FORBIDDEN = /<\/style|@import|expression\(|javascript:|url\(/i;
const ID_RE = /^[a-z][a-z0-9-]{2,40}$/;

let last = { revision: 0, updatedAt: 0, selectors: 0, features: 0, note: '', error: '' };

function readCache() {
  const raw = getValue(CACHE_KEY, null);
  if (!raw || typeof raw !== 'object') return null;
  return raw;
}

function writeCache(data) {
  setValue(CACHE_KEY, { data, fetchedAt: Date.now() });
}

function validFeature(spec) {
  if (!spec || typeof spec !== 'object') return false;
  if (!ID_RE.test(String(spec.id || ''))) return false;
  if (typeof spec.label !== 'string' || !spec.label || spec.label.length > 60) return false;
  if (!SECTIONS.some((s) => s.id === spec.section)) return false;
  if (typeof spec.css !== 'string' || !spec.css.trim() || spec.css.length > MAX_CSS) return false;
  if (CSS_FORBIDDEN.test(spec.css)) return false;
  if (spec.interval !== undefined && (!Number.isFinite(spec.interval) || spec.interval < 0)) return false;
  return true;
}

/** Aplica un catálogo ya validado. Devuelve un resumen de lo aplicado. */
function applyCatalog(data) {
  const summary = { revision: data.revision, selectors: 0, features: 0, rejected: 0 };

  if (data.selectors && typeof data.selectors === 'object') {
    const result = applyRemoteSelectors(data.selectors);
    summary.selectors = result.applied.length;
    summary.rejected += result.rejected.length;
  }

  if (Array.isArray(data.features)) {
    for (const spec of data.features) {
      if (!validFeature(spec)) {
        summary.rejected += 1;
        continue;
      }
      if (all().some((f) => f.id === spec.id)) continue;
      defineFeature({ ...spec, remote: true, interval: spec.interval || 0, default: false });
      apply(spec.id);
      summary.features += 1;
    }
  }

  last = {
    revision: Number(data.revision) || 0,
    updatedAt: Date.now(),
    selectors: summary.selectors,
    features: summary.features,
    note: String(data.note || data.notes || '').slice(0, 400),
    error: '',
  };
  writeCache(data);
  if (summary.selectors || summary.features) rebuildStyles();
  emit('catalog:updated', summary);
  log('catálogo aplicado:', summary);
  return summary;
}

function status() {
  return { ...last, enabled: !!storeGet('catalog'), local: all().filter((f) => f.remote).map((f) => f.id) };
}

function needsFetch(force) {
  if (!storeGet('catalog')) return false;
  const cached = readCache();
  if (force || !cached) return true;
  return Date.now() - (cached.fetchedAt || 0) > TTL;
}

/** Descarga y aplica el catálogo del repo. Devuelve `null` si no había nada que hacer. */
async function refresh({ force = false, timeout = 8000 } = {}) {
  if (!needsFetch(force)) return null;

  const data = await getJson(CATALOG_URL, { timeout });
  if (!data || typeof data !== 'object') {
    last.error = 'no se pudo leer el catálogo';
    return { error: last.error };
  }
  if (Number(data.schema) !== SCHEMA) {
    last.error = `esquema no soportado: ${data.schema}`;
    warn(last.error);
    return { error: last.error };
  }
  if (Number(data.revision) <= last.revision && !force) return null;

  return applyCatalog(data);
}

/** Aplica el catálogo cacheado (arranque instantáneo, sin red). */
function warm() {
  if (!storeGet('catalog')) return null;
  const cached = readCache();
  if (!cached || !cached.data) return null;
  if (Date.now() - (cached.fetchedAt || 0) > TTL * 6) return null;
  try {
    return applyCatalog(cached.data);
  } catch (error) {
    warn('catálogo cacheado inválido', error);
    return null;
  }
}

function clearCache() {
  clearRemoteSelectors();
  setValue(CACHE_KEY, null);
  last = { revision: 0, updatedAt: 0, selectors: 0, features: 0, note: '', error: '' };
}
return {
  applyCatalog: applyCatalog,
  status: status,
  refresh: refresh,
  warm: warm,
  clearCache: clearCache,
};
})();

/* ---- src/core/dom.js ---- */
const __m10 = (function () {
function $(selector, root = document) {
  return root.querySelector(selector);
}

function $$(selector, root = document) {
  return Array.from(root.querySelectorAll(selector));
}

function qsAll(selector, root = document) {
  try {
    return Array.from(root.querySelectorAll(selector));
  } catch {
    return [];
  }
}

function qs(selector, root = document) {
  try {
    return root.querySelector(selector);
  } catch {
    return null;
  }
}

function findFirst(selectors, root = document) {
  for (const selector of selectors) {
    const el = qs(selector, root);
    if (el) return el;
  }
  return null;
}

function isVisible(el) {
  if (!el || !el.isConnected) return false;
  const rect = el.getBoundingClientRect();
  if (!rect.width && !rect.height) return false;
  const style = getComputedStyle(el);
  return style.visibility !== 'hidden' && style.display !== 'none';
}

function throttle(fn, wait) {
  let last = 0;
  let timer = null;
  let pending = null;
  return function throttled(...args) {
    pending = args;
    const remaining = wait - (Date.now() - last);
    if (remaining <= 0) {
      last = Date.now();
      fn.apply(this, pending);
      pending = null;
      return;
    }
    if (timer) return;
    timer = setTimeout(() => {
      timer = null;
      last = Date.now();
      if (pending) fn.apply(this, pending);
      pending = null;
    }, remaining);
  };
}

function debounce(fn, wait) {
  let timer = null;
  return function debounced(...args) {
    clearTimeout(timer);
    timer = setTimeout(() => fn.apply(this, args), wait);
  };
}

function onIdle(fn, timeout = 900) {
  if (typeof requestIdleCallback === 'function') return requestIdleCallback(fn, { timeout });
  return setTimeout(fn, 250);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function el(tag, props = {}, children = []) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(props)) {
    if (key === 'class') node.className = value;
    else if (key === 'text') node.textContent = value;
    else if (key === 'html') node.innerHTML = value;
    else if (key === 'style') node.setAttribute('style', value);
    else if (key.startsWith('on') && typeof value === 'function') node.addEventListener(key.slice(2), value);
    else if (value !== null && value !== undefined) node.setAttribute(key, value);
  }
  for (const child of [].concat(children)) {
    if (child) node.appendChild(typeof child === 'string' ? document.createTextNode(child) : child);
  }
  return node;
}

function ready(fn) {
  if (document.readyState !== 'loading') return fn();
  return document.addEventListener('DOMContentLoaded', fn, { once: true });
}
return {
  $: $,
  $$: $$,
  qsAll: qsAll,
  qs: qs,
  findFirst: findFirst,
  isVisible: isVisible,
  throttle: throttle,
  debounce: debounce,
  onIdle: onIdle,
  sleep: sleep,
  el: el,
  ready: ready,
};
})();

/* ---- src/core/keybinds.js ---- */
const __m11 = (function () {
const { get: storeGet, set: storeSet } = __m5;
const { warn: warn } = __m2;

const actions = new Map();

const MODIFIERS = {
  alt: 'alt',
  option: 'alt',
  ctrl: 'ctrl',
  control: 'ctrl',
  shift: 'shift',
  meta: 'meta',
  cmd: 'meta',
  command: 'meta',
  super: 'meta',
};

const NAMED_KEYS = new Set([
  'escape', 'enter', 'return', 'space', 'tab', 'backspace', 'delete', 'insert', 'home', 'end',
  'pageup', 'pagedown', 'up', 'down', 'left', 'right', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright',
  'pause', 'printscreen', 'capslock', 'numlock', 'scrolllock', ...Array.from({ length: 12 }, (_, i) => `f${i + 1}`),
]);

/** Una tecla válida: un carácter, un nombre de tecla o F1–F12. */
function isKeyPart(part) {
  if (/^[a-z0-9]$/.test(part)) return true;
  if (NAMED_KEYS.has(part)) return true;
  return /^f([1-9]|1[0-2])$/.test(part);
}

/** `Alt+P` → {alt:true,…,key:'p'} · cualquier basura → null */
function parseKeybind(str) {
  if (!str) return null;
  const parts = String(str)
    .split('+')
    .map((part) => part.trim().toLowerCase())
    .filter(Boolean);
  if (!parts.length) return null;

  const combo = { alt: false, ctrl: false, shift: false, meta: false, key: '' };
  for (const part of parts) {
    if (MODIFIERS[part]) combo[MODIFIERS[part]] = true;
    else if (isKeyPart(part)) combo.key = part;
    else return null;
  }
  return combo.key ? combo : null;
}

function matchKeybind(combo, event) {
  if (!combo) return false;
  return (
    combo.alt === event.altKey &&
    combo.ctrl === event.ctrlKey &&
    combo.shift === event.shiftKey &&
    combo.meta === event.metaKey &&
    combo.key === String(event.key || '').toLowerCase()
  );
}

function isTypingTarget(target) {
  if (!target || !target.tagName) return false;
  const tag = target.tagName.toLowerCase();
  return tag === 'input' || tag === 'textarea' || tag === 'select' || target.isContentEditable === true;
}

function register(id, label, fallback) {
  actions.set(id, { id, label, fallback });
  const keybinds = storeGet('keybinds') || {};
  if (typeof keybinds[id] !== 'string') keybinds[id] = fallback;
  storeSet('keybinds', keybinds);
}

function list() {
  return [...actions.values()];
}

function comboOf(id) {
  return parseKeybind((storeGet('keybinds') || {})[id]);
}

function bindGlobal(run) {
  window.addEventListener(
    'keydown',
    (event) => {
      if (event.repeat) return; // mantener pulsado no debe repetir la acción
      const keybinds = storeGet('keybinds') || {};
      for (const id of actions.keys()) {
        if (!keybinds[id]) continue;
        if (!matchKeybind(parseKeybind(keybinds[id]), event)) continue;
        if (isTypingTarget(event.target) && id !== 'panel') continue;
        event.preventDefault();
        run(id);
        return;
      }
    },
    true,
  );
}

function setCombo(id, value) {
  const keybinds = { ...(storeGet('keybinds') || {}) };
  const combo = parseKeybind(value);
  if (value && !combo) {
    warn('atajo inválido, se ignora:', value);
    return false;
  }
  keybinds[id] = combo ? String(value).trim() : '';
  storeSet('keybinds', keybinds);
  return true;
}

function describe(value) {
  return parseKeybind(value) ? String(value).trim() : '—';
}
return {
  register: register,
  list: list,
  comboOf: comboOf,
  bindGlobal: bindGlobal,
  setCombo: setCombo,
  describe: describe,
};
})();

/* ---- src/core/probe.js ---- */
const __m12 = (function () {
const { trackedErrors: trackedErrors } = __m2;
const { all: all, applyAll: applyAll, failureCount: failureCount, isActive: isActive, tickAll: tickAll } = __m6;
const { selectorReport: selectorReport } = __m3;
const { get: storeGet, set: storeSet } = __m5;

/**
 * Sonda de diagnóstico: fuerza todas las features contra el DOM que hay ahora
 * mismo y devuelve qué funcionó y qué se rompió. Se usa desde probe.html (con un
 * volcado del HTML de Twitch) y desde `TwitchPP.diagnostics.probe()`.
 * Restaura la configuración del usuario al terminar.
 */





function probe({ ticks = 2, root = document } = {}) {
  const before = trackedErrors().length;
  const snapshot = all().map((feature) => [feature.id, !!storeGet(feature.id)]);

  for (const [id] of snapshot) storeSet(id, true);
  applyAll(); // reactivar limpia los contadores de fallos
  for (let i = 0; i < ticks; i += 1) tickAll(Date.now() + i * 60_000, { force: true });

  const features = all().map((feature) => ({
    id: feature.id,
    section: feature.section,
    hasTick: !!feature.tick,
    active: isActive(feature.id),
    blocked: typeof feature.when === 'function' && !isActive(feature.id),
    errors: failureCount(feature.id),
  }));

  const selectors = selectorReport(root);
  const errors = trackedErrors().slice(before);

  for (const [id, enabled] of snapshot) storeSet(id, enabled);
  applyAll();

  return {
    at: new Date().toISOString(),
    url: root.location?.href ?? '',
    features,
    selectors,
    errors,
    summary: {
      featuresOk: features.filter((feature) => feature.errors === 0).length,
      featuresTotal: features.length,
      selectorsOk: selectors.filter((row) => row.ok).length,
      selectorsTotal: selectors.length,
    },
  };
}
return {
  probe: probe,
};
})();

/* ---- src/core/report.js ---- */
const __m13 = (function () {
const { status: catalogStatus } = __m9;
const { trackedErrors: trackedErrors } = __m2;
const { statuses: statuses } = __m6;
const { brokenSelectors: brokenSelectors } = __m3;
const { VERSION: VERSION } = __m8;

/** Informe de una línea por dato, pensado para pegar en un issue. */






function report() {
  const list = statuses();
  const active = list.filter((feature) => feature.active).map((feature) => feature.id);
  const blocked = list.filter((feature) => feature.enabled && !feature.active).map((feature) => feature.id);
  const failing = list.filter((feature) => feature.failures > 0).map((feature) => `${feature.id} (${feature.failures})`);
  const dead = brokenSelectors().map((row) => row.key);
  const catalog = catalogStatus();

  const lines = [
    `Twitch++ v${VERSION}`,
    `navegador: ${globalThis.navigator?.userAgent || 'desconocido'}`,
    `página: ${location.pathname}`,
    `features activas: ${active.join(', ') || '—'}`,
    `features bloqueadas por condición: ${blocked.join(', ') || '—'}`,
    `features con errores: ${failing.join(', ') || '—'}`,
    `selectores sin resolver: ${dead.join(', ') || '—'}`,
    `catálogo: rev. ${catalog.revision || 'local'}${catalog.remote ? '' : ' (sin remoto)'}${catalog.error ? ` — ${catalog.error}` : ''}`,
  ];
  for (const entry of trackedErrors().slice(-5)) lines.push(`error: ${entry.scope}: ${entry.message}`);
  return lines.join('\n');
}
return {
  report: report,
};
})();

/* ---- src/core/router.js ---- */
const __m14 = (function () {
const { emit: emit } = __m0;
const { log: log } = __m2;

/** Detección de navegación SPA (Twitch no recarga la página al cambiar de canal). */



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

function start() {
  if (bound) return;
  bound = true;
  patch('pushState');
  patch('replaceState');
  window.addEventListener('popstate', notify);
  window.addEventListener('hashchange', notify);
  emit('route', currentRoute());
}
return {
  start: start,
};
})();

/* ---- src/core/scheduler.js ---- */
const __m15 = (function () {
const { debounce: debounce, onIdle: onIdle, throttle: throttle } = __m10;
const { log: log } = __m2;
const { tickAll: tickAll } = __m6;
const { emit: emit } = __m0;

/**
 * Scheduler: un único latido en vez de un bucle agresivo por feature.
 * Se despierta por eventos (mutaciones, cambio de ruta, visibilidad) y cada
 * feature decide su frecuencia con `interval`. Se detiene con la pestaña oculta.
 */





const HEARTBEAT = 1000;

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

function request() {
  if (queued) return;
  queued = true;
  onIdle(() => {
    queued = false;
    run();
  });
}

function observe() {
  if (observer || typeof MutationObserver !== 'function') return;
  const signal = throttle(() => request(), 600);
  observer = new MutationObserver(signal);
  observer.observe(document.body, { childList: true, subtree: true });
}

function start() {
  if (timer) return;
  observe();
  timer = setInterval(run, HEARTBEAT);
  document.addEventListener('visibilitychange', onVisibility);
  request();
  log('scheduler iniciado');
}

function stop() {
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

function kick() {
  request();
}

const scheduleRoute = debounce(() => request(), 120);

function isRunning() {
  return !!timer;
}
return {
  request: request,
  start: start,
  stop: stop,
  kick: kick,
  scheduleRoute: scheduleRoute,
  isRunning: isRunning,
};
})();

/* ---- src/core/toast.js ---- */
const __m16 = (function () {
const { log: log } = __m2;

let host = null;
const queue = [];

function setHost(node) {
  host = node;
  while (queue.length && host) show(queue.shift());
}

function show(message, duration = 1800) {
  if (!host) {
    log('toast (sin host):', message);
    queue.push([message, duration]);
    return;
  }
  const node = document.createElement('div');
  node.className = 'toast';
  node.textContent = String(message);
  host.appendChild(node);
  requestAnimationFrame(() => node.classList.add('in'));
  setTimeout(() => {
    node.classList.remove('in');
    setTimeout(() => node.remove(), 220);
  }, duration);
}
return {
  setHost: setHost,
  show: show,
};
})();

/* ---- src/core/updater.js ---- */
const __m17 = (function () {
const { getJson: getJson, getValue: getValue, openInTab: openInTab, setValue: setValue } = __m1;
const { log: log } = __m2;
const { get: storeGet } = __m5;
const { LATEST_URL: LATEST_URL, REPO_URL: REPO_URL, SCRIPT_URL: SCRIPT_URL, VERSION: VERSION } = __m8;

/**
 * Auto-actualización.
 *
 * Tampermonkey/Greasemonkey resuelven la instalación con @updateURL/@downloadURL.
 * Este módulo sirve para dos cosas:
 *  - avisar en el panel en cuanto hay una versión nueva (sin recargar Twitch)
 *  - abrir el instalador con un clic
 * Compara contra dist/latest.json, que genera `npm run build`.
 */





const LAST_CHECK_KEY = 'twpp.update.lastCheck';
const DAY = 24 * 60 * 60 * 1000;

function parseVersion(value) {
  const parts = String(value || '')
    .split('-')[0]
    .split('.')
    .map((part) => parseInt(String(part).replace(/[^\d]/g, ''), 10) || 0);
  return [parts[0] || 0, parts[1] || 0, parts[2] || 0];
}

/** `true` si `candidate` es más reciente que `current`. */
function isNewer(candidate, current) {
  const a = parseVersion(candidate);
  const b = parseVersion(current);
  for (let i = 0; i < 3; i += 1) {
    if (a[i] > b[i]) return true;
    if (a[i] < b[i]) return false;
  }
  return false;
}

async function check({ force = false, timeout = 6000 } = {}) {
  if (!force) {
    const last = getValue(LAST_CHECK_KEY, 0);
    if (last && Date.now() - last < DAY) return { skipped: true, version: VERSION };
  }

  const data = await getJson(LATEST_URL, { timeout });
  setValue(LAST_CHECK_KEY, Date.now());
  if (!data) return { error: 'sin respuesta del repo' };

  const latest = String(data.version || '');
  const result = {
    version: VERSION,
    latest,
    update: !!latest && isNewer(latest, VERSION),
    notes: String(data.notes || '').slice(0, 1200),
    publishedAt: String(data.publishedAt || ''),
    repo: REPO_URL,
  };
  log('actualización', result);
  return result;
}

/** Abre el instalador de Tampermonkey con la versión publicada. */
function install() {
  openInTab(SCRIPT_URL);
}

function shouldCheck() {
  return !!storeGet('autoUpdate');
}
return {
  parseVersion: parseVersion,
  isNewer: isNewer,
  check: check,
  install: install,
  shouldCheck: shouldCheck,
};
})();

/* ---- src/features/chat-pause.js ---- */
const __m18 = (function () {
const { isVisible: isVisible } = __m10;
const { select: select } = __m3;
const { show: toast } = __m16;

/**
 * Pausa de chat.
 *
 * Usa el botón nativo de Twitch cuando existe; si no, congela el scroll del
 * contenedor de mensajes. Se mantiene vivo aunque Twitch recree el nodo.
 */




const state = {
  active: false,
  el: null,
  top: 0,
  userScrolling: false,
  onScroll: null,
  onUser: null,
  userTimer: null,
  native: null,
};

function nativeButton() {
  const button = select('pauseChat');
  return button && isVisible(button) ? button : null;
}

/** Twitch cambia el aria-label cuando el chat está pausado por su propio botón. */
function nativeSaysPaused(button) {
  return /resume|reanudar/i.test(button?.getAttribute('aria-label') || '');
}

function findScrollable() {
  const container = select('chat.container');
  if (!container) return null;
  let node = container.parentElement;
  while (node && node !== document.body) {
    const overflow = getComputedStyle(node).overflowY;
    if ((overflow === 'auto' || overflow === 'scroll' || overflow === 'overlay') && node.scrollHeight > node.clientHeight) {
      return node;
    }
    node = node.parentElement;
  }
  return container.parentElement || container;
}

function detach() {
  if (!state.el) return;
  state.el.removeEventListener('scroll', state.onScroll);
  state.el.removeEventListener('wheel', state.onUser);
  state.el.removeEventListener('touchmove', state.onUser);
  clearTimeout(state.userTimer);
  state.el = null;
}

function attach() {
  const node = findScrollable();
  if (!node) return false;
  if (node === state.el) return true;
  detach();

  state.el = node;
  state.onScroll = () => {
    if (!state.active || !state.el || state.userScrolling) return;
    if (Math.abs(state.el.scrollTop - state.top) > 1) state.el.scrollTop = state.top;
  };
  state.onUser = () => {
    state.userScrolling = true;
    clearTimeout(state.userTimer);
    state.userTimer = setTimeout(() => {
      state.userScrolling = false;
      if (state.el) state.top = state.el.scrollTop;
    }, 150);
  };
  node.addEventListener('scroll', state.onScroll, { passive: true });
  node.addEventListener('wheel', state.onUser, { passive: true });
  node.addEventListener('touchmove', state.onUser, { passive: true });
  return true;
}

const ChatPause = {
  isActive() {
    return state.active;
  },

  pause() {
    const native = nativeButton();
    if (native) {
      native.click();
      state.active = true;
      state.native = native;
      toast('Chat pausado');
      return true;
    }
    if (!attach()) return false;
    state.top = state.el.scrollTop;
    state.active = true;
    toast('Chat pausado');
    return true;
  },

  resume() {
    if (state.native && state.native.isConnected) state.native.click();
    state.native = null;
    state.active = false;
    detach();
    toast('Chat reanudado');
    return true;
  },

  toggle() {
    return state.active ? this.resume() : this.pause();
  },

  /** Lo llama el scheduler: reconcilia con Twitch y recoloca el scroll si recreó el contenedor. */
  ensure() {
    if (!state.active) return;
    if (state.native) {
      if (state.native.isConnected && nativeSaysPaused(state.native)) return;
      state.native = null;
      state.active = false;
      return;
    }
    if (!state.el || !state.el.isConnected) {
      attach();
      if (state.el) state.top = state.el.scrollTop;
    }
  },
};
return {
  ChatPause: ChatPause,
};
})();

/* ---- src/features/auto-claim.js ---- */
const __m19 = (function () {
const { isVisible: isVisible, qs: qs } = __m10;
const { log: log } = __m2;
const { defineFeature: defineFeature } = __m6;
const { select: select, selectAll: selectAll } = __m3;
const { show: toast } = __m16;
const { get: storeGet } = __m5;

/** Reclamo automático de Channel Points. */







const CLAIM_HINT = /claim|reclamar|reclama|abholen|réclamer/i;

let lastClick = 0;

function cooldown() {
  const seconds = Number(storeGet('claimCooldown'));
  return (Number.isFinite(seconds) ? seconds : 2.5) * 1000;
}

function findButton() {
  const direct = select('claimBonus');
  if (direct) return direct.tagName === 'BUTTON' ? direct : qs('button', direct) || direct;

  for (const summary of selectAll('channelPoints')) {
    for (const button of summary.querySelectorAll('button')) {
      if (CLAIM_HINT.test(button.getAttribute('aria-label') || button.textContent || '')) return button;
    }
  }
  return null;
}

defineFeature({
  id: 'autoClaim',
  label: 'Auto Channel Points',
  section: 'auto',
  default: true,
  interval: 1200,
  settings: [
    { key: 'claimDryRun', label: 'Solo detectar (no pulsar)', type: 'bool', default: false },
    { key: 'claimCooldown', label: 'Espera mínima (s)', type: 'number', default: 2.5, min: 0.5, max: 60, step: 0.5 },
  ],
  tick(now) {
    if (storeGet('claimDryRun')) return;
    const button = findButton();
    if (!button || !isVisible(button)) return;
    if (now - lastClick < cooldown()) return;
    lastClick = now;
    button.click();
    log('channel points reclamados');
    toast('Channel Points reclamados');
  },
  onDisable() {
    lastClick = 0;
  },
});
return {

};
})();

/* ---- src/core/twitch.js ---- */
const __m20 = (function () {
const { qs: qs, qsAll: qsAll, isVisible: isVisible } = __m10;
const { select: select, selectAll: selectAll } = __m3;

/** Utilidades específicas de Twitch: nombres de canal, miniaturas, tooltips, contadores. */



const CDN = 'https://static-cdn.jtvnw.net/previews-ttv';
const RESERVED = new Set([
  'directory', 'settings', 'subscriptions', 'inventory', 'wallet', 'drops', 'u', 'downloads',
  'friends', 'search', 'turbo', 'subscriptions', 'p', 'store', 'prime', 'signup', 'login',
]);

function channelFromHref(href) {
  if (!href || !href.startsWith('/') || href.startsWith('//')) return null;
  const first = href.split(/[/?#]/).filter(Boolean)[0];
  if (!first || RESERVED.has(first.toLowerCase())) return null;
  return decodeURIComponent(first).toLowerCase();
}

function channelFromCard(card) {
  const link = card && (qs('a[href^="/"]', card) || qs('[data-a-target="side-nav-link"]', card));
  return channelFromHref(link ? link.getAttribute('href') : null);
}

function visibleChannels(limit = 8) {
  const out = [];
  const seen = new Set();
  for (const link of qsAll('nav a[href^="/"]')) {
    const channel = channelFromHref(link.getAttribute('href'));
    if (!channel || seen.has(channel)) continue;
    seen.add(channel);
    out.push(channel);
    if (out.length >= limit) break;
  }
  return out;
}

function thumbnailUrl(channel, width = 440) {
  const size = width <= 220 ? '220x248' : width >= 720 ? '720x405' : '440x248';
  return `${CDN}/live_user_${channel}-${size}.jpg`;
}

function currentChannel() {
  return (location.pathname.match(/^\/([^/]+)/) || [])[1] || '';
}

/**
 * ¿Twitch está en tema oscuro? Primero la clase que Twitch usa y, si no está,
 * se deduce del color de fondo real (sirve para cuando cambian el marcado).
 */
function isDarkTheme() {
  if (document.documentElement.classList.contains('tw-root--theme-dark')) return true;
  if (document.body?.classList.contains('tw-root--theme-dark')) return true;
  if (qs('.tw-root--theme-dark')) return true;

  const style = getComputedStyle(document.body || document.documentElement);
  const color = style?.backgroundColor || style?.color || '';
  const [r, g, b] = (String(color).match(/[\d.]+/g) || []).map(Number);
  if ([r, g, b].length < 3 || [r, g, b].some(Number.isNaN)) return true;
  return (r * 299 + g * 587 + b * 114) / 1000 < 128;
}

/** Diálogo de hover que Twitch abre al pasar por una card de la sidebar. */
function hoverDialog() {
  const layers = qsAll('.tw-dialog-layer, [role="dialog"]');
  for (const layer of layers) {
    if (layer.offsetParent === null && layer !== document.body) continue;
    if (isVisible(layer)) return layer;
  }
  return null;
}

async function waitForHoverDialog(timeout = 1200) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    const dialog = hoverDialog();
    if (dialog) return dialog;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  return null;
}

/** Nombre de usuario del usuario conectado (para menciones). */
function currentUsername() {
  const toggle = select('userMenu');
  if (!toggle) return null;
  const img = qs('img', toggle);
  if (img && img.alt) return img.alt.trim();
  const label = toggle.getAttribute('aria-label') || '';
  const match = label.match(/^(.+?)['’]s\s+user\s+menu/i) || label.match(/^User menu\s*[-–]\s*(.+)/i);
  return match ? match[1].trim() : null;
}

function usernameOf(message) {
  const node = qs('.chat-line__username, [data-a-target="chat-message-username"]', message);
  const text = node ? (node.textContent || '').trim() : '';
  return text ? text.toLowerCase() : null;
}

function chatLines(root = document) {
  return selectAll('chat.line', root);
}

function chatContainer() {
  return select('chat.container');
}

function messageText(message) {
  const body = qs('.chat-line__message, [data-a-target="chat-line-message-body"]', message);
  return (body ? body.textContent : message.textContent) || '';
}

/** Contador de viewers parseado a número (soporta 1,2 K / 12,3 mil). */
function viewerCount() {
  const node = select('viewerCount');
  if (!node) return null;
  const text = (node.textContent || '').trim();
  const mil = /k|mil|\sK\b/i.test(text);
  const digits = text.replace(/[^\d]/g, '');
  if (!digits) return null;
  const value = parseInt(digits, 10);
  return mil ? value * 1000 : value;
}
return {
  channelFromHref: channelFromHref,
  channelFromCard: channelFromCard,
  visibleChannels: visibleChannels,
  thumbnailUrl: thumbnailUrl,
  currentChannel: currentChannel,
  isDarkTheme: isDarkTheme,
  hoverDialog: hoverDialog,
  waitForHoverDialog: waitForHoverDialog,
  currentUsername: currentUsername,
  usernameOf: usernameOf,
  chatLines: chatLines,
  chatContainer: chatContainer,
  messageText: messageText,
  viewerCount: viewerCount,
};
})();

/* ---- src/features/chat-keywords.js ---- */
const __m21 = (function () {
const { defineFeature: defineFeature } = __m6;
const { get: storeGet, onChange: onChange } = __m5;
const { chatContainer: chatContainer, chatLines: chatLines, messageText: messageText } = __m20;

/** Resalta mensajes que contienen palabras clave (por defecto o regex). */




const CLASS = 'twpp-keyword';
let cache = { key: '', matcher: null };
let stop = null;

function keywords() {
  return String(storeGet('chatKeywords') || '')
    .split(/[,\n]/)
    .map((word) => word.trim())
    .filter(Boolean);
}

function buildMatcher() {
  const list = keywords();
  const key = `${list.join(' ')}|${storeGet('chatKeywordRegex') ? 're' : 'plain'}`;
  if (key === cache.key) return cache.matcher;
  cache = { key, matcher: null };
  if (!list.length) return null;

  if (storeGet('chatKeywordRegex')) {
    try {
      cache.matcher = new RegExp(list.map((word) => word.replace(/[\\|]/g, (char) => `\\${char}`)).join('|'), 'i');
    } catch {
      cache.matcher = null;
    }
    return cache.matcher;
  }

  const needles = list.map((word) => word.toLowerCase());
  cache.matcher = (text) => {
    const lower = text.toLowerCase();
    return needles.some((needle) => lower.includes(needle));
  };
  return cache.matcher;
}

function clear() {
  for (const line of document.querySelectorAll(`.${CLASS}`)) line.classList.remove(CLASS);
}

// La clase ES el estado, y la caché de keywords se invalida al cambiarlas:
// editar la lista reevalúa los mensajes que ya están en pantalla.
function sweep() {
  const match = buildMatcher();
  if (!match) {
    clear();
    return;
  }
  const container = chatContainer();
  if (!container) return;

  for (const line of chatLines(container)) {
    if (line.classList.contains(CLASS)) continue;
    const text = messageText(line);
    const hit = match instanceof RegExp ? match.test(text) : match(text);
    if (hit) line.classList.add(CLASS);
  }
}

defineFeature({
  id: 'chatKeywordHighlight',
  label: 'Resaltar palabras clave',
  section: 'chat',
  default: false,
  interval: 600,
  settings: [
    { key: 'chatKeywords', label: 'Palabras (separadas por coma)', type: 'text', placeholder: 'hola, clip, raid' },
    { key: 'chatKeywordRegex', label: 'Tratar como regex', type: 'bool', default: false },
  ],
  css: `
    %SCOPE% .twpp-keyword {
      background: rgba(255, 176, 32, .14) !important;
      border-left: 2px solid #ffb020 !important;
      padding-left: 4px !important;
    }
  `,
  tick: sweep,
  onEnable() {
    cache = { key: '', matcher: null };
    clear();
    stop = onChange((key) => {
      if (key !== 'chatKeywords' && key !== 'chatKeywordRegex') return;
      cache = { key: '', matcher: null };
      clear();
      sweep();
    });
    sweep();
  },
  onDisable() {
    stop?.();
    stop = null;
    cache = { key: '', matcher: null };
    clear();
  },
  onRoute() {
    cache = { key: '', matcher: null };
  },
});
return {

};
})();

/* ---- src/features/chat-search.js ---- */
const __m22 = (function () {
const { qs: qs } = __m10;
const { defineFeature: defineFeature } = __m6;
const { get: storeGet } = __m5;
const { chatContainer: chatContainer, chatLines: chatLines, messageText: messageText } = __m20;

/** Buscador dentro del chat: filtra, cuenta y permite saltar entre coincidencias. */





let bar = null;
let matches = [];
let cursor = -1;

function clearMarks() {
  for (const line of document.querySelectorAll('.twpp-chat-hidden, .twpp-chat-dim, .twpp-chat-match, .twpp-chat-current')) {
    line.classList.remove('twpp-chat-hidden', 'twpp-chat-dim', 'twpp-chat-match', 'twpp-chat-current');
  }
  matches = [];
  cursor = -1;
  updateCounter();
}

function updateCounter() {
  if (!bar) return;
  const counter = qs('.twpp-search-count', bar);
  if (!counter) return;
  const total = matches.length;
  counter.textContent = total ? `${cursor + 1}/${total}` : '';
}

function jump(step) {
  if (!matches.length) return;
  cursor = (cursor + step + matches.length) % matches.length;
  for (const line of matches) line.classList.remove('twpp-chat-current');
  const target = matches[cursor];
  target.classList.add('twpp-chat-current');
  target.scrollIntoView({ block: 'center' });
  updateCounter();
}

function buildMatcher(query) {
  if (storeGet('chatSearchRegex')) {
    try {
      return new RegExp(query, 'i');
    } catch {
      return query.toLowerCase();
    }
  }
  return query.toLowerCase();
}

function apply() {
  const input = qs('.twpp-search-input', bar);
  if (!input) return;
  const raw = input.value.trim();
  clearMarks();
  if (!raw) return;

  const container = chatContainer();
  if (!container) return;

  const mode = storeGet('chatSearchMode') === 'dim' ? 'dim' : 'hide';
  const match = buildMatcher(raw);
  const lines = chatLines(container);

  for (const line of lines) {
    const hit = match instanceof RegExp ? match.test(messageText(line)) : messageText(line).toLowerCase().includes(match);
    if (!hit) {
      line.classList.add(mode === 'dim' ? 'twpp-chat-dim' : 'twpp-chat-hidden');
      continue;
    }
    line.classList.add('twpp-chat-match');
    matches.push(line);
  }
  updateCounter();
  if (matches.length) jump(0);
}

function ensureUI() {
  if (bar && bar.isConnected) return bar;
  const container = chatContainer();
  const parent = container?.parentElement;
  if (!parent) return null;

  const node = document.createElement('div');
  node.className = 'twpp-search';
  node.innerHTML =
    '<input class="twpp-search-input" type="text" placeholder="Buscar en el chat…" spellcheck="false" autocomplete="off">' +
    '<span class="twpp-search-count"></span>' +
    '<button class="twpp-search-prev" title="Anterior">↑</button>' +
    '<button class="twpp-search-next" title="Siguiente">↓</button>' +
    '<button class="twpp-search-clear" title="Limpiar">✕</button>';

  parent.insertBefore(node, parent.firstChild);

  const input = qs('.twpp-search-input', node);
  input.addEventListener('input', apply);
  input.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      input.value = '';
      apply();
      input.blur();
    }
    if (event.key === 'Enter') {
      event.preventDefault();
      jump(event.shiftKey ? -1 : 1);
    }
  });
  qs('.twpp-search-clear', node).addEventListener('click', () => {
    input.value = '';
    apply();
    input.focus();
  });
  qs('.twpp-search-next', node).addEventListener('click', () => jump(1));
  qs('.twpp-search-prev', node).addEventListener('click', () => jump(-1));

  bar = node;
  return bar;
}

function destroy() {
  clearMarks();
  bar?.remove();
  bar = null;
}

defineFeature({
  id: 'chatSearch',
  label: 'Buscador de chat',
  section: 'chat',
  default: false,
  interval: 1200,
  settings: [
    { key: 'chatSearchMode', label: 'Modo', type: 'select', options: [['hide', 'Ocultar no coincidencias'], ['dim', 'Atenuar']], default: 'hide' },
    { key: 'chatSearchRegex', label: 'Expresión regular', type: 'bool', default: false },
  ],
  css: `
    %SCOPE% .twpp-search {
      display: flex; align-items: center; gap: 6px;
      padding: 6px 8px; background: #0e0e0e; border-bottom: 1px solid #1b1b1b;
    }
    %SCOPE% .twpp-search-input {
      flex: 1; min-width: 0; padding: 5px 8px;
      background: #060606; color: #efeff1;
      border: 1px solid #2a2a2d; border-radius: 6px;
      font-size: 12px; outline: none; font-family: inherit;
    }
    %SCOPE% .twpp-search-input:focus { border-color: #9147ff; }
    %SCOPE% .twpp-search-count {
      font-size: 11px; color: #adadb8;
      font-variant-numeric: tabular-nums; min-width: 38px; text-align: right;
    }
    %SCOPE% .twpp-search button {
      background: transparent; color: #adadb8; border: none; cursor: pointer;
      padding: 2px 6px; font-size: 12px; border-radius: 4px; line-height: 1;
    }
    %SCOPE% .twpp-search button:hover { background: #1f1f23; color: #efeff1; }
    %SCOPE% .twpp-chat-hidden { display: none !important; }
    %SCOPE% .twpp-chat-dim { opacity: .2 !important; }
    %SCOPE% .twpp-chat-match {
      background: rgba(0, 212, 170, .12) !important;
      border-left: 2px solid #00d4aa !important;
      padding-left: 4px !important;
    }
    %SCOPE% .twpp-chat-current { box-shadow: inset 2px 0 0 #00d4aa !important; }
  `,
  tick() {
    if (!ensureUI()) return;
    const input = qs('.twpp-search-input', bar);
    if (input && input.value.trim()) apply();
  },
  onDisable: destroy,
  onRoute: destroy,
});
return {

};
})();

/* ---- src/features/clean-mode.js ---- */
const __m23 = (function () {
const { defineFeature: defineFeature } = __m6;

defineFeature({
  id: 'cleanMode',
  label: 'Modo limpio',
  section: 'clean',
  default: true,
  css: `
    %SCOPE% [data-a-target="prime-offer"],
    %SCOPE% .prime-offer, .prime-offer-offer,
    %SCOPE% [data-test-selector="prime-offer"],
    %SCOPE% [data-a-target="upsell-banner"],
    %SCOPE% [data-test-selector="subscription-upsell"],
    %SCOPE% [data-a-target="chat-input-upsell"],
    %SCOPE% .chat-input__upsell,
    %SCOPE% [data-a-target="chat-room-header-prime-offer"],
    %SCOPE% [data-test-selector="chat-room-header-prime-offer"],
    %SCOPE% [data-a-target="gift-sub-banner"],
    %SCOPE% [data-test-selector="gift-sub-banner"],
    %SCOPE% [data-a-target="bits-upsell"],
    %SCOPE% [data-test-selector="bits-upsell-banner"],
    %SCOPE% [data-a-target="watch-streak-notification"],
    %SCOPE% [data-a-target="prime-gaming-button"],
    %SCOPE% [data-test-selector="prime-gaming"] { display: none !important; }
  `,
});
return {

};
})();

/* ---- src/features/dark-mode.js ---- */
const __m24 = (function () {
const { defineFeature: defineFeature } = __m6;
const { get: storeGet } = __m5;
const { isDarkTheme: isDarkTheme } = __m20;

defineFeature({
  id: 'darkMode',
  label: 'Tema OLED',
  section: 'visual',
  default: true,
  // Si el usuario está con el tema claro de Twitch, OLED no se impone: se
  // respeta su elección y el tick reevalúa la condición al cambiar el tema.
  when: () => !storeGet('respectTwitchTheme') || isDarkTheme(),
  interval: 1500,
  settings: [
    { key: 'respectTwitchTheme', label: 'Solo en tema oscuro de Twitch', type: 'bool', default: true },
  ],
  css: `
    %SCOPE% {
      --color-background-body: #000000 !important;
      --color-background-base: #000000 !important;
      --color-background-alt: #060606 !important;
      --color-background-alt-2: #0b0b0b !important;
      --color-background-float: #0b0b0b !important;
      --color-background-overlay: #000000 !important;
      --color-background-input: #0e0e0e !important;
      --color-background-input-hover: #141414 !important;
      --color-background-input-focus: #141414 !important;
      --color-background-button-secondary-default: #101010 !important;
      --color-background-button-secondary-hover: #1a1a1a !important;
      --color-background-button-secondary-active: #1f1f23 !important;
      --color-background-interactable-default: rgba(255,255,255,0.04) !important;
      --color-background-interactable-hover: rgba(255,255,255,0.08) !important;
      --color-background-interactable-active: rgba(255,255,255,0.12) !important;
      --color-background-tag-default: #1f1f23 !important;
      --color-border-base: #1b1b1b !important;
      --color-border-alt: #141414 !important;
      --color-border-input: #2a2a2d !important;
      --color-border-input-hover: #3a3a3d !important;
      --color-border-input-focus: #9147ff !important;
      --color-text-base: #efeff1 !important;
      --color-text-alt: #adadb8 !important;
      --color-text-alt-2: #7d7d88 !important;
      --color-text-link: #bf94ff !important;
      --color-text-link-hover: #d0b3ff !important;
      --shadow-elevation-1: 0 1px 2px rgba(0,0,0,0.9) !important;
      --shadow-elevation-2: 0 4px 8px rgba(0,0,0,0.9) !important;
      background-color: #000000 !important;
    }
    %SCOPE% body,
    %SCOPE% #root,
    %SCOPE% .tw-root--theme-dark { background-color: #000000 !important; }
    %SCOPE% [data-a-target="top-nav-container"],
    %SCOPE% .top-nav {
      background-color: #000000 !important;
      border-bottom-color: #1b1b1b !important;
    }
    %SCOPE% [data-a-target="side-nav-bar"],
    %SCOPE% .side-nav,
    %SCOPE% [data-test-selector="side-nav"] {
      background-color: #000000 !important;
      border-right-color: #1b1b1b !important;
    }
    %SCOPE% .side-nav-card:hover,
    %SCOPE% [data-a-target="side-nav-card"]:hover { background-color: #0b0b0b !important; }
    %SCOPE% [data-a-target="video-player"],
    %SCOPE% .video-player,
    %SCOPE% .persistent-player,
    %SCOPE% [data-a-target="persistent-player"] { background-color: #000000 !important; }
    %SCOPE% .video-player__container { border-radius: 0 !important; }
    %SCOPE% .chat-scrollable-area__message-container,
    %SCOPE% [data-test-selector="chat-scrollable-area__message-container"],
    %SCOPE% [data-a-target="chat-scrollable-area"] { background-color: #000000 !important; }
    %SCOPE% .chat-input,
    %SCOPE% [data-a-target="chat-input"] {
      background-color: #0e0e0e !important;
      border-color: #2a2a2d !important;
    }
    %SCOPE% [role="menu"],
    %SCOPE% [role="dialog"],
    %SCOPE% [role="listbox"],
    %SCOPE% .tw-dialog-layer,
    %SCOPE% .tw-balloon,
    %SCOPE% .tw-tooltip {
      background-color: #0b0b0b !important;
      border-color: #2a2a2d !important;
      color: #efeff1 !important;
    }
    %SCOPE% *::-webkit-scrollbar-track { background: #060606 !important; }
    %SCOPE% *::-webkit-scrollbar-thumb { background: #1b1b1b !important; border-radius: 4px; }
    %SCOPE% *::-webkit-scrollbar-thumb:hover { background: #2a2a2d !important; }
  `,
});

defineFeature({
  id: 'oledContrast',
  label: 'Contraste OLED alto',
  section: 'visual',
  default: false,
  css: `
    %SCOPE% {
      --color-text-base: #ffffff !important;
      --color-text-alt: #d3d3d9 !important;
      --color-text-alt-2: #a4a4ae !important;
      --color-border-base: #2a2a2d !important;
      --color-border-alt: #1f1f23 !important;
    }
    %SCOPE% a,
    %SCOPE% button { font-weight: 500 !important; }
  `,
});
return {

};
})();

/* ---- src/features/hide-blocks.js ---- */
const __m25 = (function () {
const { defineFeature: defineFeature } = __m6;

defineFeature({
  id: 'hideSidebar',
  label: 'Sin barra lateral',
  section: 'clean',
  default: false,
  css: `
    %SCOPE% [data-a-target="side-nav-bar"],
    %SCOPE% .side-nav,
    %SCOPE% [data-test-selector="side-nav"] { display: none !important; }
  `,
});

defineFeature({
  id: 'hideViewerCount',
  label: 'Sin contador de viewers',
  section: 'clean',
  default: false,
  css: `
    %SCOPE% strong[data-a-target="animated-channel-viewers-count"],
    %SCOPE% [data-test-selector="viewer-count"],
    %SCOPE% .channel-info-bar__viewers,
    %SCOPE% [data-a-target="channel-viewer-count"],
    %SCOPE% [data-a-target="animated-channel-viewers-count"] { display: none !important; }
  `,
});

defineFeature({
  id: 'hideUpNext',
  label: 'Sin "A continuación"',
  section: 'clean',
  default: true,
  css: `
    %SCOPE% [data-a-target="up-next-queue"],
    %SCOPE% [data-test-selector="up-next-queue"],
    %SCOPE% [data-a-target="autoplay-toggle"],
    %SCOPE% [data-test-selector="autoplay"],
    %SCOPE% [data-a-target="recommended-channels"],
    %SCOPE% [data-test-selector="recommended-channels"],
    %SCOPE% [data-a-target="recommended-streams"],
    %SCOPE% [data-test-selector="recommended-streams"],
    %SCOPE% .up-next-queue { display: none !important; }
  `,
});

defineFeature({
  id: 'hideStories',
  label: 'Sin Stories',
  section: 'clean',
  default: true,
  css: `
    %SCOPE% [data-a-target="stories-tray"],
    %SCOPE% .stories-tray,
    %SCOPE% [data-test-selector="stories-tray"],
    %SCOPE% [data-a-target="stories-button"],
    %SCOPE% [data-test-selector="stories"] { display: none !important; }
  `,
});
return {

};
})();

/* ---- src/features/hide-chat-extras.js ---- */
const __m26 = (function () {
const { defineFeature: defineFeature } = __m6;

defineFeature({
  id: 'hideChatExtras',
  label: 'Sin Bits / normas chat',
  section: 'chat',
  default: true,
  css: `
    %SCOPE% [data-a-target="bits-button"],
    %SCOPE% [data-test-selector="bits-button"],
    %SCOPE% [data-a-target="chat-rules-button"],
    %SCOPE% [data-test-selector="chat-rules-button"],
    %SCOPE% [data-a-target="chat-commands-button"],
    %SCOPE% [data-test-selector="chat-commands-button"] { display: none !important; }
  `,
});
return {

};
})();

/* ---- src/features/hide-extensions.js ---- */
const __m27 = (function () {
const { qsAll: qsAll } = __m10;
const { log: log } = __m2;
const { defineFeature: defineFeature } = __m6;
const { selectAll: selectAll } = __m3;
const { get: storeGet } = __m5;

/**
 * Sin extensiones.
 *
 * El CSS se encarga de los casos conocidos. La parte JS cubre lo que Twitch
 * renderiza dinámicamente (iframes y overlays de extensiones) y, de forma
 * opt-in, los botones desconocidos del player mediante una allowlist de iconos
 * que se puede ampliar sin tocar código.
 */






const EXTENSION_HINT = /extension|ext-twitch|\/extensions\/|extension-panel|twitch-ext-/i;

const KNOWN_PLAYER_ICONS =
  /Icon-(Settings|Gear|Volume|Fullscreen|Theater|Pause|Play|Mute|Unmute|Rewind|Forward|Quality|Clip|Share|Subscribe|Follow|Bits|Prime|Notifications|Messages|Search|Menu|Close|Chevron|Arrow|Drops|Points|Reward|Emote|Mod|Chat|Crown|Heart|Rerun|Pin|Mute-User|Bit|Hype|Extension|Collapse|Expand|Info|Rec|Resume|Exit)/i;

const known = new Set();
const removed = new Set();

function kill(element) {
  if (!element || removed.has(element)) return;
  removed.add(element);
  element.style.setProperty('display', 'none', 'important');
}

function restore() {
  for (const node of removed) {
    node.style?.removeProperty('display');
  }
  removed.clear();
}

function extensionLike(element) {
  const hay = [
    element.getAttribute?.('src') || '',
    element.getAttribute?.('id') || '',
    element.getAttribute?.('title') || '',
    element.getAttribute?.('class') || '',
    element.getAttribute?.('data-test-selector') || '',
  ]
    .join(' ')
    .toLowerCase();
  return EXTENSION_HINT.test(hay);
}

function playerOverlaySweep() {
  for (const player of selectAll('player')) {
    for (const frame of qsAll('iframe', player)) {
      if (extensionLike(frame)) kill(frame);
    }
    for (const box of qsAll('div', player)) {
      if (!/overlay/.test(box.className || '')) continue;
      if (!box.querySelector('iframe')) continue;
      kill(box);
    }
  }
}

function unknownButtonSweep() {
  const extra = String(storeGet('extensionExtras') || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  for (const player of selectAll('player')) {
    for (const button of qsAll('button', player)) {
      if (removed.has(button)) continue;
      const svg = button.querySelector('svg');
      const signature = (svg?.getAttribute('class') || '').match(/\bIcon-[A-Za-z0-9_-]+\b/);
      if (!signature) continue;
      if (KNOWN_PLAYER_ICONS.test(signature[0])) continue;
      if (extra.some((needle) => signature[0].toLowerCase().includes(needle.toLowerCase()))) {
        kill(button);
        continue;
      }
      if (known.has(signature[0])) {
        kill(button);
        continue;
      }
      known.add(signature[0]);
      log('icono nuevo en el player (oculto por heurística):', signature[0]);
    }
  }
}

defineFeature({
  id: 'hideExtensions',
  label: 'Sin extensiones',
  section: 'clean',
  default: true,
  interval: 1500,
  settings: [
    { key: 'extensionHeuristic', label: 'Ocultar botones desconocidos del player', type: 'bool', default: true },
    { key: 'extensionExtras', label: 'Iconos extra a ocultar (separados por coma)', type: 'text', placeholder: 'Icon-Promo, Icon-Quest' },
  ],
  css: `
    %SCOPE% button.Navigation__open,
    %SCOPE% [class*="Navigation__open"],
    %SCOPE% button[data-a-target="extensions-button"],
    %SCOPE% button[data-test-selector="extensions-button"],
    %SCOPE% [data-a-target="extensions-button"],
    %SCOPE% [data-test-selector="extensions-button"],
    %SCOPE% [aria-label*="Extension" i],
    %SCOPE% [aria-label*="extensión" i],
    %SCOPE% [data-a-target="extensions-menu"],
    %SCOPE% [data-test-selector="extensions-menu"],
    %SCOPE% [data-test-selector="extensions-panel"],
    %SCOPE% [data-a-target="extensions-panel"],
    %SCOPE% [data-test-selector="extension-panel"],
    %SCOPE% [data-a-target="extension-panel"],
    %SCOPE% [data-a-target="video-extension-overlay"],
    %SCOPE% [data-test-selector="video-extension-overlay"],
    %SCOPE% [data-a-target="extension-overlay"],
    %SCOPE% [data-test-selector="extension-overlay"],
    %SCOPE% [data-a-target="extension-view"],
    %SCOPE% [data-test-selector="extension-view"],
    %SCOPE% .video-extension-overlay,
    %SCOPE% .extension-overlay,
    %SCOPE% .extensions-overlay,
    %SCOPE% .extension-view,
    %SCOPE% [class*="video-extension"],
    %SCOPE% [class*="extension-overlay"],
    %SCOPE% [class*="extensions-overlay"],
    %SCOPE% [class*="ExtensionOverlay"],
    %SCOPE% [class*="extension-view"],
    %SCOPE% [data-test-selector="extension-component"],
    %SCOPE% [data-a-target="extension-component"],
    %SCOPE% [class*="extension-component"],
    %SCOPE% [id^="twitch-ext-"],
    %SCOPE% [id*="extension-iframe"],
    %SCOPE% [id*="extension-overlay"],
    %SCOPE% iframe[src*="extension"],
    %SCOPE% iframe[src*="ext-twitch"],
    %SCOPE% iframe[src*="/extensions/"],
    %SCOPE% iframe[id*="extension"],
    %SCOPE% iframe[id^="twitch-ext-"],
    %SCOPE% iframe[title*="Extension" i],
    %SCOPE% iframe[data-test-selector*="extension"],
    %SCOPE% [data-test-selector="extension-banner"],
    %SCOPE% [data-a-target="extension-banner"],
    %SCOPE% .extension-banner,
    %SCOPE% [data-test-selector="extension-slot"],
    %SCOPE% [class*="extensions-dock"],
    %SCOPE% [class*="extension-dock"] { display: none !important; }
  `,
  tick() {
    playerOverlaySweep();
    if (storeGet('extensionHeuristic')) unknownButtonSweep();
  },
  onDisable: restore,
});
return {

};
})();

/* ---- src/features/hide-offline-channels.js ---- */
const __m28 = (function () {
const { qs: qs } = __m10;
const { defineFeature: defineFeature } = __m6;
const { selectAll: selectAll } = __m3;

/** Oculta cards de la sidebar cuyo canal está offline. */




const ATTR = 'data-twpp-offline';

function isOffline(card) {
  if (qs('[class*="offline"], [class*="Offline"]', card)) return true;
  if (qs('[data-test-selector*="offline"]', card)) return true;
  if (/offline|desconectado/i.test(card.getAttribute?.('aria-label') || '')) return true;
  return false;
}

// El atributo ES el estado: nada de WeakSet, así volver a habilitar, cambiar de
// canal o reconectar el canal se refleja sin recargar.
function sweep() {
  for (const card of selectAll('sideNav.card')) {
    if (card.getAttribute(ATTR) === '1') continue;
    card.setAttribute(ATTR, isOffline(card) ? '1' : '0');
  }
}

function clear() {
  for (const card of selectAll('sideNav.card')) card.removeAttribute(ATTR);
}

defineFeature({
  id: 'hideOfflineChannels',
  label: 'Ocultar offline en sidebar',
  section: 'sidebar',
  default: false,
  interval: 2000,
  css: `
    %SCOPE% [data-a-target="side-nav-card"][data-twpp-offline="1"],
    %SCOPE% .side-nav-card[data-twpp-offline="1"] { display: none !important; }
  `,  tick: sweep,
  onEnable: sweep,
  onDisable: clear,
  onRoute: clear,
});
return {

};
})();

/* ---- src/features/mention-highlight.js ---- */
const __m29 = (function () {
const { defineFeature: defineFeature } = __m6;
const { chatContainer: chatContainer, chatLines: chatLines, currentUsername: currentUsername, messageText: messageText } = __m20;

/** Resalta los mensajes que te mencionan. */



const CLASS = 'twpp-mention';
let username = null;
let pattern = null;

function detectUsername() {
  if (username) return username;
  username = currentUsername();
  if (!username) return null;
  pattern = new RegExp(`@?${username.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'i');
  return username;
}

// La clase ES el estado: si el usuario se detecta tarde o cambia de cuenta,
// los mensajes ya marcados se reevalúan solos.
function sweep() {
  if (!detectUsername()) return;
  const container = chatContainer();
  if (!container) return;
  for (const line of chatLines(container)) {
    if (line.classList.contains(CLASS)) continue;
    if (pattern.test(messageText(line))) line.classList.add(CLASS);
  }
}

function clear() {
  for (const line of document.querySelectorAll(`.${CLASS}`)) line.classList.remove(CLASS);
}

defineFeature({
  id: 'mentionHighlight',
  label: 'Resaltar menciones',
  section: 'chat',
  default: false,
  interval: 700,
  css: `
    %SCOPE% .twpp-mention {
      background: rgba(145, 71, 255, .18) !important;
      border-left: 3px solid #9147ff !important;
      padding-left: 6px !important;
    }
  `,
  tick: sweep,
  onEnable() {
    username = null;
    pattern = null;
    sweep();
  },
  onDisable: clear,
  onRoute() {
    username = null;
    pattern = null;
  },
});
return {

};
})();

/* ---- src/features/sidebar-compact.js ---- */
const __m30 = (function () {
const { defineFeature: defineFeature } = __m6;
const { get: storeGet, onChange: onChange } = __m5;

let stop = null;

function applyWidth() {
  const raw = Number(storeGet('sidebarWidth'));
  const width = Number.isFinite(raw) ? Math.min(120, Math.max(50, raw)) : 72;
  document.documentElement.style.setProperty('--twpp-sidebar-width', `${width}px`);
}

defineFeature({
  id: 'sidebarCompact',
  label: 'Sidebar compacta',
  section: 'sidebar',
  default: false,
  settings: [{ key: 'sidebarWidth', label: 'Ancho (px)', type: 'number', default: 72, min: 50, max: 120 }],
  css: `
    %SCOPE% [data-a-target="side-nav-bar"],
    %SCOPE% .side-nav,
    %SCOPE% [data-test-selector="side-nav"],
    %SCOPE% nav[aria-label="Primary navigation"] {
      width: var(--twpp-sidebar-width, 72px) !important;
      min-width: var(--twpp-sidebar-width, 72px) !important;
      max-width: var(--twpp-sidebar-width, 72px) !important;
    }
    %SCOPE% [data-a-target="side-nav-card"] > *:not(:first-child),
    %SCOPE% .side-nav-card > *:not(:first-child) { display: none !important; }
    %SCOPE% [data-a-target="side-nav-card"] p,
    %SCOPE% .side-nav-card p,
    %SCOPE% [data-a-target="side-nav-card"] span,
    %SCOPE% .side-nav-card span { display: none !important; }
    %SCOPE% [data-a-target="side-nav-card"],
    %SCOPE% .side-nav-card {
      justify-content: center !important;
      padding: 6px !important;
    }
    %SCOPE% [data-a-target="side-nav-card"] [data-a-target="side-nav-card-viewer-count"],
    %SCOPE% .side-nav-card [class*="viewer-count"] { display: none !important; }
    %SCOPE% [data-a-target="side-nav-bar"] [data-a-target="side-nav-more"],
    %SCOPE% .side-nav__more,
    %SCOPE% [data-a-target="side-nav-bar"] h3,
    %SCOPE% [data-a-target="side-nav-bar"] h4 { display: none !important; }
    %SCOPE% [data-a-target="side-nav-bar"] a[data-a-target="side-nav-link"] > :not(svg):not(img):not(div:first-child) {
      display: none !important;
    }
  `,
  onEnable() {
    applyWidth();
    stop = onChange(applyWidth);
  },
  onDisable() {
    stop?.();
    stop = null;
    document.documentElement.style.removeProperty('--twpp-sidebar-width');
  },
});
return {

};
})();

/* ---- src/features/sidebar-thumbnails.js ---- */
const __m31 = (function () {
const { qs: qs } = __m10;
const { log: log } = __m2;
const { defineFeature: defineFeature } = __m6;
const { selectAll: selectAll } = __m3;
const { get: storeGet } = __m5;
const { channelFromCard: channelFromCard, thumbnailUrl: thumbnailUrl, visibleChannels: visibleChannels, waitForHoverDialog: waitForHoverDialog } = __m20;

/** Miniaturas de canal al pasar el ratón por una card de la sidebar. */







const cache = new Map();
const bound = new WeakSet();
let generation = 0;

function ttl() {
  const seconds = Number(storeGet('thumbCacheTtl'));
  return (Number.isFinite(seconds) ? seconds : 60) * 1000;
}

function width() {
  const value = Number(storeGet('thumbWidth'));
  return Number.isFinite(value) ? value : 440;
}

function preload(channel) {
  if (!channel) return;
  const now = Date.now();
  const stamp = cache.get(channel);
  if (stamp && now - stamp < ttl()) return;
  cache.set(channel, now);
  const image = new Image();
  image.decoding = 'async';
  image.src = thumbnailUrl(channel, width());
}

function preloadVisible(limit = 8) {
  for (const channel of visibleChannels(limit)) preload(channel);
}

function inject(card, channel) {
  const local = generation;
  waitForHoverDialog().then((dialog) => {
    if (!dialog || !dialog.isConnected || local !== generation) return;
    const existing = qs('img.twpp-sidebar-thumb', dialog);
    if (existing) existing.remove();
    const image = document.createElement('img');
    image.className = 'twpp-sidebar-thumb';
    image.decoding = 'async';
    image.src = thumbnailUrl(channel, width());
    image.style.cssText = 'width:100%;display:block;border-radius:4px;margin-top:8px;';
    image.addEventListener('error', () => image.remove(), { once: true });
    dialog.append(image);
  });
}

function bind(card) {
  if (bound.has(card)) return;
  bound.add(card);
  let timer = null;
  card.addEventListener('mouseenter', () => {
    generation += 1;
    const channel = channelFromCard(card);
    if (!channel) return;
    clearTimeout(timer);
    timer = setTimeout(() => preload(channel), 120);
    inject(card, channel);
  });
  card.addEventListener('mouseleave', () => clearTimeout(timer));
}

function sweep() {
  for (const card of selectAll('sideNav.card')) bind(card);
  for (const group of selectAll('sideNav.group')) {
    for (const child of group.children) bind(child);
  }
}

function teardown() {
  for (const node of document.querySelectorAll('img.twpp-sidebar-thumb')) node.remove();
  cache.clear();
}

defineFeature({
  id: 'sidebarThumbnailPreview',
  label: 'Miniatura en sidebar',
  section: 'sidebar',
  default: false,
  interval: 2500,
  settings: [
    { key: 'thumbWidth', label: 'Tamaño de miniatura', type: 'select', options: [['220', '220x248'], ['440', '440x248'], ['720', '720x405']], default: '440' },
    { key: 'thumbCacheTtl', label: 'Caché (segundos)', type: 'number', default: 60, min: 0, max: 3600 },
  ],
  tick: sweep,
  onEnable() {
    sweep();
    setTimeout(() => preloadVisible(8), 2000);
    log('miniaturas de sidebar activas');
  },
  onDisable: teardown,
  onRoute() {
    generation += 1;
    teardown();
  },
});
return {

};
})();

/* ---- src/features/theater-clean.js ---- */
const __m32 = (function () {
const { defineFeature: defineFeature } = __m6;

defineFeature({
  id: 'theaterClean',
  label: 'Teatro limpio',
  section: 'visual',
  default: false,
  css: `
    %SCOPE% [data-a-target="top-nav-container"],
    %SCOPE% .top-nav {
      opacity: 0 !important;
      transition: opacity .25s ease !important;
    }
    %SCOPE% [data-a-target="top-nav-container"]:hover,
    %SCOPE% [data-a-target="top-nav-container"]:focus-within,
    %SCOPE% .top-nav:hover,
    %SCOPE% .top-nav:focus-within { opacity: 1 !important; }
    %SCOPE% .persistent-player,
    %SCOPE% [data-a-target="persistent-player"] {
      background-color: #000 !important;
      border-bottom: none !important;
      box-shadow: none !important;
    }
    %SCOPE% .video-player__container,
    %SCOPE% [data-a-target="video-player"] { border-radius: 0 !important; }
  `,
});
return {

};
})();

/* ---- src/features/viewer-analytics.js ---- */
const __m33 = (function () {
const { defineFeature: defineFeature } = __m6;
const { get: storeGet } = __m5;
const { chatContainer: chatContainer, chatLines: chatLines, usernameOf: usernameOf, viewerCount: viewerCount } = __m20;

/** Contador real de viewers + chatters activos por ventana deslizante. */




const chatters = new Map();
const counted = new WeakSet();
let badge = null;
let lastUpdate = 0;

const UPDATE_EVERY = 4000;

function windowMs() {
  const seconds = Number(storeGet('viewerWindow'));
  return (Number.isFinite(seconds) && seconds > 0 ? seconds : 60) * 1000;
}

function warnAt() {
  return Number(storeGet('viewerRatioWarn')) || 80;
}

function dangerAt() {
  const value = Number(storeGet('viewerRatioDanger'));
  return Number.isFinite(value) && value > 0 ? value : 200;
}

function sweep() {
  const container = chatContainer();
  if (!container) return;
  const now = Date.now();
  for (const line of chatLines(container)) {
    if (counted.has(line)) continue;
    counted.add(line);
    const user = usernameOf(line);
    if (user) chatters.set(user, now);
  }
  const cutoff = now - windowMs();
  for (const [user, ts] of chatters) {
    if (ts < cutoff) chatters.delete(user);
  }
}

function ensureBadge() {
  if (badge && badge.isConnected) return badge;
  const target = document.querySelector(
    'strong[data-a-target="animated-channel-viewers-count"], [data-test-selector="viewer-count"], .channel-info-bar__viewers',
  );
  if (!target || !target.parentElement) return null;

  const node = document.createElement('span');
  node.className = 'twpp-viewer-badge';
  node.innerHTML =
    '<span class="twpp-viewer-total" title="Viewers según Twitch">—</span>' +
    '<span class="twpp-viewer-chatters" title="Chatters activos">—</span>' +
    '<span class="twpp-viewer-ratio" title="Ratio viewers / chatters">—</span>';
  target.parentElement.insertBefore(node, target.nextSibling);
  badge = node;
  return badge;
}

function format(value) {
  return value === null ? '—' : value.toLocaleString('es-ES');
}

function update() {
  const node = ensureBadge();
  if (!node) return;
  const viewers = viewerCount();
  const active = chatters.size;

  node.querySelector('.twpp-viewer-total').textContent = format(viewers);
  node.querySelector('.twpp-viewer-chatters').textContent = format(active);

  const ratio = node.querySelector('.twpp-viewer-ratio');
  if (viewers && active) {
    const value = viewers / active;
    ratio.textContent = `1:${value.toFixed(1)}`;
    node.classList.toggle('warn', value > warnAt() && value <= dangerAt());
    node.classList.toggle('danger', value > dangerAt());
  } else {
    ratio.textContent = '—';
    node.classList.remove('warn', 'danger');
  }
}

function teardown() {
  badge?.remove();
  badge = null;
  chatters.clear();
}

defineFeature({
  id: 'viewerAnalytics',
  label: 'Contador real + chatters',
  section: 'chat',
  default: false,
  interval: 1500,
  settings: [
    { key: 'viewerWindow', label: 'Ventana de chatters (s)', type: 'number', default: 60, min: 5, max: 600 },
    { key: 'viewerRatioWarn', label: 'Ratio aviso', type: 'number', default: 80, min: 1, max: 10000 },
    { key: 'viewerRatioDanger', label: 'Ratio crítico', type: 'number', default: 200, min: 1, max: 10000 },
  ],
  css: `
    %SCOPE% .twpp-viewer-badge {
      display: inline-flex; align-items: center; gap: 6px;
      margin-left: 8px; padding: 2px 8px;
      background: rgba(145, 71, 255, .15);
      border: 1px solid rgba(145, 71, 255, .4);
      border-radius: 4px; font-size: 11px; font-weight: 600;
      color: #dedee3; vertical-align: middle; line-height: 1.4; white-space: nowrap;
    }
    %SCOPE% .twpp-viewer-badge .twpp-viewer-total { color: #efeff1; }
    %SCOPE% .twpp-viewer-badge .twpp-viewer-chatters { color: #00d4aa; }
    %SCOPE% .twpp-viewer-badge .twpp-viewer-ratio { color: #adadb8; font-weight: 400; }
    %SCOPE% .twpp-viewer-badge.warn .twpp-viewer-ratio { color: #ffb020; }
    %SCOPE% .twpp-viewer-badge.danger .twpp-viewer-ratio { color: #ff5c5c; }
  `,
  tick(now) {
    sweep();
    if (now - lastUpdate < UPDATE_EVERY) return;
    lastUpdate = now;
    update();
  },
  onEnable() {
    chatters.clear();
    lastUpdate = 0;
    setTimeout(update, 400);
  },
  onDisable: teardown,
  onRoute() {
    chatters.clear();
    lastUpdate = 0;
    badge = null;
  },
});
return {

};
})();

/* ---- src/features/index.js ---- */
const __m34 = (function () {
/**
 * Índice de features.
 *
 * Cada módulo se registra solo con `defineFeature`, así que añadir una feature
 * nueva = un archivo nuevo + una línea aquí.
 */
return {

};
})();

/* ---- src/ui/panel-css.js ---- */
const __m35 = (function () {
const PANEL_CSS = `
  :host { all: initial; }
  * { box-sizing: border-box; font-family: "Inter","Roobert",-apple-system,"Segoe UI",Roboto,sans-serif; }
  .wrap { display: flex; flex-direction: column; align-items: flex-end; gap: 10px; }
  .toasts {
    position: fixed; right: 14px; bottom: 52px;
    display: flex; flex-direction: column; gap: 6px;
    pointer-events: none; z-index: 10;
  }
  .toast {
    background: #9147ff; color: #fff; padding: 7px 12px; border-radius: 6px;
    font-size: 12px; font-weight: 600; box-shadow: 0 4px 14px rgba(0,0,0,.5);
    opacity: 0; transform: translateY(6px);
    transition: opacity .2s ease, transform .2s ease;
  }
  .toast.in { opacity: 1; transform: translateY(0); }
  .fab {
    width: 26px; height: 26px; border: none; border-radius: 50%;
    background: #9147ff; color: #fff; font-size: 11px; font-weight: 800;
    letter-spacing: -1px; cursor: pointer; opacity: .18; padding: 0;
    box-shadow: 0 3px 10px rgba(0,0,0,.4);
    transition: opacity .25s ease, transform .18s ease, background .18s ease;
  }
  .fab:hover { opacity: 1; transform: scale(1.15); background: #a970ff; }
  .fab.awake { opacity: .55; }
  .fab.active { background: #ff5c5c; opacity: .9; }
  .fab.dragging { cursor: grabbing !important; opacity: .8; transform: scale(1.1); }
  .fab.flash { opacity: .65; }
  .panel {
    width: 300px; max-height: 80vh; display: flex; flex-direction: column;
    background: #0e0e10; border: 1px solid #2a2a2d; border-radius: 10px;
    box-shadow: 0 8px 28px rgba(0,0,0,.65); overflow: hidden;
    color: #efeff1; font-size: 12.5px; user-select: none;
  }
  .panel[hidden] { display: none; }
  .head {
    display: flex; align-items: center; justify-content: space-between;
    padding: 9px 12px; background: #18181b; border-bottom: 1px solid #2a2a2d;
    font-weight: 700; font-size: 13px;
  }
  .head .plus { color: #9147ff; }
  .ver { font-size: 10.5px; font-weight: 400; color: #adadb8; }
  .toolbar { display: flex; gap: 6px; padding: 8px 10px; background: #111114; border-bottom: 1px solid #2a2a2d; }
  .search, .preset {
    background: #0e0e10; color: #efeff1; border: 1px solid #3a3a3d;
    border-radius: 6px; padding: 5px 8px; font-size: 11.5px; outline: none;
  }
  .search { flex: 1; }
  .search:focus, .preset:focus { border-color: #9147ff; }
  .body { flex: 1; overflow-y: auto; padding: 4px 12px 10px; }
  .body::-webkit-scrollbar { width: 8px; }
  .body::-webkit-scrollbar-thumb { background: #2a2a2d; border-radius: 4px; }
  .section { margin-top: 4px; }
  .section-title {
    font-size: 10px; font-weight: 700; letter-spacing: .08em; text-transform: uppercase;
    color: #9147ff; margin: 8px 0 4px; cursor: pointer;
    display: flex; align-items: center; justify-content: space-between;
  }
  .section-title::after { content: "▾"; font-size: 10px; opacity: .6; transition: transform .18s ease; }
  .section.collapsed .section-title::after { transform: rotate(-90deg); }
  .section.collapsed .section-body { display: none; }
  .row { display: flex; align-items: center; justify-content: space-between; padding: 6px 0; color: #dedee3; }
  .row.label { cursor: pointer; }
  .row.label:hover { color: #fff; }
  .row input[type="checkbox"] {
    appearance: none; width: 32px; height: 17px; border-radius: 999px;
    background: #3a3a3d; position: relative; cursor: pointer; flex: 0 0 auto; margin: 0;
    transition: background .18s ease;
  }
  .row input[type="checkbox"]::after {
    content: ""; position: absolute; top: 2px; left: 2px; width: 13px; height: 13px;
    border-radius: 50%; background: #fff; transition: transform .18s ease;
  }
  .row input[type="checkbox"]:checked { background: #9147ff; }
  .row input[type="checkbox"]:checked::after { transform: translateX(15px); }
  .settings { padding: 0 0 6px 2px; display: flex; flex-direction: column; gap: 4px; }
  .settings[hidden] { display: none; }
  .setting { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
  .setting > span { color: #adadb8; font-size: 11.5px; }
  .setting input[type="text"], .setting input[type="number"], .setting select {
    flex: 1; min-width: 0; max-width: 170px; padding: 4px 6px;
    background: #0e0e10; color: #efeff1; border: 1px solid #3a3a3d;
    border-radius: 5px; font-size: 11.5px; outline: none;
  }
  .setting input[type="text"]:focus, .setting input[type="number"]:focus, .setting select:focus { border-color: #9147ff; }
  .setting .check { margin: 0; }
  .kb-input {
    width: 88px; padding: 3px 6px; background: #0e0e10; color: #efeff1;
    border: 1px solid #3a3a3d; border-radius: 4px; font-size: 11px;
    font-family: ui-monospace, Menlo, monospace; outline: none; text-align: center;
  }
  .kb-input:focus { border-color: #9147ff; }
  .badge-remote { font-size: 9px; color: #00d4aa; border: 1px solid rgba(0,212,170,.5); border-radius: 3px; padding: 0 3px; margin-left: 4px; }
  .actions { padding: 8px 12px; background: #111114; border-top: 1px solid #2a2a2d; display: flex; flex-direction: column; gap: 6px; }
  .action-btn {
    width: 100%; padding: 7px 10px; border: 1px solid #3a3a3d; border-radius: 6px;
    background: #1f1f23; color: #efeff1; font-size: 12px; font-weight: 600; cursor: pointer;
    transition: background .15s ease, border-color .15s ease;
  }
  .action-btn:hover { background: #26262b; border-color: #9147ff; }
  .action-btn.on { background: #9147ff; border-color: #9147ff; color: #fff; }
  .action-btn:disabled { opacity: .5; cursor: default; }
  .action-row { display: flex; gap: 6px; }
  .action-row .action-btn { flex: 1; padding: 6px 4px; font-size: 11px; }
  .foot { padding: 6px 12px; background: #18181b; border-top: 1px solid #2a2a2d; font-size: 10px; color: #7d7d88; text-align: center; }
  .note { padding: 0 12px 8px; font-size: 10.5px; color: #7d7d88; background: #111114; }
  .note[hidden] { display: none; }
`;
return {
  PANEL_CSS: PANEL_CSS,
};
})();

/* ---- src/ui/presets.js ---- */
const __m36 = (function () {
/** Presets: un clic y la config queda como quieres. */
const PRESETS = {
  minimal: ['darkMode', 'cleanMode', 'autoClaim'],
  balanced: [
    'darkMode',
    'cleanMode',
    'hideExtensions',
    'hideUpNext',
    'hideStories',
    'hideChatExtras',
    'autoClaim',
    'sidebarThumbnailPreview',
  ],
  aggressive: [
    'darkMode',
    'oledContrast',
    'cleanMode',
    'theaterClean',
    'hideExtensions',
    'hideSidebar',
    'hideViewerCount',
    'hideUpNext',
    'hideStories',
    'hideChatExtras',
    'autoClaim',
    'mentionHighlight',
    'viewerAnalytics',
    'sidebarThumbnailPreview',
    'sidebarCompact',
    'hideOfflineChannels',
    'chatSearch',
    'chatKeywordHighlight',
  ],
};

const PRESET_LABELS = {
  minimal: 'Minimal',
  balanced: 'Balanced',
  aggressive: 'Agresivo',
  custom: 'Personalizado',
};

function idsOf(name) {
  return PRESETS[name] || [];
}
return {
  PRESETS: PRESETS,
  PRESET_LABELS: PRESET_LABELS,
  idsOf: idsOf,
};
})();

/* ---- src/ui/panel.js ---- */
const __m37 = (function () {
const { on: onBus } = __m0;
const { setDebug: setDebug, trackedErrors: trackedErrors } = __m2;
const { all: allFeatures, apply: apply, applyAll: applyAll, SECTIONS: SECTIONS, statuses: statuses } = __m6;
const { report: report } = __m13;
const { brokenSelectors: brokenSelectors, selectorReport: selectorReport } = __m3;
const { declare: declare, exportJSON: exportJSON, get: get, importJSON: importJSON, reset: resetStore, set: set, setMany: setMany } = __m5;
const { list: keybindList, setCombo: setCombo } = __m11;
const { setHost: setToastHost, show: toast } = __m16;
const { clearCache: clearCache, refresh: refreshCatalog, status: catalogStatus } = __m9;
const { check: checkUpdate, install: installUpdate, shouldCheck: shouldCheck } = __m17;
const { ChatPause: ChatPause } = __m18;
const { VERSION: VERSION } = __m8;
const { PANEL_CSS: PANEL_CSS } = __m35;
const { PRESETS: PRESETS, PRESET_LABELS: PRESET_LABELS, idsOf: idsOf } = __m36;

/** Panel de control en shadow DOM (sin colisiones con el CSS de Twitch). */















declare('fabRight', 'number', 14);
declare('fabBottom', 'number', 56);

let host = null;
let shadow = null;
let panel = null;
let fab = null;
let noteBox = null;
let idleTimer = null;
let built = false;

const NODE = {
  panel: 'panel',
  fab: 'fab',
  toasts: 'toasts',
  search: 'search',
  preset: 'preset',
  body: 'body',
  note: 'note',
  pause: 'pause',
};

function node(name) {
  return shadow.getElementById(NODE[name]);
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
}

function settingHtml(feature) {
  if (!feature.settings?.length) return '';
  const rows = feature.settings
    .map((setting) => {
      const value = get(setting.key);
      if (setting.type === 'bool') {
        return `<label class="row setting" data-setting-row="${setting.key}">
          <span>${escapeHtml(setting.label)}</span>
          <input type="checkbox" class="check" data-setting="${setting.key}">
        </label>`;
      }
      if (setting.type === 'select') {
        const options = setting.options
          .map(([id, label]) => `<option value="${escapeHtml(id)}"${String(id) === String(value) ? ' selected' : ''}>${escapeHtml(label)}</option>`)
          .join('');
        return `<label class="setting">
          <span>${escapeHtml(setting.label)}</span>
          <select data-setting="${setting.key}">${options}</select>
        </label>`;
      }
      const attrs = [
        `data-setting="${setting.key}"`,
        `type="${setting.type === 'number' ? 'number' : 'text'}"`,
        setting.placeholder ? `placeholder="${escapeHtml(setting.placeholder)}"` : '',
        Number.isFinite(setting.min) ? `min="${setting.min}"` : '',
        Number.isFinite(setting.max) ? `max="${setting.max}"` : '',
        Number.isFinite(setting.step) ? `step="${setting.step}"` : '',
        `value="${escapeHtml(value ?? '')}"`,
      ]
        .filter(Boolean)
        .join(' ');
      return `<label class="setting">
        <span>${escapeHtml(setting.label)}</span>
        <input ${attrs}>
      </label>`;
    })
    .join('');
  return `<div class="settings" data-settings="${feature.id}"${get(feature.id) ? '' : ' hidden'}>${rows}</div>`;
}

function featureRow(feature) {
  const tag = feature.remote ? '<span class="badge-remote">repo</span>' : '';
  return `<div class="feature" data-feature="${feature.id}">
    <label class="row label" data-search="${escapeHtml(feature.label.toLowerCase())}">
      <span>${escapeHtml(feature.label)}${tag}</span>
      <input type="checkbox" data-key="${feature.id}">
    </label>
    ${settingHtml(feature)}
  </div>`;
}

function keybindRow(entry) {
  return `<label class="row" data-search="${escapeHtml(entry.label.toLowerCase())}">
    <span>${escapeHtml(entry.label)}</span>
    <input type="text" class="kb-input" data-kb="${entry.id}" spellcheck="false">
  </label>`;
}

function sectionsHtml() {
  const keys = keybindList();
  const html = SECTIONS.map((section) => {
    const features = allFeatures().filter((feature) => feature.section === section.id);
    const body =
      section.id === 'advanced'
        ? `
          <label class="row" data-search="catálogo remoto repo">
            <span>Catálogo remoto del repo</span>
            <input type="checkbox" data-key="catalog">
          </label>
          <label class="row" data-search="comprobar actualizaciones">
            <span>Comprobar actualizaciones</span>
            <input type="checkbox" data-key="autoUpdate">
          </label>
          <label class="row" data-search="depurar depuración debug">
            <span>Modo depuración</span>
            <input type="checkbox" data-key="debug">
          </label>
          ${keys.map(keybindRow).join('')}`
        : features.map(featureRow).join('');
    return `<div class="section" data-section="${section.id}">
      <div class="section-title">${escapeHtml(section.title)}</div>
      <div class="section-body">${body}</div>
    </div>`;
  }).join('');
  return html;
}

function build() {
  if (built) return;
  host = document.createElement('div');
  host.id = 'twpp-host';
  host.style.cssText = `position:fixed;right:${get('fabRight')}px;bottom:${get('fabBottom')}px;z-index:2147483000;`;
  shadow = host.attachShadow({ mode: 'open' });
  shadow.innerHTML = `<style>${PANEL_CSS}</style>
    <div class="wrap">
      <div class="toasts" id="toasts"></div>
      <section class="panel" id="panel" hidden>
        <header class="head">
          <span>Twitch<span class="plus">++</span></span>
          <span class="ver">v${VERSION}</span>
        </header>
        <div class="toolbar">
          <input class="search" id="search" type="text" placeholder="Buscar…" spellcheck="false">
          <select class="preset" id="preset">
            ${Object.entries(PRESET_LABELS)
              .map(([id, label]) => `<option value="${id}">${label}</option>`)
              .join('')}
          </select>
        </div>
        <div class="body" id="body">${sectionsHtml()}</div>
        <div class="note" id="note" hidden></div>
        <div class="actions">
          <button class="action-btn" id="pause" data-action="pause">Pausar chat</button>
          <div class="action-row">
            <button class="action-btn" data-action="update">Buscar actualización</button>
            <button class="action-btn" data-action="catalog">Recargar catálogo</button>
          </div>
          <div class="action-row">
            <button class="action-btn" data-action="export">Exportar</button>
            <button class="action-btn" data-action="import">Importar</button>
            <button class="action-btn" data-action="diagnostics">Diagnóstico</button>
            <button class="action-btn" data-action="reset">Reset</button>
          </div>
        </div>
        <footer class="foot">Alt+O panel · Alt+P pausa de chat</footer>
      </section>
      <button class="fab" id="fab" title="Twitch++">++</button>
    </div>`;

  (document.body || document.documentElement).appendChild(host);
  panel = node('panel');
  fab = node('fab');
  noteBox = node('note');
  setToastHost(node('toasts'));

  bind();
  built = true;
  sync();
  flashFab();
  scheduleIdle();
}

function setNote(html) {
  if (!noteBox) return;
  noteBox.innerHTML = html || '';
  noteBox.hidden = !html;
}

function readSetting(input) {
  const feature = allFeatures().find((f) => (f.settings || []).some((s) => s.key === input.dataset.setting));
  const setting = feature?.settings.find((s) => s.key === input.dataset.setting);
  if (!setting) return;

  let value;
  if (setting.type === 'bool') value = input.checked;
  else if (setting.type === 'number') {
    value = Number(input.value);
    if (!Number.isFinite(value)) return;
    if (Number.isFinite(setting.min)) value = Math.max(setting.min, value);
    if (Number.isFinite(setting.max)) value = Math.min(setting.max, value);
    input.value = String(value);
  } else value = input.value;

  set(setting.key, value);
}

function bind() {
  // --- FAB draggable: distingue click (toggle panel) de drag (mover) ---
  let dragFlag = false;

  fab.addEventListener('mousedown', (ev) => {
    if (ev.button !== 0) return;
    dragFlag = false;
    const startX = ev.clientX;
    const startY = ev.clientY;
    const rect = host.getBoundingClientRect();
    const origRight = window.innerWidth - rect.right;
    const origBottom = window.innerHeight - rect.bottom;

    const onMove = (e) => {
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      if (!dragFlag && Math.abs(dx) < 5 && Math.abs(dy) < 5) return;
      dragFlag = true;
      fab.classList.add('dragging');
      const maxR = window.innerWidth - 40;
      const maxB = window.innerHeight - 40;
      host.style.right = `${Math.max(0, Math.min(maxR, origRight - dx))}px`;
      host.style.bottom = `${Math.max(0, Math.min(maxB, origBottom - dy))}px`;
    };

    const onUp = () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      fab.classList.remove('dragging');
      if (dragFlag) {
        set('fabRight', parseFloat(host.style.right) || 14);
        set('fabBottom', parseFloat(host.style.bottom) || 56);
      }
    };

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  });

  fab.addEventListener('click', () => {
    if (dragFlag) { dragFlag = false; return; }
    togglePanel();
  });

  shadow.addEventListener('change', (event) => {
    const toggle = event.target.closest('input[type="checkbox"][data-key]');
    if (toggle) {
      const { key } = toggle.dataset;
      set(key, toggle.checked);
      if (!PRESETS[key]) set('preset', 'custom');
      if (key === 'debug') setDebug(toggle.checked);
      apply(key);
      sync();
      return;
    }
    const setting = event.target.closest('[data-setting]');
    if (setting) {
      readSetting(setting);
      sync();
    }
  });

  shadow.addEventListener(
    'blur',
    (event) => {
      const input = event.target.closest('.kb-input');
      if (!input) return;
      if (setCombo(input.dataset.kb, input.value.trim())) {
        sync();
        toast('Atajo guardado');
      } else {
        sync();
      }
    },
    true,
  );

  shadow.addEventListener('click', (event) => {
    const title = event.target.closest('.section-title');
    if (title) {
      title.closest('.section')?.classList.toggle('collapsed');
      return;
    }
    const action = event.target.closest('[data-action]');
    if (!action) return;
    const handlers = {
      pause: () => {
        ChatPause.toggle();
        sync();
      },
      update: () => runUpdateCheck(),
      install: () => installUpdate(),
      catalog: () => runCatalogRefresh(),
      export: () => runExport(),
      import: () => runImport(),
      diagnostics: () => runDiagnostics(),
      reset: () => runReset(),
    };
    handlers[action.dataset.action]?.();
  });

  node('search').addEventListener('input', (event) => {
    const query = event.target.value.toLowerCase().trim();
    for (const section of shadow.querySelectorAll('.section')) {
      let visible = 0;
      for (const row of section.querySelectorAll('[data-search]')) {
        const match = !query || (row.dataset.search || '').includes(query);
        row.style.display = match ? '' : 'none';
        if (match) visible += 1;
      }
      section.style.display = visible > 0 || !query ? '' : 'none';
    }
  });

  node('preset').addEventListener('change', (event) => applyPreset(event.target.value));

  onBus('route', () => sync());
  onBus('catalog:updated', () => {
    // el catálogo pudo añadir features: hay que redibujar las filas
    node('body').innerHTML = sectionsHtml();
    sync();
  });
  onBus('feature:disabled', ({ id }) => {
    toast(`"${id}" se desactivó por errores`);
    sync();
  });
}

function applyPreset(name) {
  if (name === 'custom') return;
  const active = idsOf(name);
  const updates = {};
  for (const feature of allFeatures()) updates[feature.id] = active.includes(feature.id);
  updates.preset = name;
  setMany(updates);
  applyAll();
  sync();
  toast(`Preset: ${PRESET_LABELS[name]}`);
}

function scheduleIdle() {
  clearTimeout(idleTimer);
  idleTimer = setTimeout(() => {
    if (panel && !panel.hidden) return;
    fab?.classList.remove('awake');
  }, 4000);
}

function flashFab() {
  if (!fab) return;
  fab.classList.add('flash');
  setTimeout(() => {
    if (panel && !panel.hidden) return;
    fab.classList.remove('flash');
  }, 2500);
}

function isOpen() {
  return !!panel && !panel.hidden;
}

function togglePanel(force) {
  if (!panel) build();
  const open = typeof force === 'boolean' ? force : panel.hidden;
  panel.hidden = !open;
  if (open) {
    fab.classList.add('awake');
    clearTimeout(idleTimer);
  } else {
    scheduleIdle();
  }
  return open;
}

function sync() {
  if (!shadow) return;
  for (const feature of allFeatures()) {
    const input = shadow.querySelector(`input[data-key="${feature.id}"]`);
    if (input) input.checked = !!get(feature.id);
    const box = shadow.querySelector(`[data-settings="${feature.id}"]`);
    if (box) box.hidden = !get(feature.id);
  }
  for (const key of ['catalog', 'autoUpdate', 'debug']) {
    const input = shadow.querySelector(`input[data-key="${key}"]`);
    if (input) input.checked = !!get(key);
  }

  const keybinds = get('keybinds') || {};
  for (const input of shadow.querySelectorAll('.kb-input')) {
    input.value = keybinds[input.dataset.kb] || '';
  }

  const preset = get('preset');
  node('preset').value = PRESETS[preset] ? preset : 'custom';

  const pause = node('pause');
  pause.textContent = ChatPause.isActive() ? 'Reanudar chat' : 'Pausar chat';
  pause.classList.toggle('on', ChatPause.isActive());
  fab.classList.toggle('active', ChatPause.isActive());
  fab.title = ChatPause.isActive() ? 'Twitch++ — chat pausado' : 'Twitch++ (Alt+O)';
}

async function runUpdateCheck() {
  const button = shadow.querySelector('[data-action="update"]');
  button.disabled = true;
  const result = await checkUpdate({ force: true });
  button.disabled = false;

  if (result.error) return setNote(`No se pudo comprobar: ${escapeHtml(result.error)}`);
  if (!result.update) return setNote(`Estás en la última versión (${VERSION}).`);

  setNote(
    `Hay versión <b>${escapeHtml(result.latest)}</b>.${
      result.notes ? `<br><span>${escapeHtml(result.notes).replace(/\n/g, '<br>')}</span>` : ''
    }<br><button class="action-btn" data-action="install" style="margin-top:6px">Instalar ${escapeHtml(result.latest)}</button>`,
  );
  toast(`Actualización disponible: ${result.latest}`);
}

async function runCatalogRefresh() {
  const button = shadow.querySelector('[data-action="catalog"]');
  button.disabled = true;
  clearCache();
  const result = await refreshCatalog({ force: true });
  button.disabled = false;
  renderCatalogNote(result);
  sync();
  toast(result?.error ? 'Catálogo no disponible' : 'Catálogo actualizado');
}

function renderCatalogNote(result) {
  const info = catalogStatus();
  if (!get('catalog')) return setNote('Catálogo remoto desactivado.');
  if (info.error) return setNote(`Catálogo: ${escapeHtml(info.error)}`);
  const parts = [`Catálogo rev. ${info.revision}`];
  if (info.selectors) parts.push(`${info.selectors} selectores remotos`);
  if (info.features) parts.push(`${info.features} features del repo`);
  if (info.note) parts.push(escapeHtml(info.note));
  setNote(parts.join(' · '));
}

function runExport() {
  const json = exportJSON();
  if (navigator.clipboard?.writeText) {
    navigator.clipboard
      .writeText(json)
      .then(() => toast('Configuración copiada'))
      .catch(() => window.prompt('Copia tu configuración:', json));
    return;
  }
  window.prompt('Copia tu configuración:', json);
}

function runImport() {
  const raw = window.prompt('Pega tu configuración JSON:');
  if (!raw) return;
  try {
    importJSON(raw);
    setDebug(!!get('debug'));
    applyAll();
    sync();
    toast('Configuración importada');
  } catch {
    toast('JSON inválido');
  }
}

function runDiagnostics() {
  const errors = trackedErrors();
  const dead = brokenSelectors();
  console.table(statuses());
  console.table(selectorReport());
  if (errors.length) console.table(errors);
  console.log('[Twitch++] informe:\n' + report());

  const parts = [`${statuses().length} features`, `${errors.length} errores`];
  if (dead.length) parts.push(`${dead.length} selectores rotos`);
  toast(`Diagnóstico: ${parts.join(' · ')}`);
  if (dead.length) setNote(`Selectores sin resolver: <b>${dead.map((row) => row.key).join(', ')}</b><br>Copia el informe de la consola y abre una issue.`);
}

function runReset() {
  if (!window.confirm('¿Resetear toda la configuración de Twitch++?')) return;
  resetStore();
  setDebug(!!get('debug'));
  applyAll();
  sync();
  toast('Configuración reseteada');
}

const UI = {
  build,
  sync,
  togglePanel,
  isOpen,
  renderCatalogNote,
  checkOnStartup: shouldCheck,
};
return {
  isOpen: isOpen,
  togglePanel: togglePanel,
  sync: sync,
  UI: UI,
};
})();

/* ---- src/app.js ---- */
const __m38 = (function () {
const { on: onBus } = __m0;
const { refresh: refreshCatalog, status: catalogStatus, warm: warmCatalog } = __m9;
const { onIdle: onIdle, ready: ready } = __m10;
const { bindGlobal: bindGlobal, register: registerKeybind } = __m11;
const { setDebug: setDebug, trackedErrors: trackedErrors, track: track } = __m2;
const { probe: probe } = __m12;
const { report: report } = __m13;
const { applyAll: applyAll, disableAll: disableAll, onRouteAll: onRouteAll, statuses: statuses } = __m6;
const { start: startRouter } = __m14;
const { brokenSelectors: brokenSelectors, selectorReport: selectorReport } = __m3;
const { kick: kickScheduler, scheduleRoute: scheduleRoute, start: startScheduler } = __m15;
const { declare: declare, get: storeGet, set: storeSet } = __m5;
const { rebuild: rebuildStyles } = __m7;
const { show: toast } = __m16;
const { check: checkUpdate, shouldCheck: shouldCheck } = __m17;
const { VERSION: VERSION } = __m8;
const { ChatPause: ChatPause } = __m18;
const { UI: UI } = __m37;

/**
 * Arranque y API de diagnóstico.
 *
 * Orden: catálogo cacheado (sin red) → estilos → features → atajos → router →
 * scheduler → UI → tareas de red (catálogo + comprobación de actualización).
 */




















declare('keybinds', 'object', {});
declare('preset', 'string', 'balanced');
declare('catalog', 'bool', true);
declare('autoUpdate', 'bool', true);
declare('debug', 'bool', false);

function registerKeybinds() {
  registerKeybind('panel', 'Abrir panel', 'Alt+O');
  registerKeybind('chatPause', 'Pausar chat', 'Alt+P');
  registerKeybind('pauseAll', 'Desactivar todo', 'Alt+Shift+X');
}

function runAction(id) {
  if (id === 'panel') {
    UI.togglePanel();
    return;
  }
  if (id === 'chatPause') {
    ChatPause.toggle();
    UI.sync();
    return;
  }
  if (id === 'pauseAll') {
    disableAll();
    UI.sync();
  }
}

async function networkTasks() {
  // Fuera de twitch.tv (p.ej. la sonda de probe.html) no hay nada que buscar y
  // un catálogo remoto contaminaría lameasurement.
  if (!/(^|\.)twitch\.tv$/i.test(location.hostname)) return;
  try {
    await refreshCatalog();
  } catch {
    /* el catálogo es opcional: nunca debe romper el arranque */
  }
  UI.renderCatalogNote();
  if (!shouldCheck()) return;
  try {
    const result = await checkUpdate();
    if (result?.update) UI.renderCatalogNote();
  } catch {
    /* sin red: se ignora */
  }
}

function start() {
  // Capa 1: todo lo que no necesita <body>. Se ejecuta en document-start para
  // que el CSS esté en la página antes de que Twitch pinte el tema claro.
  try {
    bootStyles();
  } catch (error) {
    reportBootFailure('estilos', error);
    return;
  }

  // Capa 2: UI y scheduler, cuando ya existe el DOM.
  ready(() => {
    try {
      startScheduler();
      UI.build();
      UI.renderCatalogNote();
      onIdle(networkTasks);
    } catch (error) {
      reportBootFailure('interfaz', error);
    }
  });
}

function bootStyles() {
  setDebug(!!storeGet('debug'));
  warmCatalog();
  rebuildStyles();
  applyAll();
  registerKeybinds();
  bindGlobal(runAction);
  startRouter();

  onBus('route', (route) => {
    onRouteAll(route);
    ChatPause.ensure();
    scheduleRoute();
    kickScheduler();
  });

  announce();
}

function announce() {
  const list = statuses();
  const active = list.filter((feature) => feature.active).length;
  console.info(
    `%c[Twitch++]%c v${VERSION} · ${active}/${list.length} features activas · catálogo rev. ${catalogStatus().revision || 'local'}`,
    'color:#9147ff;font-weight:bold',
    'color:inherit',
  );
}

/** Un fallo al arrancar no puede dejar al usuario sin panel ni explicación. */
function reportBootFailure(stage, error) {
  track(`boot:${stage}`, error);
  const message = `Twitch++ no pudo arrancar (${stage})`;
  window.dispatchEvent(new CustomEvent('twpp:boot-error', { detail: { stage, error: String(error?.message || error) } }));
  // Toast.show encola si el panel todavía no existe: se verá en cuanto se monte.
  toast(message);
  console.error(`%c[Twitch++]%c ${message}:`, 'color:#ff5c5c;font-weight:bold', 'color:inherit', error);
}

function setFeature(id, value) {
  storeSet(id, !!value);
  applyAll();
}

const diagnostics = {
  version: VERSION,
  features: statuses,
  errors: trackedErrors,
  catalog: catalogStatus,
  selectors: selectorReport,
  broken: brokenSelectors,
  probe,
  report,
};
return {
  start: start,
  setFeature: setFeature,
  diagnostics: diagnostics,
};
})();

/* ---- src/index.js ---- */
const __m39 = (function () {
const { diagnostics: diagnostics, setFeature: setFeature, start: start } = __m38;
const { VERSION: VERSION } = __m8;

/** Punto de entrada del userscript. */



start();

globalThis.TwitchPP = {
  version: VERSION,
  diagnostics,
  enable: (id) => setFeature(id, true),
  disable: (id) => setFeature(id, false),
};
return {

};
})();

__m39;

})();
