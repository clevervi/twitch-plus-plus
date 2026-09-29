/**
 * Stub de DOM suficiente para arrancar el bundle fuera del navegador.
 * No pretende ser un DOM completo: solo lo que el userscript toca al arrancar.
 */

class ClassList {
  constructor() {
    this.set = new Set();
  }

  add(...names) {
    for (const name of names) this.set.add(name);
  }

  remove(...names) {
    for (const name of names) this.set.delete(name);
  }

  contains(name) {
    return this.set.has(name);
  }

  toggle(name, force) {
    const on = force === undefined ? !this.set.has(name) : !!force;
    if (on) this.set.add(name);
    else this.set.delete(name);
    return on;
  }

  toString() {
    return [...this.set].join(' ');
  }
}

class StubNode {
  constructor(tag = 'div') {
    this.tagName = String(tag).toUpperCase();
    this.className = '';
    this.classList = new ClassList();
    this.children = [];
    this.childNodes = [];
    this.attributes = {};
    this.style = makeStyle();
    this.dataset = {};
    this.isConnected = true;
    this.isContentEditable = false;
    this.textContent = '';
    this.innerHTML = '';
    this.parentElement = null;
    this.offsetParent = null;
    Object.defineProperty(this, 'dataset', { get: () => datasetProxy(this) });
  }

  appendChild(node) {
    if (typeof node === 'string') node = new StubNode();
    node.parentElement = this;
    this.children.push(node);
    this.childNodes.push(node);
    return node;
  }

  append(...nodes) {
    for (const node of nodes) this.appendChild(node);
  }

  prepend(node) {
    node.parentElement = this;
    this.children.unshift(node);
    this.childNodes.unshift(node);
  }

  insertBefore(node) {
    node.parentElement = this;
    this.children.unshift(node);
    this.childNodes.unshift(node);
    return node;
  }

  remove() {
    this.isConnected = false;
    if (this.parentElement) {
      this.parentElement.children = this.parentElement.children.filter((child) => child !== this);
    }
  }

  setAttribute(name, value) {
    this.attributes[name] = String(value);
    if (name === 'class') this.className = String(value);
  }

  getAttribute(name) {
    return this.attributes[name] ?? null;
  }

  removeAttribute(name) {
    delete this.attributes[name];
  }

  addEventListener() {}

  removeEventListener() {}

  querySelector() {
    return null;
  }

  querySelectorAll() {
    return [];
  }

  matches(selector) {
    const match = compileSelector(String(selector).trim());
    return match ? match(this) : false;
  }

  closest(selector) {
    let node = this;
    while (node) {
      if (node.matches(selector)) return node;
      node = node.parentElement;
    }
    return null;
  }

  contains() {
    return false;
  }

  attachShadow() {
    const registry = new ShadowStub();
    this.shadow = registry;
    return registry;
  }

  getBoundingClientRect() {
    return { width: 100, height: 30, top: 0, left: 0, right: 100, bottom: 30 };
  }

  scrollIntoView() {}
}

const kebab = (name) => name.replace(/[A-Z]/g, (char) => `-${char.toLowerCase()}`);

/** `dataset.x` → atributo `data-x` (solo lectura/escritura simple). */
function datasetProxy(node) {
  return new Proxy(
    {},
    {
      get: (_target, prop) => node.getAttribute(`data-${kebab(String(prop))}`),
      set: (_target, prop, value) => {
        node.setAttribute(`data-${kebab(String(prop))}`, value);
        return true;
      },
      has: (_target, prop) => node.getAttribute(`data-${kebab(String(prop))}`) !== null,
    },
  );
}

function makeStyle() {
  const map = new Map();
  return {
    setProperty: (name, value) => map.set(name, value),
    getPropertyValue: (name) => map.get(name) ?? '',
    removeProperty: (name) => map.delete(name),
    cssText: '',
  };
}

/**
 * Shadow root mínima: parsea el `innerHTML` que leasinsigna el script para poder
 * responder a getElementById / querySelector(All) sin arrastrar jsdom.
 */
class ShadowStub {
  constructor() {
    this._html = '';
    this._version = 0;
    this._parsed = { version: -1, nodes: [] };
    this.listeners = new Map();
  }

  set innerHTML(value) {
    this._html = String(value);
    this._version += 1;
  }

  get innerHTML() {
    return this._html;
  }

  addEventListener(type, fn) {
    if (!this.listeners.has(type)) this.listeners.set(type, new Set());
    this.listeners.get(type).add(fn);
  }

