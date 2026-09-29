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

export function getValue(key, fallback) {
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

export function setValue(key, value) {
  try {
    if (has('GM_setValue')) return globalThis.GM_setValue(key, value);
  } catch {
    /* caída a localStorage */
  }
  localSet(key, JSON.stringify(value));
  return value;
}

export function deleteValue(key) {
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

export function openInTab(url) {
  if (has('GM_openInTab')) return globalThis.GM_openInTab(url, { active: true });
  globalThis.open(url, '_blank', 'noopener');
  return null;
}

/** GET JSON con timeout. Devuelve `null` en cualquier fallo (sin lanzar). */
export function getJson(url, { timeout = 10000, headers } = {}) {
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

export function managerName() {
  try {
    if (has('GM_info') && globalThis.GM_info) return String(globalThis.GM_info.scriptHandler || 'otro');
  } catch {
    /* ignore */
  }
  return 'desconocido';
}
