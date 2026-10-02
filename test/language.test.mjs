/**
 * El detector de idioma se amplió a los ficheros que no cubría, y se le añadió
 * una señal que es la que de verdad faltaba: los alfabetos que no son el
 * nuestro.
 *
 * Los casos de abajo son literalmente los que se colaron dos veces seguidas
 * escribiendo documentación, y que el detector original no veía porque solo
 * buscaba palabras inglesas.
 */
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { extname, join, resolve } from 'node:path';
import { describe, it } from 'node:test';

import { hallazgos } from '../tools/check-language.mjs';

const RAIZ = resolve('.');

describe('el detector de idioma', () => {
  it('caza las palabras inglesas en prosa', () => {
    const found = hallazgos('Y 到达 here the problem, con una posibilidad deneiún.');
    const palabras = found.filter((x) => x.tipo === 'palabra').map((x) => x.detalle);
    assert.ok(palabras.includes('the'), 'debe ver la palabra inglesa');
  });

  it('caza los ideogramas, que es lo que se colaba', () => {
    const found = hallazgos('  # 到达 aqui tarde y despues 还用 el otro', { soloComentarios: true });
    const alfabetos = found.filter((x) => x.tipo === 'alfabeto').map((x) => x.detalle);
    assert.ok(alfabetos.includes('ideogramas CJK'));
  });

  it('caza el cirilico', () => {
    const found = hallazgos('Una linea con cirilico: бонус y otra con CJK: 你好');
    const alfabetos = found.filter((x) => x.tipo === 'alfabeto').map((x) => x.detalle);
    assert.ok(alfabetos.includes('cirílico'));
    assert.ok(alfabetos.includes('ideogramas CJK'));
  });

  it('caza el hangul', () => {
    const found = hallazgos('Saludos desde 한국');
    assert.ok(found.some((x) => x.detalle === 'hangul'));
  });

  it('es estable: el mismo texto da el mismo resultado siempre', () => {
    // Los patrones son globales, y con /g `test()` mueve el `lastIndex` entre
    // llamadas. Sin el reset en el detector, la segunda pasada no encuentra lo
    // que la primera sí, y el fallo solo aparece a la tercera.
    const texto = 'una linea con 你好 y бонус';
    const primera = hallazgos(texto);
    const segunda = hallazgos(texto);
    const tercera = hallazgos(texto);
    assert.equal(primera.length, 2);
    assert.deepEqual(segunda, primera, 'la segunda pasada debe dar lo mismo');
    assert.deepEqual(tercera, primera, 'ni la tercera');
  });

  it('deja pasar la prosa en español con jerga del proyecto', () => {
    const lineas = [
      'El build falla si el workflow no pasa el lint.',
      'Se añade la feature de chat y su commit va con Conventional Commits.',
      'Las notas del release se leen del archivo, no de argv.',
      'Hay que hacer push antes de abrir el pull request.',
    ];
    for (const linea of lineas) {
      assert.deepEqual(hallazgos(linea), [], `no debería marcar: ${linea}`);
    }
  });

  it('en un YAML de codigo solo mira los comentarios', () => {
    const codigo = '      - uses: actions/checkout@v4';
    const conCodigo = '      run: echo this and that';
    assert.deepEqual(hallazgos(codigo, { soloComentarios: true }), [], 'el codigo se ignora');
    assert.deepEqual(hallazgos(conCodigo, { soloComentarios: true }), [], 'ni siquiera una linea de shell');
    assert.ok(hallazgos('      # the and with', { soloComentarios: true }).length > 0, 'el comentario si');
    assert.ok(hallazgos('      # 到达', { soloComentarios: true }).length > 0, 'el comentario en otros alfabetos tambien');
  });

  it('ignora identificadores, URLs y codigo en linea', () => {
    for (const linea of [
      'Ver `npm run build` antes de nada.',
      'El boton es data-a-target="user-menu-button".',
      'Docs en https://github.com/clevervi/twitch-plus-plus y ya.',
      'Usa node scripts/build.mjs sin mas.',
    ]) {
      assert.deepEqual(hallazgos(linea), [], `no debería marcar: ${linea}`);
    }
  });
});

describe('el detector cubre lo que hay que revisar', () => {
  const todosLosDoc = [];
  const recorrer = (ruta) => {
    for (const entrada of readdirSync(ruta, { withFileTypes: true })) {
      if (entrada.name === 'node_modules') continue;
      const completa = join(ruta, entrada.name);
      if (entrada.isDirectory()) recorrer(completa);
      else if (['.md', '.yml', '.yaml'].includes(extname(completa))) todosLosDoc.push(completa);
    }
  };
  recorrer(RAIZ);

  it('no se queda ningun .md ni .yml sin revisar', () => {
    // Cada fichero de documentación o plantilla tiene que estar en PROSA o en
    // SOLO_COMENTARIOS. Un fichero nuevo que se cuele fuera del detector sería
    // un agujero, como lo fueron README.md y CHANGELOG.md.
    const fuente = readFileSync(resolve('tools/check-language.mjs'), 'utf8');
    const sinCubrir = todosLosDoc.filter((ruta) => {
      const rel = ruta.slice(RAIZ.length + 1).replace(/\\/g, '/');
      // El directorio, no el fichero: la recursion lo cubre entero.
      if (fuente.includes(rel)) return false;
      const dir = rel.split('/').slice(0, -1).join('/');
      return !(dir && fuente.includes(`'${dir}'`));
    });
    assert.deepEqual(sinCubrir, [], `estos ficheros no los revisa el detector: ${sinCubrir.join(', ')}`);
  });

  it('los bloques de codigo de los .md no se revisan', () => {
    const fuente = readFileSync(resolve('tools/check-language.mjs'), 'utf8');
    assert.match(fuente, /enBloque/, 'debe saltar los bloques cercados de Markdown');
  });
});