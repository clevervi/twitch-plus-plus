/**
 * Store con esquema declarado: cada clave tiene tipo y default, así una config
 * corrupta, de una versión vieja o editada a mano nunca rompe el arranque.
 */
import { deleteValue, getValue, setValue } from './gm.js';
import { log, warn } from './log.js';
import { CONFIG_VERSION, migrate } from './migrations.js';

const KEY = 'twpp.config';

const schema = new Map();
const listeners = new Set();
let cache = null;

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

export function declare(key, type, fallback) {
  schema.set(key, { type, fallback });
  if (cache) cache[key] = coerce(cache[key], type) ?? fallback;
}

export function all() {
  if (cache) return cache;
  const raw = getValue(KEY, null);
  const migrated = migrate(raw && typeof raw === 'object' ? raw : null);

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
  return cache;
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
  if (current[key] === value) return value;
  current[key] = value;
  persist();
  changed(key);
  return value;
}

export function setMany(entries) {
  const current = all();
  const keys = Object.keys(entries).filter((key) => current[key] !== entries[key]);
  if (!keys.length) return current;
  Object.assign(current, entries);
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
    const value = coerce(parsed[key], type);
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
