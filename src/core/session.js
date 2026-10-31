/** sessionStorage con JSON: por pestaña, sobrevive a una recarga y nunca lanza. */
export function read(key) {
  try {
    const raw = globalThis.sessionStorage?.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function write(key, value) {
  try {
    globalThis.sessionStorage?.setItem(key, JSON.stringify(value));
  } catch {
    /* sin sessionStorage se pierde la persistencia, no la funcionalidad */
  }
}

export function remove(key) {
  try {
    globalThis.sessionStorage?.removeItem(key);
  } catch {
    /* ignore */
  }
}
