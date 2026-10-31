import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { clampPlacement } from '../src/ui/panel.js';
import { PANEL_CSS } from '../src/ui/panel-css.js';

/** Reglas del bloque `.fab` y sus modificadores, sin depender de un navegador. */
function reglasFab(css) {
  const bloque = css.match(/\.fab \{([^}]*)\}/);
  assert.ok(bloque, 'debe existir la regla base .fab');
  const base = Object.fromEntries(
    bloque[1]
      .split(';')
      .map((linea) => linea.trim())
      .filter(Boolean)
      .map((linea) => {
        const [propiedad, valor] = linea.split(':');
        return [propiedad.trim(), valor.trim()];
      }),
  );
  return { base, css };
}

describe('el boton flotante nunca es invisible', () => {
  it('la regla base no lo deja en opacity 0', () => {
    const { base } = reglasFab(PANEL_CSS);
    assert.notEqual(base.opacity, '0', 'un boton flotante invisible no puede ser el estado por defecto');
    assert.ok(Number.parseFloat(base.opacity) > 0, `opacity base es "${base.opacity}"`);
  });

  it('la regla base lo deja pulsable', () => {
    const { base } = reglasFab(PANEL_CSS);
    assert.equal(base['pointer-events'], 'auto', 'con pointer-events: none el boton no se puede pulsar');
  });

  it('ningun estado lo devuelve a invisible', () => {
    // El fallo anterior era que `awake`/`near`/`hover` lo sacaban de cero.
    // Ahora las clases suben opacidad; ninguna la baja a 0.
    for (const clase of ['awake', 'reveal', 'flash', 'near', 'hover', 'active', 'dragging']) {
      const regla = PANEL_CSS.match(new RegExp(`\\.fab\\.${clase}[^{]*\\{([^}]*)\\}`));
      if (!regla) continue;
      const opacidad = regla[1].match(/opacity:\s*([^;]+)/);
      if (!opacidad) continue;
      assert.notEqual(
        opacidad[1].trim(),
        '0',
        `.fab.${clase} lo devuelve a opacity 0`,
      );
    }
  });

  it('los estados activos suben la opacidad por encima de la base', () => {
    const { base } = reglasFab(PANEL_CSS);
    const baseValor = Number.parseFloat(base.opacity);
    const cerca = PANEL_CSS.match(/\.fab\.near \{([^}]*)\}/);
    assert.ok(cerca, 'debe existir .fab.near');
    const cercaValor = Number.parseFloat(cerca[1].match(/opacity:\s*([^;]+)/)[1]);
    assert.ok(cercaValor > baseValor, `near (${cercaValor}) debe verse mas que la base (${baseValor})`);
  });
});

describe('el boton flotante se recorta a la ventana', () => {
  it('una posicion guardada fuera de pantalla se mete dentro', () => {
    const pos = clampPlacement(5000, 5000, 1400, 900);
    assert.equal(pos.right, 1360);
    assert.equal(pos.bottom, 860);
    assert.ok(pos.x >= 0 && pos.x < 1400, `x=${pos.x}`);
    assert.ok(pos.y >= 0 && pos.y < 900, `y=${pos.y}`);
    assert.ok(pos.right + 40 <= 1400, 'el host entero debe caber a lo ancho');
    assert.ok(pos.bottom + 40 <= 900, 'el host entero debe caber a lo alto');
  });

  it('una posicion negativa se pega al borde', () => {
    const pos = clampPlacement(-50, -50, 1400, 900);
    assert.equal(pos.right, 0);
    assert.equal(pos.bottom, 0);
    assert.equal(pos.x, 1380);
    assert.equal(pos.y, 880);
  });

  it('tolera ventanas mas pequenas que el propio boton', () => {
    const pos = clampPlacement(100, 100, 20, 20);
    assert.equal(pos.right, 0);
    assert.equal(pos.bottom, 0);
    assert.equal(pos.x, 0);
    assert.equal(pos.y, 0);
  });
});
