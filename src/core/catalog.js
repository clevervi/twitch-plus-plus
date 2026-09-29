/**
 * Catálogo remoto: el repo (no el script) es la fuente de estabilidad.
 *
 * Permite (a) que la comunidadlice selectores nuevos cuando Twitch cambia el DOM
 * y (b) publicar features experimentales en CSS sin sacar una release del
 * userscript. Todo es opcional y validado: si el repo no responde, si el JSON es
 * inválido o si un selector es sospechoso, se ignora y se sigue con lo local.
 */
import { emit } from './bus.js';
import { getJson, getValue, setValue } from './gm.js';
import { log, warn } from './log.js';
import { applyRemote as applyRemoteSelectors, clearRemote as clearRemoteSelectors } from './selectors.js';
import { SECTIONS, all, apply, defineFeature } from './registry.js';
import { rebuild as rebuildStyles } from './styles.js';
import { get as storeGet } from './store.js';
import { CATALOG_URL } from './version.js';

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
export function applyCatalog(data) {
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

export function status() {
  return { ...last, enabled: !!storeGet('catalog'), local: all().filter((f) => f.remote).map((f) => f.id) };
}

function needsFetch(force) {
  if (!storeGet('catalog')) return false;
  const cached = readCache();
  if (force || !cached) return true;
  return Date.now() - (cached.fetchedAt || 0) > TTL;
}

/** Descarga y aplica el catálogo del repo. Devuelve `null` si no había nada que hacer. */
export async function refresh({ force = false, timeout = 8000 } = {}) {
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
export function warm() {
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

export function clearCache() {
  clearRemoteSelectors();
  setValue(CACHE_KEY, null);
  last = { revision: 0, updatedAt: 0, selectors: 0, features: 0, note: '', error: '' };
}
