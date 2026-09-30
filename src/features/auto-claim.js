/** Reclamo automático de Channel Points. */
import { isVisible, qs } from '../core/dom.js';
import { log } from '../core/log.js';
import { defineFeature } from '../core/registry.js';
import { select, selectAll } from '../core/selectors.js';
import { show as toast } from '../core/toast.js';
import { get as storeGet } from '../core/store.js';

const CLAIM_HINT = /bonificaci[oó]n|b[oóô]nus|bonus|бонус|claim|reclamar|resgatar|abholen|réclamer/i;
const FORBIDDEN_HINT = /saldo|balance|potenciador|reward|recompensa/i;

let lastClick = 0;

function cooldown() {
  const seconds = Number(storeGet('claimCooldown'));
  return (Number.isFinite(seconds) ? seconds : 2.5) * 1000;
}

export function isClaimButton(btn) {
  if (!btn) return false;
  const target = btn.tagName === 'BUTTON' ? btn : btn.closest('button');
  if (!target) return false;

  const label = (target.getAttribute('aria-label') || target.textContent || '').trim();
  // Nunca pulsar el botón del menú de saldo / potenciadores de Twitch
  if (FORBIDDEN_HINT.test(label)) return false;

  // Es el cofre si tiene el icono o el texto específico de bonificación
  if (target.querySelector('.claimable-bonus__icon, [data-test-selector="claimable-bonus-icon"]')) return true;
  if (target.classList.contains('claimable-bonus__icon')) return true;
  if (CLAIM_HINT.test(label)) return true;

  return false;
}

function findButton() {
  const direct = select('claimBonus');
  if (direct) {
    const btn = direct.tagName === 'BUTTON' ? direct : direct.closest('button') || qs('button', direct);
    if (btn && isClaimButton(btn)) return btn;
  }

  for (const summary of selectAll('channelPoints')) {
    for (const button of summary.querySelectorAll('button')) {
      if (isClaimButton(button)) return button;
    }
  }
  return null;
}

defineFeature({
  id: 'autoClaim',
  label: 'Auto Channel Points',
  section: 'auto',
  default: true,
  interval: 1200,
  settings: [
    { key: 'claimDryRun', label: 'Solo detectar (no pulsar)', type: 'bool', default: false },
    { key: 'claimCooldown', label: 'Espera mínima (s)', type: 'number', default: 2.5, min: 0.5, max: 60, step: 0.5 },
  ],
  tick(now) {
    if (storeGet('claimDryRun')) return;
    const button = findButton();
    if (!button || !isVisible(button)) return;
    if (now - lastClick < cooldown()) return;
    lastClick = now;
    button.click();
    log('channel points reclamados');
    toast('Channel Points reclamados');
  },
  onDisable() {
    lastClick = 0;
  },
});
