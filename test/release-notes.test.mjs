import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';

import { seccionDelChangelog, versionActual } from '../scripts/release-notes.mjs';

const CHANGELOG = [
  '# Changelog',
  '',
  '## 2.2.9 — 2026-10-01',
  '',
  '- primera nota',
  '',
  '## 2.2.10 — 2026-10-01',
  '',
  '- **Grants**: dos @grant añadidos.',
  '- **managerName()**: corregido.',
  '',
  '## 2.3.0 — 2026-10-02',
  '',
  '- nota de la siguiente',
].join('\n');

describe('seccionDelChangelog', () => {
  it('devuelve solo el apartado pedido', () => {
    assert.equal(
      seccionDelChangelog(CHANGELOG, '2.2.10'),
      '- **Grants**: dos @grant añadidos.\n- **managerName()**: corregido.',
    );
  });

  it('no se confunde con un prefijo de version', () => {
    assert.equal(seccionDelChangelog(CHANGELOG, '2.2.1'), '');
    assert.equal(seccionDelChangelog(CHANGELOG, '2.2'), '');
  });

  it('acepta guion corto y guion largo como separador', () => {
    const conGuionCorto = '# Changelog\n\n## 1.0.0 - 2026-01-01\n\n- nota\n';
    assert.equal(seccionDelChangelog(conGuionCorto, '1.0.0'), '- nota');
  });

  it('devuelve vacio si la version no esta', () => {
    assert.equal(seccionDelChangelog(CHANGELOG, '9.9.9'), '');
    assert.equal(seccionDelChangelog('', '2.2.10'), '');
  });

  it('no corta el apartado en un subtitulo', () => {
    const conSubtitulos = [
      '# Changelog',
      '',
      '## 2.2.22 — 2026-10-03',
      '',
      '### Mejora',
      '',
      '- algo nuevo',
      '',
      '## 2.2.21 — 2026-10-03',
      '',
      '- otra cosa',
    ].join('\n');
    assert.equal(seccionDelChangelog(conSubtitulos, '2.2.22'), '### Mejora\n\n- algo nuevo');
  });
});

describe('orden del CHANGELOG', () => {
  it('va de la version mas alta a la mas baja', () => {
    const changelog = readFileSync(new URL('../CHANGELOG.md', import.meta.url), 'utf8');
    const versiones = [...changelog.matchAll(/^## (\d+)\.(\d+)\.(\d+)/gm)].map((m) =>
      [Number(m[1]), Number(m[2]), Number(m[3])],
    );
    assert.ok(versiones.length > 0, 'el CHANGELOG debe tener apartados');
    for (let i = 1; i < versiones.length; i += 1) {
      const [a1, a2, a3] = versiones[i - 1];
      const [b1, b2, b3] = versiones[i];
      const descendente = b1 < a1 || (b1 === a1 && (b2 < a2 || (b2 === a2 && b3 < a3)));
      assert.ok(descendente, `${versiones[i - 1].join('.')} debe ir antes que ${versiones[i].join('.')}`);
    }
  });

  it('empieza por la version de package.json', () => {
    const changelog = readFileSync(new URL('../CHANGELOG.md', import.meta.url), 'utf8');
    const primera = /^## (\d+\.\d+\.\d+)/m.exec(changelog);
    assert.ok(primera, 'el CHANGELOG debe tener apartados');
    assert.equal(primera[1], versionActual());
  });

  it('no deja encabezados convertidos en viñetas', () => {
    const changelog = readFileSync(new URL('../CHANGELOG.md', import.meta.url), 'utf8');
    assert.equal(/^-\s+#{2,6}\s/m.test(changelog), false, 'quedan lineas "- ## Titulo"');
  });
});

describe('versionActual', () => {
  it('lee la version de package.json', () => {
    assert.match(versionActual(), /^\d+\.\d+\.\d+$/);
  });
});
