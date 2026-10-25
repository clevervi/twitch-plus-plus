import assert from 'node:assert/strict';
import test from 'node:test';

import { get } from '../src/core/registry.js';
import { isRelevant } from '../src/features/chat-focus.js';
import { buildMentionPattern } from '../src/features/mention-highlight.js';

test('el patrón de mención reconoce al usuario sin confundir palabras', () => {
  const pattern = buildMentionPattern('dan');

  assert.equal(pattern.test('hola @dan, mira esto'), true);
  assert.equal(pattern.test('dan: saludos'), true);
  assert.equal(pattern.test('vamos a bailar dance'), false);
  assert.equal(pattern.test('esto es dangerous'), false);
});

test('una línea es relevante por mención, por palabra clave o por ambos', () => {
  const mention = buildMentionPattern('dan');
  const keyword = (text) => text.includes('raid');

  assert.equal(isRelevant('hola @dan', mention, null), true);
  assert.equal(isRelevant('preparando el raid', null, keyword), true);
  assert.equal(isRelevant('@dan al raid', mention, keyword), true);
  assert.equal(isRelevant('hola a todos', mention, keyword), false);
});

test('sin criterios no se oculta nada', () => {
  assert.equal(isRelevant('cualquier mensaje', null, null), true);
});

test('chatFocus se declara en Chat y comparte los ajustes de palabras clave', () => {
  const feature = get('chatFocus');

  assert.ok(feature, 'la feature debe estar registrada');
  assert.equal(feature.section, 'chat');
  assert.equal(feature.default, false);
  assert.deepEqual(
    feature.settings.map((setting) => setting.key),
    ['chatFocusMode', 'chatKeywords', 'chatKeywordRegex'],
  );
});
