/** Adaptador de las APIs GM_* con fallback a localStorage (así el bundle también arranca fuera de Tampermonkey). */

const has = (name) => typeof globalThis[name] === 'function';
// GM_info es un objeto, no una función: para comprobarlo basta con que exista.
const exists = (name) => globalThis[name] !== undefined && globalThis[name] !== null;

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

export function addValueChangeListener(key, fn) {
  try {
    if (has('GM_addValueChangeListener')) {
      return globalThis.GM_addValueChangeListener(key, (name, oldV, newV, remote) => {
        if (!remote) return;
        fn(newV);
      });
    }
  } catch {
    /* ignore */
  }
  if (typeof window !== 'undefined' && window.addEventListener) {
    const handler = (event) => {
      if (event.key === PREFIX + key) {
        try {
          fn(event.newValue ? JSON.parse(event.newValue) : null);
        } catch {
          /* ignore */
        }
      }
    };
    window.addEventListener('storage', handler);
    return () => window.removeEventListener('storage', handler);
  }
  return () => {};
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
    if (exists('GM_info')) return String(globalThis.GM_info.scriptHandler || 'otro');
  } catch {
    /* ignore */
  }
  return 'desconocido';
}

/**
 * Qué APIs de usuario hay disponibles y qué se pierde sin cada una.
 * Sin `@grant` correspondiente, un gestor de scripts no expone la función, así
 * que el fallo se manifesta como "no pasa nada" en lugar de como un error.
 */
const APIS = {
  GM_getValue: 'leer y guardar la configuración',
  GM_setValue: 'leer y guardar la configuración',
  GM_deleteValue: 'restablecer la configuración',
  GM_addValueChangeListener: 'sincronizar la configuración entre pestañas',
  GM_xmlhttpRequest: 'leer el catálogo remoto y buscar actualizaciones',
  GM_info: 'identificar el gestor de scripts',
};

export function capabilities() {
  const ausentes = Object.entries(APIS)
    .filter(([name]) => (name === 'GM_info' ? !exists(name) : !has(name)))
    .map(([name, para_que_sirve]) => `${name} (${para_que_sirve})`);
  return { gestor: managerName(), ausentes };
}
