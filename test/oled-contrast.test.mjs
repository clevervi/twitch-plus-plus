import assert from 'node:assert/strict';
import { beforeEach, describe, it } from 'node:test';

import { createDomStub } from '../tools/dom-stub.mjs';
import { apply, defineFeature, get as getFeature, isActive } from '../src/core/registry.js';
import { get as storeGet, set as storeSet } from '../src/core/store.js';
import '../src/features/dark-mode.js';

const documentOriginal = globalThis.document;
const getComputedStyleOriginal = globalThis.getComputedStyle;

/** Simula el tema de Twitch y devuelve si la feature queda activa. */
function montar(tema) {
  const stub = createDomStub();
  globalThis.document = stub.document;

  if (tema === 'claro') {
    globalThis.getComputedStyle = () => ({ backgroundColor: 'rgb(255, 255, 255)', color: 'rgb(0, 0, 0)' });
  } else {
    // En tema oscuro Twitch pone la clase en <html> o en <body>.
    stub.document.documentElement.classList.add('tw-root--theme-dark');
  }

  storeSet('respectTwitchTheme', true);
  apply('darkMode');
  apply('oledContrast');

  return {
    stub,
    darkMode: isActive('darkMode'),
    oledContrast: isActive('oledContrast'),
  };
}

beforeEach(() => {
  storeSet('darkMode', true);
  storeSet('oledContrast', true);
});

describe('el contraste OLED no se cuela en el tema claro', () => {
  it('con el tema oscuro de Twitch, contraste y OLED se activan', () => {
    const { darkMode, oledContrast } = montar('oscuro');
    assert.equal(darkMode, true, 'con tema oscuro, OLED debe aplicarse');
    assert.equal(oledContrast, true, 'con tema oscuro, el contraste también');
  });

  it('con el tema claro de Twitch, OLED respeta la elección y el contraste también', () => {
    const { darkMode, oledContrast } = montar('claro');
    assert.equal(darkMode, false, 'OLED no debe imponerse en tema claro');
    assert.equal(oledContrast, false, 'y el contraste tampoco: su CSS pone texto blanco');
  });

  it('si se pide no respetar el tema de Twitch, ambos se activan igual', () => {
    const { darkMode, oledContrast } = montar('claro');
    storeSet('respectTwitchTheme', false);
    apply('darkMode');
    apply('oledContrast');
    assert.equal(isActive('darkMode'), true);
    assert.equal(isActive('oledContrast'), true, 'si el usuario quiere forzar OLED, también quiere el contraste');
  });

  it('las dos features comparten la misma condición', () => {
    assert.equal(
      typeof getFeature('oledContrast').when,
      'function',
      'sin when(), el CSS se aplica en cualquier tema',
    );
  });

  it('el store guarda respectTwitchTheme como booleano', () => {
    assert.equal(typeof storeGet('respectTwitchTheme'), 'boolean');
  });
});
