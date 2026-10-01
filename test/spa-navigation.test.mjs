import assert from 'node:assert/strict';
import test from 'node:test';

import { createDomStub } from '../tools/dom-stub.mjs';
import { defineFeature, apply, onRouteAll } from '../src/core/registry.js';
import { currentRoute } from '../src/core/router.js';
import { diagnostics } from '../src/app.js';
import { set as storeSet } from '../src/core/store.js';

test('navegacion SPA despacha contexto enriquecido con canal, anterior y razon', () => {
  // Simular entorno global de navegación
  const prevLocation = globalThis.location;
  globalThis.location = { pathname: '/ibai' };

  try {
    const route1 = currentRoute('pushState');
    assert.equal(route1.channel, 'ibai');
    assert.equal(route1.canal, 'ibai');
    assert.equal(route1.razon, 'pushState');

    globalThis.location = { pathname: '/auronplay' };
    const route2 = currentRoute('pushState');
    assert.equal(route2.channel, 'auronplay');
    assert.equal(route2.canal, 'auronplay');
    assert.equal(route2.anterior, 'ibai');
    assert.equal(route2.razon, 'pushState');
    assert.equal(route2.tiempoVisible >= 0, true);

    globalThis.location = { pathname: '/' };
    const route3 = currentRoute('popstate');
    assert.equal(route3.channel, '');
    assert.equal(route3.canal, '');
    assert.equal(route3.anterior, 'auronplay');
    assert.equal(route3.razon, 'popstate');
  } finally {
    globalThis.location = prevLocation;
  }
});

test('secuencia SPA: features solo se inicializan una vez, no en cada ruta', () => {
  const stub = createDomStub();
  const prevDoc = globalThis.document;
  globalThis.document = stub.document;

  try {
    let enables = 0;
    let disables = 0;
    const routesReceived = [];

    const featureId = 'testSpaFeature';
    defineFeature({
      id: featureId,
      label: 'Test SPA',
      default: true,
      onEnable() {
        enables += 1;
      },
      onDisable() {
        disables += 1;
      },
      onRoute(r) {
        routesReceived.push(r.canal);
      },
    });

    storeSet(featureId, true);
    apply(featureId);
    assert.equal(enables, 1, 'onEnable llamado 1 vez al arrancar');

    // Simular secuencia de rutas: canal A -> canal B -> modal/subruta -> main
    const rutas = ['canalA', 'canalB', 'canalB/about', ''];
    for (const canal of rutas) {
      onRouteAll({ canal, anterior: 'prev', razon: 'navigation' });
    }

    assert.equal(enables, 1, 'onEnable NO debe volver a llamarse durante la navegación');
    assert.equal(disables, 0, 'onDisable NO debe llamarse mientras la feature siga activa');
    assert.deepEqual(routesReceived, ['canalA', 'canalB', 'canalB/about', '']);

    // Al desactivar explícitamente:
    storeSet(featureId, false);
    apply(featureId);
    assert.equal(disables, 1, 'onDisable se llama solo al apagar la feature');
  } finally {
    globalThis.document = prevDoc;
  }
});

test('diagnostics.boot() expone el estado y mediciones del arranque', () => {
  const boot = diagnostics.boot();
  assert.ok(boot, 'bootReport existe');
  assert.ok(typeof boot.stages === 'object', 'stages es un objeto');
  assert.equal(typeof boot.budgetMs, 'number');
  assert.equal(typeof boot.durationMs, 'number');
});
