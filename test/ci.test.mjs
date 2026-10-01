import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, it } from 'node:test';

/**
 * `ci.yml` llama a `npm run verify` en lugar de reimplementar los pasos.
 *
 * Ya pasó una vez: `verify` tenía cuatro pasos y `ci.yml` repetía tres a
 * mano. El que faltaba, el detector de idioma, no se ejecutó en ningún PR sin
 * que nadie lo notase. Este test convierte ese olvido en un fallo visible.
 */
const CI = readFileSync(resolve(process.cwd(), '.github/workflows/ci.yml'), 'utf8');
const PKG = JSON.parse(readFileSync(resolve(process.cwd(), 'package.json'), 'utf8'));

describe('la CI no se desincroniza de npm run verify', () => {
  it('ci.yml llama a npm run verify en vez de repetir los pasos', () => {
    assert.match(CI, /run:\s*npm run verify/, 'ci.yml debe delegar en npm run verify');
  });

  it('verify cubre las cuatro comprobaciones', () => {
    const pasos = PKG.scripts.verify.split('&&').map((paso) => paso.trim());
    assert.deepEqual(pasos, [
      'node scripts/lint.mjs',
      'node tools/check-language.mjs',
      'node scripts/build.mjs',
      'node --test test/*.test.mjs',
    ], 'si añades un paso a verify, la CI lo hereda solo; no hace falta tocar ci.yml');
  });

  it('verify NO se come la suite de navegador', () => {
    // `node --test` a secas descubre test/browser/ también, y entonces
    // verificar exigira Playwright instalado. El glob es lo que mantiene
    // `npm run verify` funcionando sin `npm install`.
    assert.match(PKG.scripts.verify, /--test test\/\*\.test\.mjs/);
    assert.doesNotMatch(PKG.scripts.verify, /--test\s*$/, 'un --test a secas arrastraría los tests de navegador');
  });

  it('ci.yml no ejecuta lint.mjs ni check-language.mjs por su cuenta', () => {
    assert.doesNotMatch(CI, /scripts\/lint\.mjs/, 'el lint solo se ejecuta a través de verify');
    assert.doesNotMatch(CI, /check-language\.mjs/, 'el detector de idioma solo se ejecuta a través de verify');
  });

  it('la comprobacion de que dist no ha derivado sigue en ci.yml', () => {
    // Solo se puede comprobar DESPUÉS de construir, así que no puede vivir
    // dentro de verify: si el build falla, el diff se compara contra un bundle
    // a medias y el resultado no significa nada.
    assert.match(CI, /git diff --exit-code dist\//, 'el guard de dist debe quedarse en CI');
  });

  it('la validacion de YAML sigue en ci.yml', () => {
    assert.match(CI, /YAML\.load_file/, 'los YAML de .github no se comprueban en npm run verify');
  });
});
