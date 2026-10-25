import assert from 'node:assert/strict';
import test from 'node:test';

import { isClaimButton } from '../src/features/auto-claim.js';

function makeElement({
  tag = 'BUTTON',
  ariaLabel = '',
  textContent = '',
  className = '',
  hasIcon = false,
  parent = null,
  inContext = false,
} = {}) {
  const el = {
    tagName: tag.toUpperCase(),
    className,
    classList: {
      contains: (c) => className.split(/\s+/).includes(c),
    },
    getAttribute: (attr) => (attr === 'aria-label' ? (ariaLabel || null) : null),
    textContent,
    querySelector: (sel) => (hasIcon ? { selector: sel } : null),
    closest: (selector) => {
      if (inContext && selector.includes('community-points-summary')) return { tagName: 'DIV' };
      if (el.tagName.toLowerCase() === selector.toLowerCase()) return el;
      return parent ? parent.closest(selector) : null;
    },
  };
  return el;
}

test('isClaimButton rechaza botones de saldo, balance o menú de recompensas', () => {
  const balanceButtons = [
    makeElement({ ariaLabel: 'Saldo de puntos de canal: 1.250' }),
    makeElement({ ariaLabel: 'Channel Points Balance: 50,000' }),
    makeElement({ ariaLabel: 'Ver recompensas' }),
    makeElement({ ariaLabel: 'Menú de potenciadores' }),
    makeElement({ textContent: 'Saldo de 500 puntos' }),
    makeElement({ textContent: 'Rewards menu' }),
  ];

  for (const btn of balanceButtons) {
    assert.equal(isClaimButton(btn), false, `Debe rechazar botón con etiqueta: ${btn.getAttribute('aria-label') || btn.textContent}`);
  }
});

test('isClaimButton acepta botones de reclamo en múltiples idiomas', () => {
  const validButtons = [
    makeElement({ ariaLabel: 'Claim Bonus', inContext: true }),
    makeElement({ ariaLabel: 'Reclamar bonificación', inContext: true }),
    makeElement({ ariaLabel: 'Reclamar bonificacion', inContext: true }),
    makeElement({ ariaLabel: 'Resgatar bônus', inContext: true }),
    makeElement({ ariaLabel: 'Bonus abholen', inContext: true }),
    makeElement({ ariaLabel: 'Réclamer un bonus', inContext: true }),
    makeElement({ ariaLabel: 'Забрать бонус', inContext: true }),
    makeElement({ textContent: 'Reclamar bonificación', inContext: true }),
  ];

  for (const btn of validButtons) {
    assert.equal(isClaimButton(btn), true, `Debe aceptar botón de bonificación: ${btn.getAttribute('aria-label') || btn.textContent}`);
  }
});

test('isClaimButton detecta el botón por icono o clase de bonificación', () => {
  const withIcon = makeElement({ ariaLabel: '', hasIcon: true });
  assert.equal(isClaimButton(withIcon), true);

  const withClass = makeElement({ ariaLabel: '', className: 'claimable-bonus__icon' });
  assert.equal(isClaimButton(withClass), true);
});

test('isClaimButton funciona cuando se le pasa un elemento hijo dentro del botón', () => {
  const parentBtn = makeElement({ tag: 'BUTTON', ariaLabel: 'Reclamar bonificación', inContext: true });
  const childSpan = makeElement({ tag: 'SPAN', parent: parentBtn });

  assert.equal(isClaimButton(childSpan), true);
});

test('isClaimButton rechaza un botón "Reclamar" fuera del resumen de puntos', () => {
  // Una recompensa del canal también se reclama con un botón "Reclamar", pero
  // no es el cofre: sin icono y fuera del resumen, no se toca.
  assert.equal(isClaimButton(makeElement({ ariaLabel: 'Reclamar' })), false);
  assert.equal(isClaimButton(makeElement({ textContent: 'Reclamar' })), false);
  assert.equal(isClaimButton(makeElement({ ariaLabel: 'Reclamar', inContext: true })), true);
});

test('isClaimButton rechaza elementos vacíos, nulos o no relacionados', () => {
  assert.equal(isClaimButton(null), false);
  assert.equal(isClaimButton(undefined), false);
  assert.equal(isClaimButton(makeElement({ tag: 'DIV', ariaLabel: 'Chat' })), false);
  assert.equal(isClaimButton(makeElement({ tag: 'BUTTON', ariaLabel: 'Enviar mensaje' })), false);
});
