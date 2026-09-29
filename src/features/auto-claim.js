/** Reclamo automático de Channel Points. */
import { isVisible, qs } from '../core/dom.js';
import { log } from '../core/log.js';
import { defineFeature } from '../core/registry.js';
import { select, selectAll } from '../core/selectors.js';
import { show as toast } from '../core/toast.js';
import { get as storeGet } from '../core/store.js';

const CLAIM_HINT = /claim|reclamar|reclama|abholen|réclamer/i;

let lastClick = 0;

function cooldown() {
  const seconds = Number(storeGet('claimCooldown'));
  return (Number.isFinite(seconds) ? seconds : 2.5) * 1000;
}

function findButton() {
  const direct = select('claimBonus');
  if (direct) return direct.tagName === 'BUTTON' ? direct : qs('button', direct) || direct;

  for (const summary of selectAll('channelPoints')) {
    for (const button of summary.querySelectorAll('button')) {
      if (CLAIM_HINT.test(button.getAttribute('aria-label') || button.textContent || '')) return button;
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
