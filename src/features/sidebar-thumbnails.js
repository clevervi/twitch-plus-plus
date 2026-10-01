/** Miniaturas de canal al pasar el ratón por una card de la sidebar. */
import { log } from '../core/log.js';
import { defineFeature } from '../core/registry.js';
import { get as storeGet } from '../core/store.js';
import { channelFromCard, thumbnailUrl, visibleChannels, waitForHoverDialog } from '../core/twitch.js';

const cache = new Map();
let generation = 0;
let leaveTimer = null;
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

function getTooltipTarget(dialog) {
  if (!dialog) return null;

  // 1. Tooltip moderno de Twitch (.online-side-nav-channel-tooltip__body)
  const body = dialog.matches?.('.online-side-nav-channel-tooltip__body, [class*="online-side-nav-channel-tooltip"]')
    ? dialog
    : dialog.querySelector?.('.online-side-nav-channel-tooltip__body, [class*="online-side-nav-channel-tooltip"]');

  if (body) {
    const card = body.closest('[tabindex="0"]') || body.parentElement || body;
    return { container: card, insertionPoint: body };
  }

  // 2. Fallback a .tw-balloon clásico
  const balloon = dialog.matches?.('.tw-balloon')
    ? dialog
    : dialog.querySelector?.('.tw-balloon, [data-a-target="tw-balloon"]') || dialog;

  return { container: balloon, insertionPoint: balloon };
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
  for (const node of document.querySelectorAll('img.twpp-sidebar-thumb')) {
    const parent = node.closest('.online-side-nav-channel-tooltip__body, [class*="online-side-nav-channel-tooltip"], .tw-balloon') || node.parentElement;
    node.remove();
    if (parent) {
      const container = parent.closest('[tabindex="0"]') || parent;
      restoreTarget({ container, insertionPoint: parent });
    }
  }
}

function inject(card, channel) {
  const local = generation;
  waitForHoverDialog().then((dialog) => {
    if (!dialog || !dialog.isConnected || local !== generation) return;

    const target = getTooltipTarget(dialog);
    if (!target || !target.insertionPoint) return;

    // Verificar que el tooltip corresponde a este canal:
    // a) Por coincidencia de texto (en el título o contenido)
    // b) O por proximidad vertical con la card
    const text = (target.insertionPoint.textContent || '').toLowerCase();
    const normChannel = channel.toLowerCase();
    const matchesChannel = text.includes(normChannel) ||
      Boolean(target.insertionPoint.querySelector(`[title*="${normChannel}" i], [title*="${channel}" i]`));

    if (!matchesChannel) {
      const cardRect = card.getBoundingClientRect();
      const dialogRect = target.container.getBoundingClientRect();
      if (cardRect.height > 0 && dialogRect.height > 0) {
        const cardCenterY = cardRect.top + cardRect.height / 2;
        const dialogCenterY = dialogRect.top + dialogRect.height / 2;
        if (Math.abs(cardCenterY - dialogCenterY) > 220) return;
      }
    }

    // Limpieza global de cualquier miniatura previa
    cleanup();

    const targetWidth = width();

    // Adaptar el contenedor y el cuerpo del tooltip
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

function teardown() {
  currentCard = null;
  clearTimeout(leaveTimer);
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
    setTimeout(() => preloadVisible(8), 2000);
    log('miniaturas de sidebar activas');
  },
  onDisable() {
    document.removeEventListener('mouseover', onPointerOver);
    document.removeEventListener('mouseout', onPointerOut);
    teardown();
  },
  onRoute() {
    generation += 1;
    teardown();
  },
});
