/** Miniaturas de canal al pasar el ratón por una card de la sidebar. */
import { log } from '../core/log.js';
import { defineFeature } from '../core/registry.js';
import { get as storeGet } from '../core/store.js';
import { channelFromCard, thumbnailUrl, visibleChannels, waitForHoverDialog } from '../core/twitch.js';

const cache = new Map();
let generation = 0;
let leaveTimer = null;
let preloadTimer = null;
let activeTarget = null;
let currentCard = null;

function ttl() {
  const seconds = Number(storeGet('thumbCacheTtl'));
  return (Number.isFinite(seconds) ? seconds : 60) * 1000;
}

function width() {
  const value = Number(storeGet('thumbWidth'));
  return Number.isFinite(value) && value >= 160 ? value : 320;
}

function preload(channel) {
  if (!channel) return;
  const now = Date.now();
  const stamp = cache.get(channel);
  if (stamp && now - stamp < ttl()) return;
  cache.set(channel, now);
  const image = new Image();
  image.decoding = 'async';
  image.src = thumbnailUrl(channel, width());
}

function preloadVisible(limit = 8) {
  for (const channel of visibleChannels(limit)) preload(channel);
}

/* ------------------------------------------------------------------ *
 * Localización estricta del tooltip de la sidebar.
 *
 * Regla: SOLO aceptamos tooltips que:
 *   a) tengan la clase moderna de Twitch para sidebar, o
 *   b) estén posicionados a menos de 100px verticales Y a la derecha
 *      (o izquierda) de la card con un gap < 60px.
 * En cualquier otro caso, devolvemos null (no inyectamos nada).
 * ------------------------------------------------------------------ */

function findSidebarTooltip(card, dialog) {
  if (!card || !dialog) return null;

  const cardRect = card.getBoundingClientRect();
  const cardCY = cardRect.top + cardRect.height / 2;

  // a) Clase moderna de Twitch (fuente de verdad)
  const body = dialog.matches?.('.online-side-nav-channel-tooltip__body, [class*="online-side-nav-channel-tooltip"]')
    ? dialog
    : dialog.querySelector?.('.online-side-nav-channel-tooltip__body, [class*="online-side-nav-channel-tooltip"]');

  if (body) {
    // El "container" debe ser el wrapper inmediato del body, NO un ancestro grande.
    // Caminamos hacia arriba mientras el ancestro tenga un tamaño razonable
    // (tooltips de sidebar miden ~250-400px de ancho).
    let container = body.parentElement;
    let hops = 0;
    while (container && container !== dialog && hops < 4) {
      const r = container.getBoundingClientRect();
      if (r.width > 0 && r.width < 500 && r.height > 0 && r.height < 600) break;
      container = container.parentElement;
      hops += 1;
    }
    if (!container || container === document.body) container = body;
    return { container, insertionPoint: body };
  }

  // b) Fallback geométrico: tooltip anclado a la card
  const containers = document.querySelectorAll(
    '.tw-dialog-layer, [role="tooltip"], [data-popper-placement]'
  );
  for (const el of containers) {
    const p = el.querySelector('p');
    if (!p) continue;
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) continue;
    if (r.width > 500 || r.height > 600) continue;   // descartar capas grandes
    const cy = r.top + r.height / 2;
    const verticalDist = Math.abs(cy - cardCY);
    const horizontalDist = Math.min(
      Math.abs(r.left - cardRect.right),
      Math.abs(cardRect.left - r.right)
    );
    if (verticalDist <= 100 && horizontalDist <= 60) {
      return { container: el, insertionPoint: p };
    }
  }

  return null;
}

function restoreTarget(target) {
  if (!target) return;
  const { container, insertionPoint } = target;
  if (container) {
    container.style.removeProperty('width');
    container.style.removeProperty('max-width');
    container.style.removeProperty('min-width');
  }
  if (insertionPoint && insertionPoint !== container) {
    insertionPoint.style.removeProperty('width');
    insertionPoint.style.removeProperty('max-width');
    insertionPoint.style.removeProperty('box-sizing');
  }
}

function cleanup() {
  if (activeTarget) {
    restoreTarget(activeTarget);
    activeTarget = null;
  }
  // Barrido global defensivo: cualquier miniatura huérfana también se elimina
  for (const node of document.querySelectorAll('img.twpp-sidebar-thumb')) {
    const parent = node.closest('.online-side-nav-channel-tooltip__body, [class*="online-side-nav-channel-tooltip"], .tw-balloon') || node.parentElement;
    node.remove();
    if (parent) {
      const container = parent.closest('[data-a-target="side-nav-bar"]') ? parent : parent;
      restoreTarget({ container, insertionPoint: parent });
    }
  }
}

/* -------------------------------------------------------------- *
 * Comprobación de identidad del tooltip.
 * Requerimos DOS condiciones: el texto menciona el canal Y la
 * geometría es coherente. Si solo una se cumple, no inyectamos.
 * -------------------------------------------------------------- */

