import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { MAX_PATRON, compilarSeguro, patronPeligroso } from '../src/core/regex.js';

describe('compilarSeguro', () => {
  it('rechaza los cuantificadores anidados antes de compilar', () => {
    for (const patron of ['(a+)+$', '(a*)*', '(\\w+)*', '(x|y)+z', '(a|b){2,}c', '^a(a+)+$']) {
      const { regex, rechazado } = compilarSeguro(patron);
      assert.equal(regex, null, `${patron} no debe llegar a compilarse`);
      assert.ok(rechazado, `${patron} debe explicar por qué`);
    }
  });

  it('no ejecuta jamas un patron peligroso, ni una vez', () => {
    // Si devolviera la regex, este test se quedaría colgado: 137 segundos
    // medidos en este repo para una sola línea de 41 caracteres.
    const { regex } = compilarSeguro('(a+)+$');
    assert.equal(regex, null);
  });

  it('rechaza por longitud, sin intentar compilar', () => {
    const { regex, rechazado } = compilarSeguro('a'.repeat(MAX_PATRON + 1));
    assert.equal(regex, null);
    assert.match(rechazado, new RegExp(String(MAX_PATRON)));
  });

  it('acepta justo el limite de longitud', () => {
    const { regex, rechazado } = compilarSeguro('a'.repeat(MAX_PATRON));
    assert.equal(rechazado, '', 'el límite es inclusivo');
    assert.ok(regex, 'y compila');
  });

  it('un patron corriente se compila y funciona', () => {
    const { regex, rechazado } = compilarSeguro('hola|adios');
    assert.equal(rechazado, '');
    assert.equal(regex.test('HOLA a todos'), true);
    assert.equal(regex.test('nada que ver'), false);
  });

  it('un patron con sintaxis invalida no se marca como peligroso', () => {
    const { regex, rechazado } = compilarSeguro('((((');
    assert.equal(regex, null, 'no compila');
    assert.equal(rechazado, '', 'es un error de quien escribe, no un ataque: no se avisa');
  });

  it('una entrada vacia o que no es cadena no rompe', () => {
    for (const valor of ['', null, undefined, 42, {}]) {
      const { regex, rechazado } = compilarSeguro(valor);
      assert.equal(regex, null);
      assert.equal(rechazado, '');
    }
  });

  it('respeta las banderas que se le pasen', () => {
    assert.equal(compilarSeguro('hola', 'i').regex.test('HOLA'), true);
    assert.equal(compilarSeguro('hola', 'g').regex.test('HOLA'), false, 'sin la i no casa');
  });
});

describe('patronPeligroso', () => {
  it('no confunde los cuantificadores normales', () => {
    for (const patron of ['^\\d+$', 'a+b?', '[a-z]{2,4}', 'gracias!', '\\w+@\\w+', 'mira (esto)', '(a|b)']) {
      assert.equal(patronPeligroso(patron), false, `${patron} no es peligroso`);
    }
  });

  it('detecta las tres formas de anidamiento', () => {
    assert.equal(patronPeligroso('(a+)+$'), true, 'grupo con cuantificador dentro, repetido');
    assert.equal(patronPeligroso('(a|b)+'), true, 'alternancia repetida');
    assert.equal(patronPeligroso('(a){2,}'), true, 'grupo con rango repetido');
  });

  it('no lanza con basura', () => {
    for (const valor of [null, undefined, 42, {}]) {
      assert.equal(patronPeligroso(valor), false);
    }
  });
});
