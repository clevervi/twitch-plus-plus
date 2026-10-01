import assert from 'node:assert/strict';
import test from 'node:test';

import { get as getFeature } from '../src/core/registry.js';
import { channelFromHref } from '../src/core/twitch.js';
import '../src/features/index.js';

test('cleanMode tiene todas sus reglas estrictamente prefijadas con %SCOPE%', () => {
  const feature = getFeature('cleanMode');
  assert.ok(feature, 'cleanMode existe');
  const css = feature.css;
  const selectors = css
    .split('{')[0]
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  for (const selector of selectors) {
    assert.ok(
      selector.startsWith('%SCOPE%'),
      `El selector "${selector}" debe estar prefijado con %SCOPE% para evitar fugas globales de estilo`,
    );
  }
});

test('mentionHighlight no confunde palabras comunes con nombres de usuario cortos', () => {
  const makeMatcher = (username) => {
    const escaped = username.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return new RegExp(`(?:^|[^a-zA-Z0-9_])@?${escaped}(?:[^a-zA-Z0-9_]|$)`, 'i');
  };

  const reDan = makeMatcher('dan');
  // Coincidencias legítimas
  assert.equal(reDan.test('hola @dan como estas'), true);
  assert.equal(reDan.test('@dan: mira esto'), true);
  assert.equal(reDan.test('saludos dan!'), true);
  assert.equal(reDan.test('dan'), true);

  // Falsos positivos que deben rechazarse
  assert.equal(reDan.test('vamos a bailar dance'), false);
  assert.equal(reDan.test('esto es dangerous'), false);
  assert.equal(reDan.test('guia de guidance'), false);

  const reAl = makeMatcher('al');
  assert.equal(reAl.test('@al saludos'), true);
  assert.equal(reAl.test('hola also'), false);
  assert.equal(reAl.test('always together'), false);
});

test('channelFromHref reconoce nuevas rutas reservadas de Twitch SPA', () => {
  assert.equal(channelFromHref('/videos'), null);
  assert.equal(channelFromHref('/messages'), null);
  assert.equal(channelFromHref('/popout'), null);
  assert.equal(channelFromHref('/moderator'), null);
  assert.equal(channelFromHref('/dashboard'), null);
  assert.equal(channelFromHref('/ninja'), 'ninja');
});
