import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { buildMatcher } from '../src/features/chat-search.js';
import { get as storeGet, set as storeSet } from '../src/core/store.js';

storeSet('chatSearchRegex', true);

describe('el buscador de chat no se puede colgar', () => {
  it('rechaza los cuantificadores anidados antes de compilar', () => {
    // El clásico: compila bien y se pasa minutos calculando.
    for (const patron of ['(a+)+$', '(a*)*', '(\\w+)*', '(x|y)+z', '(a|b){2,}c']) {
      const matcher = buildMatcher(patron);
      assert.equal(matcher.regex, null, `${patron} no debe llegar a compilarse`);
      assert.ok(matcher.rechazado, `${patron} debe explicar por qué se rechaza`);
    }
  });

  it('no ejecuta jamas un patron peligroso, ni una vez', () => {
    // Si esto se colgara, el propio test se quedaría colgado: el patron con
    // 30 caracteres y texto de 40 ya es mortal. La aserción es que buildMatcher
    // devuelve sin regex, y por tanto test() nunca llega a llamarse.
    const matcher = buildMatcher('(a+)+$');
    assert.equal(matcher.regex, null);
    assert.equal(matcher.texto, '(a+)+$', 'pero el texto plano sigue disponible');
  });

  it('rechaza un patron mas largo que el limite, sin mirarlo', () => {
    const matcher = buildMatcher('a'.repeat(500));
    assert.equal(matcher.regex, null);
    assert.match(matcher.rechazado, /largo/);
  });

  it('un patron valido y corriente se compila y funciona', () => {
    const matcher = buildMatcher('mensajes');
    assert.equal(matcher.rechazado, '');
    assert.ok(matcher.regex, 'debe compilar');
    assert.equal(matcher.regex.test('otro MENSAJES aqui'), true);
    assert.equal(matcher.regex.test('nada que ver'), false);
  });

  it('no marca como peligroso un cuantificador que NO es anidado', () => {
    // Falsos positivos que hay que evitar: esto es lo que se usa de verdad.
    // Un patrón válido compila; lo que no debe pasar es que se rechace.
    for (const patron of ['^\\d+$', 'a+b?', '[a-z]{2,4}', 'gracias!', '\\w+@\\w+', 'mira (esto)']) {
      const matcher = buildMatcher(patron);
      assert.equal(matcher.rechazado, '', `${patron} no debe marcarse como peligroso`);
    }
    // Y un paréntesis normal, sin cuantificador detrás, tampoco se confunde.
    assert.ok(buildMatcher('^\\d+$').regex, 'un cuantificador simple sigue compilando');
  });

  it('un patron con sintaxis invalida cae a texto plano sin avisar de peligro', () => {
    const matcher = buildMatcher('((((');
    assert.equal(matcher.regex, null, 'no compila');
    assert.equal(matcher.rechazado, '', 'es un error de quien escribe, no un ataque');
  });
});

describe('sin la opcion de expresion regular no cambia nada', () => {
  it('busca en texto plano aunque el usuario escriba parentesis', () => {
    storeSet('chatSearchRegex', false);
    try {
      const matcher = buildMatcher('(a+)+$');
      assert.equal(matcher.regex, null, 'en modo texto no se compila nada');
      assert.equal(matcher.rechazado, '', 'y no hay motivo para quejarse');
      assert.equal(matcher.texto, '(a+)+$');
    } finally {
      storeSet('chatSearchRegex', true);
    }
  });
});

describe('el store sigue guardando la preferencia', () => {
  it('la opcion es un booleano de verdad', () => {
    assert.equal(typeof storeGet('chatSearchRegex'), 'boolean');
  });
});
