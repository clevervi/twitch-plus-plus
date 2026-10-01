import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { apartado, avisarDeAcentos, encadenar, leerNotas, subirVersion } from '../scripts/bump.mjs';

describe('subirVersion', () => {
  it('suma en el sitio correcto', () => {
    assert.equal(subirVersion('2.2.11', 'patch'), '2.2.12');
    assert.equal(subirVersion('2.2.11', 'minor'), '2.3.0');
    assert.equal(subirVersion('2.2.11', 'major'), '3.0.0');
  });

  it('tolera un cero de más de la cuenta', () => {
    assert.equal(subirVersion('0.0.0', 'patch'), '0.0.1');
    assert.equal(subirVersion('1', 'minor'), '1.1.0');
  });

  it('rechaza un nivel que no existe', () => {
    assert.throws(() => subirVersion('2.2.11', 'fix'), /nivel desconocido/);
    assert.throws(() => subirVersion('2.2.11', ''), /nivel desconocido/);
  });
});

describe('leerNotas', () => {
  it('une los argumentos sueltos en un solo texto', () => {
    assert.equal(leerNotas(['patch', 'nota', 'con', 'palabras']), 'nota con palabras');
  });

  it('lee de un archivo cuando el argumento empieza por arroba', () => {
    const notas = leerNotas(['patch', '@CHANGELOG.md']);
    assert.ok(notas.length > 0, 'debe leer el contenido del archivo');
    assert.match(notas, /Changelog/, 'y debe ser el contenido del archivo, no la ruta');
  });

  it('falla claro si el archivo no existe', () => {
    assert.throws(() => leerNotas(['patch', '@no-existe-este-archivo.md']), /no encuentro el archivo/);
  });

  it('devuelve vacío si no hay notas', () => {
    assert.equal(leerNotas(['patch']), '');
  });
});

describe('apartado', () => {
  it('convierte cada línea en viñeta', () => {
    const texto = apartado('2.2.12', '2026-10-02', 'primera\nsegunda');
    assert.match(texto, /## 2\.2\.12 — 2026-10-02/);
    assert.match(texto, /^- primera$/m);
    assert.match(texto, /^- segunda$/m);
  });

  it('no duplica el guion de las que ya lo traen', () => {
    const texto = apartado('2.2.12', '2026-10-02', '- ya es viñeta');
    assert.match(texto, /^- ya es viñeta$/m);
    assert.equal((texto.match(/^- -/gm) || []).length, 0, 'no debe salir "--"');
  });

  it('pone algo cuando no hay notas, en vez de un apartado vacío', () => {
    assert.match(apartado('2.2.12', '2026-10-02', ''), /- pendiente de describir/);
    assert.match(apartado('2.2.12', '2026-10-02', '   '), /- pendiente de describir/);
  });

  it('conserva los acentos tal cual', () => {
    const texto = apartado('2.2.12', '2026-10-02', '- **Botón** visible: `¿sí?`');
    assert.match(texto, /Botón/);
    assert.match(texto, /¿sí\?/);
    assert.equal(/Boton/.test(texto), false, 'no debe perder el acento');
  });
});

describe('encadenar', () => {
  it('deja una linea en blanco entre secciones', () => {
    // Regresion real: al quitar este salto, el apartado nuevo se pegaba al
    // ultimo parrafo del anterior y el CHANGELOG quedaba sin separacion.
    const antes = '# Changelog\n\n## 2.2.11 — 2026-10-01\n\n- algo\n';
    const texto = encadenar(antes, apartado('2.2.12', '2026-10-02', '- nuevo'));
    assert.match(texto, /- algo\n\n## 2\.2\.12/, 'debe haber una linea en blanco entre secciones');
  });

  it('respeta el em dash del encabezado', () => {
    const texto = encadenar('# Changelog\n', apartado('2.2.12', '2026-10-02', '- x'));
    assert.match(texto, /^## 2\.2\.12 — 2026-10-02$/m, 'guion largo, no guion corto');
  });

  it('no duplica lineas en blanco aunque el changelog venga con cola', () => {
    const antes = '# Changelog\n\n\n\n';
    const texto = encadenar(antes, apartado('2.2.12', '2026-10-02', '- x'));
    assert.equal((texto.match(/\n{4,}/g) || []).length, 0, 'no debe dejar mas de dos saltos');
  });

  it('funciona con un changelog vacio', () => {
    const texto = encadenar('', apartado('1.0.0', '2026-10-02', '- primera'));
    assert.match(texto, /## 1\.0\.0 — 2026-10-02\n\n- primera/);
  });
});

describe('aviso de acentos', () => {
  it('avisa cuando el castellano ha llegado sin acentos', () => {
    // Esto es exactamente lo que pasó con las notas de 2.2.10.
    const sinAcentos = '- Boton flotante: se arregla el boton y el panel de la configuracion';
    assert.match(avisarDeAcentos(sinAcentos), /línea de comandos/);
  });

  it('no avisa si el texto sí tiene acentos', () => {
    assert.equal(avisarDeAcentos('- Botón flotante visible'), null);
  });

  it('no avisa si las notas están en inglés', () => {
    assert.equal(avisarDeAcentos('- fix the floating button visibility'), null);
  });

  it('no avisa si no hay notas', () => {
    assert.equal(avisarDeAcentos(''), null);
    assert.equal(avisarDeAcentos(null), null);
  });

  it('no avisa de textos que no son prosa, como una lista de archivos', () => {
    assert.equal(avisarDeAcentos('- src/core/dom.js\n- src/core/perf.js'), null);
  });
});
