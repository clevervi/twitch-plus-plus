/** Adaptador de las APIs GM_* con fallback a localStorage (así el bundle también arranca fuera de Tampermonkey). */

const has = (name) => typeof globalThis[name] === 'function';
// GM_info es un objeto, no una función: para comprobarlo basta con que exista.
const exists = (name) => globalThis[name] !== undefined && globalThis[name] !== null;

const memory = new Map();
const PREFIX = 'twpp:';

function localGet(key) {
  // La memoria es el fallback cuando localStorage no está disponible o falla.
  // Si hay un valor guardado ahí, tiene prioridad sobre un getItem que devuelva
  // null o que lance.
  if (memory.has(key)) return memory.get(key);

  try {
    if (globalThis.localStorage) return globalThis.localStorage.getItem(PREFIX + key);
  } catch {
    /* caída a memoria */
  }
  return null;
}

function localSet(key, value) {
  let guardado = false;
  try {
    if (globalThis.localStorage) {
      globalThis.localStorage.setItem(PREFIX + key, value);
      guardado = true;
    }
  } catch {
    /* caída a memoria */
  }
  if (guardado) memory.delete(key);
  else memory.set(key, value);
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
  memory.delete(key);
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

/** GET/POST JSON con timeout. Devuelve `null` en cualquier fallo (sin lanzar). */
function requestJson({ url, method = 'GET', body, timeout = 10000, headers }) {
  return new Promise((resolve) => {
    let settled = false;
    const done = (value) => {
      if (settled) return;
      settled = true;
      resolve(value);
    };

    if (!has('GM_xmlhttpRequest')) {
      // El fallback tambien necesita timeout. Sin el, un fetch que no responde
      // dejaba la promesa colgada para siempre y con ella el arranque.
      const controller = typeof AbortController === 'function' ? new AbortController() : null;
      const timer = controller && timeout > 0 ? setTimeout(() => controller.abort(), timeout) : null;
      try {
        fetch(url, { method, headers, body, signal: controller?.signal })
          .then((res) => (res.ok ? res.json() : null))
          .then(done)
          .catch(() => done(null))
          .finally(() => {
            if (timer !== null) clearTimeout(timer);
          });
      } catch {
        if (timer !== null) clearTimeout(timer);
        done(null);
      }
      return;
    }

    try {
      globalThis.GM_xmlhttpRequest({
        method,
        url,
        timeout,
        headers,
        data: body,
        onload(res) {
          try {
            if (!res || res.status < 200 || res.status >= 300) return done(null);
            done(JSON.parse(res.responseText));
          } catch {
            done(null);
          }
        },
        onerror: () => done(null),
        ontimeout: () => done(null),
      });
    } catch {
      done(null);
    }
  });
}

export function getJson(url, { timeout = 10000, headers } = {}) {
  return requestJson({ url, timeout, headers });
}

/** POST con cuerpo JSON. El `Content-Type` se puede sobrescribir desde `headers`. */
export function postJson(url, payload, { timeout = 10000, headers } = {}) {
  return requestJson({
    url,
    method: 'POST',
    body: typeof payload === 'string' ? payload : JSON.stringify(payload),
    timeout,
    headers: { 'Content-Type': 'application/json', ...headers },
  });
}

const PROBE_KEY = 'twpp:storageProbe';

/**
 * Comprueba que el almacén sobrevive: lee el valor de la ejecución anterior y
 * escribe uno nuevo. La primera vez `persisted` es false; tras una recarga,
 * true si el gestor (o localStorage) conservó el valor.
 */
export function storageProbe() {
  const backend = has('GM_setValue') ? 'GM' : 'localStorage';
  const previous = getValue(PROBE_KEY, null);
  const at = Date.now();
  const value = `${at}-${Math.random().toString(36).slice(2, 8)}`;
  try {
    setValue(PROBE_KEY, { value, at });
  } catch (error) {
    return { backend, persisted: false, error: String(error?.message || error) };
  }
  return {
    backend,
    persisted: Boolean(previous && typeof previous === 'object' && previous.value),
    previousAt: previous?.at || null,
  };
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
