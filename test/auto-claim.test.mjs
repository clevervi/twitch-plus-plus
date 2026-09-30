import assert from 'node:assert/strict';
import test from 'node:test';

import { isClaimButton } from '../src/features/auto-claim.js';

function makeElement({ tag = 'BUTTON', ariaLabel = '', textContent = '', className = '', hasIcon = false, parent = null } = {}) {
  const el = {
    tagName: tag.toUpperCase(),
    className,
    classList: {
      contains: (c) => className.split(/\s+/).includes(c),
    },
    getAttribute: (attr) => (attr === 'aria-label' ? (ariaLabel || null) : null),
    textContent,
    querySelector: (sel) => (hasIcon ? { selector: sel } : null),
    closest: (targetTag) => {
      if (el.tagName.toLowerCase() === targetTag.toLowerCase()) return el;
      return parent ? parent.closest(targetTag) : null;
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
    makeElement({ ariaLabel: 'Claim Bonus' }),
    makeElement({ ariaLabel: 'Reclamar bonificación' }),
    makeElement({ ariaLabel: 'Reclamar bonificacion' }),
    makeElement({ ariaLabel: 'Resgatar bônus' }),
    makeElement({ ariaLabel: 'Bonus abholen' }),
    makeElement({ ariaLabel: 'Réclamer un bonus' }),
    makeElement({ ariaLabel: 'Забрать бонус' }),
    makeElement({ textContent: 'Reclamar bonificación' }),
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
  const parentBtn = makeElement({ tag: 'BUTTON', ariaLabel: 'Reclamar bonificación' });
  const childSpan = makeElement({ tag: 'SPAN', parent: parentBtn });

  assert.equal(isClaimButton(childSpan), true);
});

test('isClaimButton rechaza elementos vacíos, nulos o no relacionados', () => {
  assert.equal(isClaimButton(null), false);
  assert.equal(isClaimButton(undefined), false);
  assert.equal(isClaimButton(makeElement({ tag: 'DIV', ariaLabel: 'Chat' })), false);
  assert.equal(isClaimButton(makeElement({ tag: 'BUTTON', ariaLabel: 'Enviar mensaje' })), false);
});
