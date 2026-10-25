import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';

import { applyCatalog, clearCache, status } from '../src/core/catalog.js';
import { all } from '../src/core/registry.js';

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
