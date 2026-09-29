/**
 * Auto-actualización.
 *
 * Tampermonkey/Greasemonkey resuelven la instalación con @updateURL/@downloadURL.
 * Este módulo sirve para dos cosas:
 *  - avisar en el panel en cuanto hay una versión nueva (sin recargar Twitch)
 *  - abrir el instalador con un clic
 * Compara contra dist/latest.json, que genera `npm run build`.
 */
import { getJson, getValue, openInTab, setValue } from './gm.js';
import { log } from './log.js';
import { get as storeGet } from './store.js';
import { LATEST_URL, REPO_URL, SCRIPT_URL, VERSION } from './version.js';

const LAST_CHECK_KEY = 'twpp.update.lastCheck';
const DAY = 24 * 60 * 60 * 1000;

export function parseVersion(value) {
  const parts = String(value || '')
    .split('-')[0]
    .split('.')
    .map((part) => parseInt(String(part).replace(/[^\d]/g, ''), 10) || 0);
  return [parts[0] || 0, parts[1] || 0, parts[2] || 0];
}

/** `true` si `candidate` es más reciente que `current`. */
export function isNewer(candidate, current) {
  const a = parseVersion(candidate);
  const b = parseVersion(current);
  for (let i = 0; i < 3; i += 1) {
    if (a[i] > b[i]) return true;
    if (a[i] < b[i]) return false;
  }
  return false;
}

export async function check({ force = false, timeout = 6000 } = {}) {
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
export function install() {
  openInTab(SCRIPT_URL);
}

export function shouldCheck() {
  return !!storeGet('autoUpdate');
}