  removeEventListener(type, fn) {
    this.listeners.get(type)?.delete(fn);
  }

  /** Lanza los handlers registrados como si el usuario hubiera interactuado. */
  fire(type, event) {
    for (const fn of this.listeners.get(type) || []) fn(event);
  }

  nodes() {
    if (this._parsed.version === this._version) return this._parsed.nodes;
    const nodes = [];
    for (const match of this._html.matchAll(/<([a-zA-Z][\w-]*)((?:[^>"']|"[^"]*"|'[^']*')*)>/g)) {
      const node = new StubNode(match[1]);
      for (const attr of match[2].matchAll(/([\w-]+)(?:="([^"]*)")?/g)) {
        node.setAttribute(attr[1], attr[2] ?? '');
      }
      nodes.push(node);
    }
    this._parsed = { version: this._version, nodes };
    return nodes;
  }

  getElementById(id) {
    return this.nodes().find((node) => node.getAttribute('id') === id) || null;
  }

  querySelector(selector) {
    return this.querySelectorAll(selector)[0] || null;
  }

  querySelectorAll(selector) {
    const matchers = String(selector)
      .split(',')
      .map((part) => compileSelector(part.trim()))
      .filter(Boolean);
    return this.nodes().filter((node) => matchers.some((match) => match(node)));
  }
}

/** Soporta `tag`, `#id`, `.clase`, `[attr]`, `[attr="valor"]` (sin combinadores). */
function compileSelector(selector) {
  if (!selector) return null;
  const tag = selector.match(/^[a-zA-Z][\w-]*/)?.[0];
  const rest = tag ? selector.slice(tag.length) : selector;
  const ids = [...rest.matchAll(/#([\w-]+)/g)].map((m) => m[1]);
  const classes = [...rest.matchAll(/\.([\w-]+)/g)].map((m) => m[1]);
  const attrs = [...rest.matchAll(/\[([\w-]+)(?:=["']?([^"'\]]*)["']?)?\]/g)].map((m) => [m[1], m[2]]);

  return (node) => {
    if (tag && node.tagName !== tag.toUpperCase()) return false;
    if (ids.length && !ids.includes(node.getAttribute('id'))) return false;
    if (classes.length && !classes.every((cls) => String(node.className).split(/\s+/).includes(cls))) return false;
    return attrs.every(([name, value]) => {
      const actual = node.getAttribute(name);
      return value === undefined ? actual !== null : actual === value;
    });
  };
}

export function createDomStub() {
  const documentElement = new StubNode('html');
  const head = new StubNode('head');
  const body = new StubNode('body');
  documentElement.appendChild(head);
  documentElement.appendChild(body);

  const document = {
    documentElement,
    head,
    body,
    readyState: 'complete',
    hidden: false,
    createElement: (tag) => new StubNode(tag),
    createTextNode: (text) => ({ textContent: String(text) }),
    getElementById: () => null,
    querySelector: () => null,
    querySelectorAll: () => [],
    addEventListener() {},
    removeEventListener() {},
    title: 'Twitch',
  };

  const listeners = new Map();
  const window = {
    document,
    location: { pathname: '/canal/demo', href: 'https://www.twitch.tv/canal/demo' },
    addEventListener(type, fn) {
      if (!listeners.has(type)) listeners.set(type, new Set());
      listeners.get(type).add(fn);
    },
    removeEventListener(type, fn) {
      listeners.get(type)?.delete(fn);
    },
    dispatchEvent: () => true,
    fire(type, event = {}) {
      const fired = [];
      for (const fn of listeners.get(type) || []) {
        fn(event);
        fired.push(event.prevented === true);
      }
      return fired;
    },
    open: () => null,
    prompt: () => null,
    confirm: () => true,
    getComputedStyle: () => ({ visibility: 'visible', display: 'block', overflowY: 'visible' }),
  };

  class MutationObserverStub {
    observe() {}

    disconnect() {}
  }

  // Temporizadores inertes: los tests no dependen del reloj real y el proceso
  // puede terminar aunque el script haya pedido intervalos.
  const noop = () => 0;

  return {
    window,
    document,
    MutationObserver: MutationObserverStub,
    getComputedStyle: window.getComputedStyle,
    requestIdleCallback: noop,
    requestAnimationFrame: noop,
    location: window.location,
    setTimeout: noop,
    clearTimeout: noop,
    setInterval: noop,
    clearInterval: noop,
    console: {
      log() {},
      info() {},
      warn() {},
      error() {},
      table() {},
    },
  };
}
