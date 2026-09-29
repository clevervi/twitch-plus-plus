import assert from 'node:assert/strict';
import test from 'node:test';

import { CONFIG_VERSION, MIGRATIONS, migrate } from '../src/core/migrations.js';

test('migrate normaliza una config ausente', () => {
  const out = migrate(null);
  assert.equal(out._v, CONFIG_VERSION);
  assert.equal(out.catalog, true);
  assert.equal(typeof out.keybinds, 'object');
});

test('migrate renombra claves de la v1 (hideExt → hideExtensions)', () => {
  const out = migrate({ _v: 0, hideExt: true });
  assert.equal(out.hideExtensions, true);
  assert.equal('hideExt' in out, false);
});

test('migrate rellena las features nuevas sin pisar lo que ya existía', () => {
  const out = migrate({ _v: 4, chatSearch: true, sidebarCompact: true });
  assert.equal(out.chatSearch, true);
  assert.equal(out.sidebarCompact, true);
  assert.equal(out.chatKeywordHighlight, false);
});

test('migrate no rompe si una migración lanza', () => {
  const before = MIGRATIONS.length;
  assert.ok(before >= 5);
  const out = migrate({ _v: 0, keybinds: 'no es un objeto' });
  assert.equal(typeof out.keybinds, 'object');
  assert.equal(out._v, CONFIG_VERSION);
});

test('migrate ignora una config de una versión futura', () => {
  const out = migrate({ _v: 999, darkMode: false });
  assert.equal(out._v, CONFIG_VERSION);
  assert.equal(out.darkMode, false);
});
