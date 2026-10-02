/** Oculta cards de la sidebar cuyo canal está offline. */
import { qs } from '../core/dom.js';
import { defineFeature } from '../core/registry.js';
import { selectAll } from '../core/selectors.js';

const ATTR = 'data-twpp-offline';

function isOffline(card) {
  // Si tiene indicador de directo activo o contador de viewers, es ONLINE
  if (card.querySelector('.tw-channel-status-indicator, [class*="tw-channel-status-indicator"], [data-a-target="side-nav-live-status"]')) {
    return false;
  }
  if (card.querySelector('[data-a-target="side-nav-card-viewer-count"], [class*="viewer-count"]')) {
    return false;
  }

  // Comprobar indicadores explícitos de offline
  if (qs('[class*="offline"], [class*="Offline"], [data-test-selector*="offline"]', card)) return true;
  const text = card.textContent || '';
  if (/desconectado|offline/i.test(text)) return true;
  const label = card.getAttribute?.('aria-label') || card.querySelector('a')?.getAttribute?.('aria-label') || '';
  if (/desconectado|offline/i.test(label)) return true;
  return false;
}

// El atributo ES el estado: nada de WeakSet, así volver a habilitar, cambiar de
// canal o reconectar el canal se refleja sin recargar.
function sweep() {
  for (const card of selectAll('sideNav.card')) {
    const val = isOffline(card) ? '1' : '0';
    if (card.getAttribute(ATTR) !== val) {
      card.setAttribute(ATTR, val);
    }
  }
}

function clear() {
  for (const card of selectAll('sideNav.card')) card.removeAttribute(ATTR);
}

defineFeature({
  id: 'hideOfflineChannels',
  label: 'Ocultar offline en sidebar',
  section: 'sidebar',
  default: false,
  interval: 2000,
  css: `
    %SCOPE% [data-a-target="side-nav-card"][data-twpp-offline="1"],
    %SCOPE% .side-nav-card[data-twpp-offline="1"] { display: none !important; }
  `,
  tick: sweep,
  onEnable: sweep,
  onDisable: clear,
  onRoute: clear,
});
