import assert from 'node:assert/strict';
import test from 'node:test';

import { applyRemote, candidates, clearRemote, isValidSelector, select, selectAll, snapshot } from '../src/core/selectors.js';

function root(matches) {
  return {
    querySelector: (selector) => (Object.hasOwn(matches, selector) ? { selector } : null),
    querySelectorAll: (selector) => (matches[selector] ?? []).map((value) => ({ value })),
  };
}

test('prueba los candidatos en orden y devuelve el primero que existe', () => {
  const found = select('chat.container', root({ '.chat-scrollable-area__message-container': {} }));
  assert.equal(found.selector, '.chat-scrollable-area__message-container');
  assert.equal(select('chat.line', root({})), null);
});

test('un selector inválido no rompe la búsqueda', () => {
  const broken = {
    querySelector(selector) {
      if (selector === '[[[') throw new SyntaxError('selector inválido');
      return { selector };
    },
    querySelectorAll: () => [],
  };
  assert.equal(select('chat.container', broken).selector.endsWith(']'), true);
});

test('selectAll devuelve la lista del primer candidato con resultados', () => {
  const list = selectAll('chat.line', root({ '[data-a-target="chat-line-message"]': [1, 2, 3] }));
  assert.equal(list.length, 3);
});

test('applyRemote antepone candidatos remotos y conserva los locales', () => {
  clearRemote();
  const before = candidates('chat.container').length;
  const result = applyRemote({ 'chat.container': ['[data-test-selector="nuevo"]'] });

  assert.deepEqual(result.applied, ['chat.container']);
  assert.equal(candidates('chat.container')[0], '[data-test-selector="nuevo"]');
  assert.equal(candidates('chat.container').length, before + 1);
});

test('applyRemote rechaza claves desconocidas y selectores sospechosos', () => {
  clearRemote();
  const result = applyRemote({
    'clave.inventada': ['[data-x]'],
    'chat.line': ['body { display: none }', 'a[href="javascript:alert(1)"]', 'url(x)'],
  });
  assert.deepEqual(result.applied, []);
  assert.equal(result.rejected.length, 2); // la clave inventada + la lista de selectores inválidos
  assert.equal(candidates('chat.line').length, 2); // solo los locales
});

test('isValidSelector filtra lo sospechoso', () => {
  assert.equal(isValidSelector('[data-a-target="chat-line-message"]'), true);
  assert.equal(isValidSelector('div{}'), false);
  assert.equal(isValidSelector('div; color:red'), false);
  assert.equal(isValidSelector('a[href="x"]'), true);
  assert.equal(isValidSelector(''), false);
  assert.equal(isValidSelector(42), false);
  assert.equal(isValidSelector('x'.repeat(400)), false);
});

test('clearRemote deja el registro como estaba', () => {
  applyRemote({ 'sideNav.card': ['[data-test-selector="side-nav-card"]'] });
  assert.equal(candidates('sideNav.card').length > 2, true);
  clearRemote();
  assert.equal(candidates('sideNav.card').length, 2);
  assert.equal(Object.keys(snapshot()).length > 10, true);
});
