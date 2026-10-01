import assert from 'node:assert/strict';
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
});

describe('versionActual', () => {
  it('lee la version de package.json', () => {
    assert.match(versionActual(), /^\d+\.\d+\.\d+$/);
  });
});
