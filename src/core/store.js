/**
 * Store con esquema declarado: cada clave tiene tipo y default, así una config
 * corrupta, de una versión vieja o editada a mano nunca rompe el arranque.
 */
import { addValueChangeListener, deleteValue, getValue, setValue } from './gm.js';
import { log, warn } from './log.js';
import { CONFIG_VERSION, migrate } from './migrations.js';

const KEY = 'twpp.config';
const LEGACY_KEYS = ['twpp'];

const schema = new Map();
const listeners = new Set();
let cache = null;
let importedFromLegacy = null;

addValueChangeListener(KEY, (newValue) => {
  if (!newValue || typeof newValue !== 'object') return;
  const prev = cache;
  cache = null;
  const next = all();
  if (!prev) {
    for (const key of schema.keys()) changed(key);
    return;
  }
  for (const key of schema.keys()) {
    if (prev[key] !== next[key]) changed(key);
  }
});

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

function applyValidate(key, value) {
  const def = schema.get(key);
  if (!def?.validate || value === undefined) return value;
  try {
    return def.validate(value) ? value : undefined;
  } catch {
    return undefined;
  }
}

export function declare(key, type, fallback, validate) {
  schema.set(key, { type, fallback, validate });
  if (cache) {
    const raw = coerce(cache[key], type);
    const valid = validate && raw !== undefined ? (validate(raw) ? raw : undefined) : raw;
    cache[key] = valid ?? (typeof fallback === 'object' && fallback !== null ? clone(fallback) : fallback);
  }
}

export function all() {
  if (cache) return cache;
  const migrated = migrate(readConfig());
  importedFromLegacy = importedFromLegacy || { imported: false, from: null };

  const next = {};
  let repaired = 0;
  for (const [key, { type, fallback }] of schema) {
    const value = applyValidate(key, coerce(migrated[key], type));
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
export function migratedFrom() {
  return importedFromLegacy?.imported ? importedFromLegacy.from : null;
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

export function get(key) {
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

export function set(key, value) {
  const current = all();
  const def = schema.get(key);
  const coerced = def ? applyValidate(key, coerce(value, def.type)) : value;
  const final = coerced === undefined ? (def ? (typeof def.fallback === 'object' && def.fallback !== null ? clone(def.fallback) : def.fallback) : value) : coerced;
  if (current[key] === final) return final;
  current[key] = final;
  persist();
  changed(key);
  return final;
}

export function setMany(entries) {
  const current = all();
  const keys = Object.keys(entries).filter((key) => current[key] !== entries[key]);
  if (!keys.length) return current;
  for (const [key, value] of Object.entries(entries)) {
    const def = schema.get(key);
    const coerced = def ? applyValidate(key, coerce(value, def.type)) : value;
    current[key] = coerced === undefined ? (def ? (typeof def.fallback === 'object' && def.fallback !== null ? clone(def.fallback) : def.fallback) : value) : coerced;
  }
  persist();
  for (const key of keys) changed(key);
  return current;
}

export function onChange(fn) {
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

export function exportJSON() {
  return JSON.stringify({ ...all(), _v: CONFIG_VERSION }, null, 2);
}

export function importJSON(text) {
  const parsed = JSON.parse(text);
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('JSON inválido');
  cache = all();
  for (const [key, { type, fallback }] of schema) {
    const value = applyValidate(key, coerce(parsed[key], type));
    cache[key] = value === undefined ? (typeof fallback === 'object' ? clone(fallback) : fallback) : value;
  }
  cache._v = CONFIG_VERSION;
  persist();
  for (const key of Object.keys(cache)) changed(key);
  return cache;
}

export function reset() {
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

export function schemaSnapshot() {
  return Object.fromEntries([...schema].map(([key, def]) => [key, def.type]));
}
