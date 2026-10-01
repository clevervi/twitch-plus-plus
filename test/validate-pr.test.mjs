import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  validarCuerpo,
  validarEtiquetas,
  validarRama,
  validarTitulo,
  issuesEnlazados,
} from '../scripts/validate-pr.mjs';

describe('validarRama', () => {
  it('acepta tipo/descripcion en minusculas', () => {
    for (const rama of ['fix/store-validate', 'feat/nueva-feature', 'chore/github-process', 'docs/readme.es']) {
      assert.equal(validarRama(rama), null, rama);
    }
  });

  it('rechaza ramas sin prefijo o con formato libre', () => {
    for (const rama of ['store-validate', 'fix/Store', 'fix/store validar', 'fix/', 'main', '']) {
      assert.ok(validarRama(rama), rama);
    }
  });
});

describe('validarTitulo', () => {
  it('acepta el formato convencional con y sin ambito', () => {
    for (const titulo of ['fix(store): validar la forma', 'chore: actualizar CI', 'feat(ui)!: romper a proposito']) {
      assert.equal(validarTitulo(titulo), null, titulo);
    }
  });

  it('rechaza titulos que no siguen la convencion', () => {
    for (const titulo of ['Arreglado el store', 'fix(STORE): mayusculas', 'fix(store) sin dos puntos', 'fix(store):']) {
      assert.ok(validarTitulo(titulo), titulo);
    }
  });
});

describe('issuesEnlazados', () => {
  it('reconoce las tres palabras clave y no se repite', () => {
    assert.deepEqual(issuesEnlazados('Closes #12'), [12]);
    assert.deepEqual(issuesEnlazados('fixes #7'), [7]);
    assert.deepEqual(issuesEnlazados('Resolves #3'), [3]);
    assert.deepEqual(issuesEnlazados('Closes #4\n\nTambien Resolves #5\nY closes #4 otra vez'), [4, 5]);
  });

  it('ignora referencias que no cierran el issue', () => {
    assert.deepEqual(issuesEnlazados('Relacionado con #9'), []);
    assert.deepEqual(issuesEnlazados('vease #0'), []);
    assert.deepEqual(issuesEnlazados('resuelve #8, aunque este en español'), []);
    assert.deepEqual(issuesEnlazados(''), []);
    assert.deepEqual(issuesEnlazados(undefined), []);
  });

  it('ignora las referencias escritas dentro de codigo', () => {
    const cuerpo = [
      'Closes #7',
      '',
      '```bash',
      'PR_BODY="Closes #2"   # esto es un ejemplo, no un enlace',
      '```',
      '',
      'Y tampoco cuenta `Closes #3` aqui.',
    ].join('\n');
    assert.deepEqual(issuesEnlazados(cuerpo), [7]);
  });
});

describe('validarCuerpo', () => {
  it('falla cuando no hay ningun enlace', () => {
    assert.ok(validarCuerpo('Solo texto'));
    assert.equal(validarCuerpo('Closes #1'), null);
  });
});

describe('validarEtiquetas', () => {
  it('exige exactamente una etiqueta tipo:', () => {
    assert.equal(validarEtiquetas(['tipo:bug', 'area:core']), null);
    assert.ok(validarEtiquetas(['area:core']));
    assert.ok(validarEtiquetas(['tipo:bug', 'tipo:mejora']));
  });

  it('acepta tanto nombres como objetos con name', () => {
    assert.equal(validarEtiquetas([{ name: 'tipo:chore' }, { name: 'P1:alto' }]), null);
  });
});
