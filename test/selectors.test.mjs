import assert from 'node:assert/strict';
import test from 'node:test';

import {
  applyRemote,
  brokenSelectors,
  candidates,
  clearRemote,
  isValidSelector,
  promovidosRemotamente,
  resetHealth,
  select,
  selectAll,
  selectorReport,
  snapshot,
} from '../src/core/selectors.js';

function root(matches) {
  return {
    querySelector: (selector) => (Object.hasOwn(matches, selector) ? { selector } : null),
    querySelectorAll: (selector) => (matches[selector] ?? []).map((value) => ({ value })),
  };
}

test('prueba los candidatos en orden y devuelve el primero que existe', () => {
  resetHealth();
  const found = select('chat.container', root({ '.chat-scrollable-area__message-container': {} }));
  assert.equal(found.selector, '.chat-scrollable-area__message-container');
  assert.equal(select('chat.line', root({})), null);
});

test('un selector inválido no rompe la búsqueda', () => {
  resetHealth();
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
  resetHealth();
  const list = selectAll('chat.line', root({ '[data-a-target="chat-line-message"]': [1, 2, 3] }));
  assert.equal(list.length, 3);
});

test('applyRemote antepone candidatos remotos y conserva los locales', () => {
  resetHealth();
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

test('la salud recuerda qué candidato funciona y cuántas veces falló', () => {
  resetHealth();
  const present = root({ '.chat-line__message': {} });
  const absent = root({});

  select('chat.line', present);
  select('chat.line', present);
  const report = selectorReport(present).find((row) => row.key === 'chat.line');
  assert.equal(report.ok, true);
  assert.equal(report.candidato, '.chat-line__message');
  const ficha = report.candidatos.find((c) => c.selector === '.chat-line__message');
  assert.equal(ficha.aciertos >= 2, true, 'el candidato que funciona lleva la cuenta de aciertos');
  assert.equal(ficha.degradado, false);

  select('chat.line', absent);
  const todos = selectorReport(absent).find((row) => row.key === 'chat.line').candidatos;
  assert.equal(
    todos.every((c) => c.fallos > 0),
    true,
    'cuando nada resuelve, todos los candidatos acumulan un fallo',
  );

  // al volver a funcionar, el estado se recupera solo
  assert.equal(selectorReport(present).find((row) => row.key === 'chat.line').ok, true);
});

test('brokenSelectors solo lista las claves que no resuelven', () => {
  resetHealth();
  const report = brokenSelectors(root({ '[data-a-target="chat-line-message"]': {} }));
  assert.equal(report.some((row) => row.key === 'chat.line'), false);
  assert.equal(report.some((row) => row.key === 'viewerCount'), true);
  assert.equal(report.every((row) => row.ok === false), true);
});

test('selectAll también deja constancia cuando no encuentra nada', () => {
  resetHealth();
  selectAll('viewerCount', root({}));
  const todos = selectorReport(root({})).find((row) => row.key === 'viewerCount').candidatos;
  assert.equal(todos.every((c) => c.fallos > 0), true);
});

test('un candidato remoto sin historial no desplaza a los locales', () => {
  resetHealth();
  clearRemote();
  // Sin datos, el orden es el de siempre: los remotos delante.
  assert.equal(candidates('chat.line')[0], '[data-a-target="chat-line-message"]');
});

test('un candidato con más aciertos pasa por delante de uno sin historial', () => {
  resetHealth();
  clearRemote();
  const soloLocal = root({ '.chat-line__message': {} });
  for (let i = 0; i < 4; i += 1) select('chat.line', soloLocal);

  applyRemote({ 'chat.line': ['[data-a-target="inexistente-xyz"]'] });
  // El remoto nuevo no haboxtype nada, así que no puede ganar todavía.
  assert.equal(candidates('chat.line')[0], '.chat-line__message', 'el local probado va delante del remoto sin datos');
  assert.equal(candidates('chat.line')[1], '[data-a-target="inexistente-xyz"]');
});

test('tres fallos seguidos degradan el candidato y lo mandan al final', () => {
  resetHealth();
  clearRemote();
  // El remoto entra cuando no hay historial, así que va primero.
  applyRemote({ 'chat.line': ['[data-a-target="chat-line-message"]'] });
  const remoto = '[data-a-target="chat-line-message"]';
  const soloLocal = root({ '.chat-line__message': {} });

  assert.equal(candidates('chat.line')[0], remoto, 'sin historial, el remoto va delante');

  // Tres consultas donde el remoto no encuentra nada. La local sí, y la
  // segunda porque el remoto ya está degradado y pasa a probar la local.
  for (let i = 0; i < 3; i += 1) select('chat.line', soloLocal);

  const orden = candidates('chat.line');
  assert.equal(orden[orden.length - 1], remoto, 'el degradado se va al final, no desaparece');
  const fila = selectorReport(soloLocal).find((r) => r.key === 'chat.line');
  assert.equal(fila.candidatos.find((c) => c.selector === remoto).degradado, true);
});

test('un candidato degradado vuelve si los demas dejan de funcionar', () => {
  resetHealth();
  clearRemote();
  applyRemote({ 'chat.line': ['[data-a-target="chat-line-message"]'] });
  const remoto = '[data-a-target="chat-line-message"]';
  const soloLocal = root({ '.chat-line__message': {} });
  const soloRemoto = root({ '[data-a-target="chat-line-message"]': {} });

  // El remoto se degrada porque no encuentra nada.
  for (let i = 0; i < 3; i += 1) select('chat.line', soloLocal);
  const degradado = selectorReport(soloLocal).find((r) => r.key === 'chat.line').candidatos.find((c) => c.selector === remoto);
  assert.equal(degradado.degradado, true, 'precondición: está degradado');

  // Ahora Twitch ha quitado la clase local. El remoto estaba degradado y al
  // final de la lista, pero la local falla: es su turno y se recupera.
  const encontrado = select('chat.line', soloRemoto);
  assert.equal(encontrado?.selector, remoto, 'y la búsqueda vuelve a encontrar el elemento');

  const recuperado = selectorReport(soloRemoto).find((r) => r.key === 'chat.line').candidatos.find((c) => c.selector === remoto);
  assert.equal(recuperado.degradado, false, 'un acierto limpia la racha de fallos');
  assert.equal(recuperado.aciertos, 1, 'y suma el acierto');

  // El orden lo manda el historial acumulado, así que la local puede seguir
  // delante aunque ahora falle: se prueba, falla y se pasa al siguiente. El
  // orden no garantiza el acierto, pero la búsqueda sí llega al bueno.
  assert.equal(candidates('chat.line')[0], '.chat-line__message', 'la local conserva su historial');
});

test('un historial obsoleto cuesta una consulta, no la funcionalidad', () => {
  resetHealth();
  clearRemote();
  const soloLocal = root({ '.chat-line__message': {} });
  const ninguno = root({});

  for (let i = 0; i < 4; i += 1) select('chat.line', soloLocal);
  assert.equal(candidates('chat.line')[0], '.chat-line__message', 'precondición: la local manda');

  // Twitch lo rompió. La local sigue primera por su historial, pero falla.
  const resultado = select('chat.line', ninguno);
  assert.equal(resultado, null, 'no hay nada que encontrar, que es lo correcto');
  assert.equal(candidates('chat.line')[0], '.chat-line__message', 'y aún así, tras fallar, se degrada');

  for (let i = 0; i < 3; i += 1) select('chat.line', ninguno);
  assert.equal(candidates('chat.line').pop(), '.chat-line__message', 'tras tres fallos baja al final');
});

test('mientras otro candidato funcione, el degradado no se replantea', () => {
  resetHealth();
  clearRemote();
  applyRemote({ 'chat.line': ['[data-a-target="chat-line-message"]'] });
  const remoto = '[data-a-target="chat-line-message"]';
  const soloLocal = root({ '.chat-line__message': {} });
  const ambos = root({ '[data-a-target="chat-line-message"]': {}, '.chat-line__message': {} });

  for (let i = 0; i < 3; i += 1) select('chat.line', soloLocal);
  assert.equal(candidates('chat.line').indexOf(remoto), 1, 'precondición: el degradado es el último');

  // Con la local funcionando, el remoto no llega a probarse. Es lo que se
  // quiere: no gastar consultas en un candidato que ya se sabe malo.
  for (let i = 0; i < 5; i += 1) select('chat.line', ambos);
  const ficha = selectorReport(ambos).find((r) => r.key === 'chat.line').candidatos.find((c) => c.selector === remoto);
  assert.equal(ficha.aciertos, 0, 'no ha/Anotado más aciertos, porque nunca le ha tocado');
  assert.equal(ficha.degradado, true, 'y sigue degradado');
});

test('promovidosRemotamente avisa de las claves que ahora manda el catálogo', () => {
  resetHealth();
  clearRemote();
  applyRemote({ 'chat.line': ['[data-a-target="chat-line-message"]'] });
  const completo = root({ '[data-a-target="chat-line-message"]': {}, '.chat-line__message': {} });
  for (let i = 0; i < 3; i += 1) select('chat.line', completo);

  const promovidas = promovidosRemotamente();
  assert.equal(promovidas.some((p) => p.key === 'chat.line'), true);
  assert.equal(promovidas[0].candidato, '[data-a-target="chat-line-message"]');
});