function tooltipMatchesChannel(card, target, channel) {
  if (!target || !target.insertionPoint) return false;

  const text = (target.insertionPoint.textContent || '').toLowerCase();
  const normChannel = channel.toLowerCase();

  // Match textual robusto: canal de 4+ letras → contains simple.
  // Canal corto → exigimos límite de palabra.
  let textMatch = false;
  if (normChannel.length >= 4) {
    textMatch = text.includes(normChannel);
  } else {
    const re = new RegExp(`(^|[^a-z0-9_])${normChannel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}([^a-z0-9_]|$)`, 'i');
    textMatch = re.test(text);
  }

  const titleMatch = Boolean(
    target.insertionPoint.querySelector(
      `[title*="${normChannel}" i], [title*="${channel}" i]`
    )
  );

  // Comprobación geométrica estricta
  const cardRect = card.getBoundingClientRect();
  const contRect = target.container.getBoundingClientRect();
  const cardCY = cardRect.top + cardRect.height / 2;
  const contCY = contRect.top + contRect.height / 2;
  const verticalOK = Math.abs(cardCY - contCY) <= 100;
  const horizontalOK = Math.min(
    Math.abs(contRect.left - cardRect.right),
    Math.abs(cardRect.left - contRect.right)
  ) <= 60;

  // Ambas deben cumplirse. Excepción: si hay match textual, relajamos
  // la geometría a solo vertical (pero seguimos exigiendo <= 100px).
  if (textMatch || titleMatch) return verticalOK;
  return verticalOK && horizontalOK;
}

function inject(card, channel) {
  const local = generation;
  waitForHoverDialog().then((dialog) => {
    if (!dialog || !dialog.isConnected || local !== generation) return;

    const target = findSidebarTooltip(card, dialog);
    if (!target || !target.insertionPoint) return;

    if (!tooltipMatchesChannel(card, target, channel)) return;

    // Limpieza global antes de inyectar
    cleanup();

    const targetWidth = width();

    if (target.container) {
      target.container.style.width = `${targetWidth}px`;
      target.container.style.maxWidth = `${targetWidth}px`;
      target.container.style.minWidth = `${targetWidth}px`;
    }
    if (target.insertionPoint && target.insertionPoint !== target.container) {
      target.insertionPoint.style.width = '100%';
      target.insertionPoint.style.maxWidth = '100%';
      target.insertionPoint.style.boxSizing = 'border-box';
    }
    activeTarget = target;

    const image = document.createElement('img');
    image.className = 'twpp-sidebar-thumb';
    image.decoding = 'async';
    image.alt = `Vista previa de ${channel}`;
    image.src = thumbnailUrl(channel, targetWidth);
    image.style.cssText = [
      'width:100%',
      'height:auto',
      'aspect-ratio:16/9',
      'object-fit:cover',
      'display:block',
      'border-radius:6px',
      'margin-top:8px',
      'background:#0e0e10',
      'box-shadow:0 2px 8px rgba(0,0,0,0.35)',
    ].join(';');

    image.addEventListener('error', () => {
      image.remove();
      restoreTarget(target);
      if (activeTarget === target) activeTarget = null;
    }, { once: true });

    target.insertionPoint.append(image);
  });
}

function onPointerOver(e) {
  const card = e.target.closest('[data-a-target="side-nav-card"], .side-nav-card, a[data-test-selector="followed-channel"]');
  if (!card) return;
  // Scoping adicional: la card DEBE estar dentro de la sidebar real
  if (!card.closest('[data-a-target="side-nav-bar"], nav[aria-label="Primary navigation"], [data-test-selector="side-nav"], .side-nav')) return;
  if (card === currentCard) return;

  currentCard = card;
  clearTimeout(leaveTimer);
  generation += 1;

  const channel = channelFromCard(card);
  if (!channel) return;

  preload(channel);
  inject(card, channel);
}

function onPointerOut(e) {
  if (!currentCard) return;
  const related = e.relatedTarget;
  if (related && currentCard.contains(related)) return;

  currentCard = null;
  generation += 1;
  clearTimeout(leaveTimer);
  const leaveGen = generation;
  leaveTimer = setTimeout(() => {
    if (leaveGen === generation) cleanup();
  }, 100);
}

function onWindowBlur() {
  currentCard = null;
  generation += 1;
  cleanup();
}

function teardown() {
  currentCard = null;
  clearTimeout(leaveTimer);
  // El precargado diferido se cancela aquí: sin esto, apagar la feature antes
  // de los 2 s deja el temporador vivo y pide miniaturas al CDN con la feature
  // apagada. Los listeners ya se quitan en onDisable; esto es lo que faltaba.
  clearTimeout(preloadTimer);
  preloadTimer = null;
  cleanup();
  cache.clear();
}

defineFeature({
  id: 'sidebarThumbnailPreview',
  label: 'Miniatura en sidebar',
  section: 'sidebar',
  default: false,
  settings: [
    {
      key: 'thumbWidth',
      label: 'Tamaño de miniatura',
      type: 'select',
      options: [
        ['220', '220px (Compacta)'],
        ['260', '260px (Mediana)'],
        ['320', '320px (Estándar 16:9)'],
        ['380', '380px (Grande)'],
        ['440', '440px (Extra grande)'],
        ['720', '720px (Máxima)'],
      ],
      default: '320',
    },
    { key: 'thumbCacheTtl', label: 'Caché (segundos)', type: 'number', default: 60, min: 0, max: 3600 },
  ],
  onEnable() {
    document.addEventListener('mouseover', onPointerOver, { passive: true });
    document.addEventListener('mouseout', onPointerOut, { passive: true });
    window.addEventListener('blur', onWindowBlur);
    clearTimeout(preloadTimer);
    preloadTimer = setTimeout(() => {
      preloadTimer = null;
      preloadVisible(8);
    }, 2000);
    log('miniaturas de sidebar activas');
  },
  onDisable() {
    document.removeEventListener('mouseover', onPointerOver);
    document.removeEventListener('mouseout', onPointerOut);
    window.removeEventListener('blur', onWindowBlur);
    teardown();
  },
  onRoute() {
    generation += 1;
    teardown();
  },
});
