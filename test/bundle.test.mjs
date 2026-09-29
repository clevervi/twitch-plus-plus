import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';
import vm from 'node:vm';

import { createDomStub } from '../tools/dom-stub.mjs';

const BUNDLE = resolve(process.cwd(), 'dist/twitch-plus-plus.user.js');

function boot() {
  const stub = createDomStub();
  const memory = new Map();
  const sandbox = {
    ...stub,
    console: { ...console, table: () => {} },
    Date,
    Math,
    JSON,
    Image: class {},
    history: { pushState() {}, replaceState() {} },
    fetch: () => Promise.reject(new Error('sin red en el test')),
    CustomEvent: class {
      constructor(type, init) {
        this.type = type;
        this.detail = init?.detail;
      }
    },
    GM_getValue: (key, fallback) => (memory.has(key) ? memory.get(key) : fallback),
    GM_setValue: (key, value) => memory.set(key, value),
    GM_deleteValue: (key) => memory.delete(key),
    GM_addStyle: () => {},
  };
  sandbox.globalThis = sandbox;
  sandbox.self = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(readFileSync(BUNDLE, 'utf8'), sandbox, { filename: 'twitch-plus-plus.user.js' });
  return sandbox;
}

function shadowOf(sandbox) {
  return sandbox.document.body.children[0].shadow;
}

function feature(sandbox, id) {
  return sandbox.TwitchPP.diagnostics.features().find((f) => f.id === id);
}

test('el bundle arranca sin lanzar y expone la API pública', () => {
  const sandbox = boot();
  assert.equal(typeof sandbox.TwitchPP, 'object');
  assert.equal(sandbox.TwitchPP.version, '2.0.0');
  assert.equal(typeof sandbox.TwitchPP.diagnostics.features, 'function');
  assert.ok(sandbox.TwitchPP.diagnostics.features().length >= 15);
});

test('el bundle activa las features con default sin tocar el <html>', () => {
  const sandbox = boot();
  const classes = sandbox.document.documentElement.classList;
  const active = sandbox.TwitchPP.diagnostics.features().filter((feature) => feature.enabled).map((feature) => feature.id);
  assert.ok(active.includes('darkMode'));
  assert.ok(active.includes('autoClaim'));
  for (const id of active) assert.equal(classes.contains(`twpp-${id}`), true);
});

test('los hooks declarados en el header son los que necesita el repo', () => {
  const code = readFileSync(BUNDLE, 'utf8');
  for (const token of [
    '// @match        https://*.twitch.tv/*',
    '@grant        GM_xmlhttpRequest',
    '@connect      raw.githubusercontent.com',
    '@downloadURL',
    '@updateURL',
    '@version      2.0.0',
    '==/UserScript==',
  ]) {
    assert.ok(code.includes(token), `falta ${token}`);
  }
  assert.equal(/__VERSION__|__RAW__|__REPO__/.test(code), false, 'quedan placeholders sin sustituir');
  assert.equal(code.includes('@grant        GM_'), true);
  assert.equal(/@grant\s+GM_addStyle/.test(code), false, 'GM_addStyle ya no se usa');
});

test('TwitchPP.enable / disable cambian el estado', () => {
  const sandbox = boot();
  sandbox.TwitchPP.enable('chatSearch');
  assert.equal(sandbox.TwitchPP.diagnostics.features().find((f) => f.id === 'chatSearch').enabled, true);
  sandbox.TwitchPP.disable('chatSearch');
  assert.equal(sandbox.TwitchPP.diagnostics.features().find((f) => f.id === 'chatSearch').enabled, false);
});

test('el panel renderiza una fila por feature y por atajo', () => {
  const shadow = shadowOf(boot());
  const features = shadow.querySelectorAll('input[type="checkbox"][data-key]');
  const keybinds = shadow.querySelectorAll('.kb-input');
  assert.ok(features.length >= 15, `solo ${features.length} toggles`);
  assert.equal(keybinds.length, 3);
  assert.equal(shadow.getElementById('panel') !== null, true);
  assert.equal(shadow.getElementById('fab') !== null, true);
});

test('un toggle del panel cambia la config y la clase del <html>', () => {
  const sandbox = boot();
  const shadow = shadowOf(sandbox);
  const toggle = shadow.querySelector('input[type="checkbox"][data-key="chatSearch"]');
  assert.equal(toggle.checked, false);
  toggle.checked = true;
  shadow.fire('change', { target: toggle });

  assert.equal(feature(sandbox, 'chatSearch').enabled, true);
  assert.equal(sandbox.document.documentElement.classList.contains('twpp-chatSearch'), true);
});

test('escribir un atajo lo guarda y un atajo inválido se descarta', () => {
  const sandbox = boot();
  const shadow = shadowOf(sandbox);
  const input = shadow.querySelector('.kb-input[data-kb="panel"]');
  assert.equal(input.value, 'Alt+O');

  input.value = 'Ctrl+Shift+K';
  shadow.fire('blur', { target: input });
  assert.equal(sandbox.GM_getValue('twpp.config', {}).keybinds.panel, 'Ctrl+Shift+K');

  input.value = 'no es un atajo';
  shadow.fire('blur', { target: input });
  assert.equal(sandbox.GM_getValue('twpp.config', {}).keybinds.panel, 'Ctrl+Shift+K');
});

test('un ajuste numérico se recorta a su rango', () => {
  const sandbox = boot();
  const shadow = shadowOf(sandbox);
  const input = shadow.querySelector('input[type="number"][data-setting="sidebarWidth"]');
  input.value = '9000';
  shadow.fire('change', { target: input });
  assert.equal(input.value, '120');
});
