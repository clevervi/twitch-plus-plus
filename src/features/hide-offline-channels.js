/** Oculta cards de la sidebar cuyo canal está offline. */
import { qs } from '../core/dom.js';
import { defineFeature } from '../core/registry.js';
import { selectAll } from '../core/selectors.js';

const ATTR = 'data-twpp-offline';

function isOffline(card) {
  if (qs('[class*="offline"], [class*="Offline"]', card)) return true;
  if (qs('[data-test-selector*="offline"]', card)) return true;
  if (/offline|desconectado/i.test(card.getAttribute?.('aria-label') || '')) return true;
  return false;
}

// El atributo ES el estado: nada de WeakSet, así volver a habilitar, cambiar de
// canal o reconectar el canal se refleja sin recargar.
function sweep() {
  for (const card of selectAll('sideNav.card')) {
    const offline = isOffline(card);
    if (offline) {
      card.setAttribute(ATTR, '1');
    } else {
      card.setAttribute(ATTR, '0');
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
