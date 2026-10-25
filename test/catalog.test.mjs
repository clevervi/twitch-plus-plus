import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';

import { createDomStub } from '../tools/dom-stub.mjs';

const stub = createDomStub();
globalThis.document = stub.document;
globalThis.window = stub.window;
globalThis.getComputedStyle = stub.getComputedStyle;
globalThis.MutationObserver = stub.MutationObserver;

const { applyCatalog, clearCache, status } = await import('../src/core/catalog.js');
const { all, apply, get } = await import('../src/core/registry.js');
const { set: setStore } = await import('../src/core/store.js');

afterEach(() => {
  clearCache();
});

test('status marca el catálogo como remoto en cuanto se aplica', () => {
  assert.equal(status().remote, false);
  applyCatalog({ schema: 1, revision: 7, selectors: {}, features: [] });
  assert.equal(status().remote, true);
  assert.equal(status().revision, 7);
});

test('una feature remota con settings se rechaza', () => {
  const summary = applyCatalog({
    schema: 1,
    revision: 8,
    selectors: {},
    features: [
      {
        id: 'remota-con-settings',
        label: 'Remota con settings',
        section: 'visual',
        css: '.remota-con-settings { color: red; }',
        settings: [{ key: 'catalog', type: 'string', default: 'secuestrado' }],
      },
    ],
  });

  assert.equal(summary.features, 0);
  assert.equal(summary.rejected, 1);
  assert.equal(all().some((feature) => feature.id === 'remota-con-settings'), false);
});

test('una feature remota existente se actualiza con el CSS nuevo', () => {
  applyCatalog({
    schema: 1,
    revision: 9,
    selectors: {},
    features: [
      {
        id: 'remota-css',
        label: 'Remota CSS',
        section: 'visual',
        css: '.remota-css { color: red; }',
      },
    ],
  });
  const feature = get('remota-css');
  assert.equal(feature?.remote, true);

  const summary = applyCatalog({
    schema: 1,
    revision: 10,
    selectors: {},
    features: [
      {
        id: 'remota-css',
        label: 'Remota CSS',
        section: 'visual',
        css: '.remota-css { color: blue; }',
      },
    ],
  });

  assert.equal(get('remota-css'), feature);
  assert.match(feature.css, /blue/);
  assert.equal(summary.features, 1);
  assert.equal(status().features, 1);
});

test('una actualizacion remota invalida conserva la feature anterior', () => {
  applyCatalog({
    schema: 1,
    revision: 14,
    selectors: {},
    features: [
      {
        id: 'remota-invalida',
        label: 'Remota invalida',
        section: 'visual',
        css: '.remota-invalida { color: red; }',
      },
    ],
  });

  const summary = applyCatalog({
    schema: 1,
    revision: 15,
    selectors: {},
    features: [
      {
        id: 'remota-invalida',
        label: 'Remota invalida',
        section: 'visual',
        css: '.remota-invalida { background: url(x); }',
      },
    ],
  });

  assert.equal(summary.rejected, 1);
  assert.equal(summary.removed, 0);
  assert.match(get('remota-invalida').css, /red/);
});

test('una feature remota ausente del catalogo se retira', () => {
  applyCatalog({
    schema: 1,
    revision: 11,
    selectors: {},
    features: [
      {
        id: 'remota-retirada',
        label: 'Remota retirada',
        section: 'visual',
        css: '.remota-retirada { color: red; }',
      },
    ],
  });
  setStore('remota-retirada', true);
  apply('remota-retirada');
  assert.equal(document.documentElement.classList.contains('twpp-remota-retirada'), true);

  const summary = applyCatalog({ schema: 1, revision: 12, selectors: {}, features: [] });

  assert.equal(summary.removed, 1);
  assert.equal(get('remota-retirada'), null);
  assert.equal(document.documentElement.classList.contains('twpp-remota-retirada'), false);
});

test('clearCache retira las features remotas y sus clases', () => {
  applyCatalog({
    schema: 1,
    revision: 13,
    selectors: {},
    features: [
      {
        id: 'remota-cache',
        label: 'Remota cache',
        section: 'visual',
        css: '.remota-cache { color: red; }',
      },
    ],
  });
  setStore('remota-cache', true);
  apply('remota-cache');
  assert.equal(document.documentElement.classList.contains('twpp-remota-cache'), true);

  clearCache();

  assert.equal(get('remota-cache'), null);
  assert.equal(document.documentElement.classList.contains('twpp-remota-cache'), false);
  assert.equal(status().remote, false);
});
