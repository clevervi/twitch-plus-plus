/** Panel de control en shadow DOM (sin colisiones con el CSS de Twitch). */
import { on as onBus } from '../core/bus.js';
import { setDebug, trackedErrors } from '../core/log.js';
import { all as allFeatures, apply, applyAll, disableAll, SECTIONS, statuses } from '../core/registry.js';
import { report } from '../core/report.js';
import { brokenSelectors, selectorReport } from '../core/selectors.js';
import { declare, exportJSON, get, importJSON, reset as resetStore, set, setMany } from '../core/store.js';
import { list as keybindList, setCombo } from '../core/keybinds.js';
import { setHost as setToastHost, show as toast } from '../core/toast.js';
import { refresh as refreshCatalog, status as catalogStatus } from '../core/catalog.js';
import { check as checkUpdate, install as installUpdate, shouldCheck } from '../core/updater.js';
import { ChatPause } from '../features/chat-pause.js';
import { estaEnDirecto } from '../features/live-return.js';
import { VERSION } from '../core/version.js';
import { currentUsername, isDarkTheme } from '../core/twitch.js';
import { describe } from './descriptions.js';
import { PANEL_CSS } from './panel-css.js';
import { PRESETS, PRESET_LABELS, idsOf } from './presets.js';

const FAB_SIZE = 40;

declare('fabRight', 'number', 14);
declare('fabBottom', 'number', 88);
declare('hasSeenFab', 'bool', false);

let host = null;
let shadow = null;
let panel = null;
let fab = null;
let noteBox = null;
let idleTimer = null;
let prevFocus = null;
let built = false;
let cachedFabX = 0;
let cachedFabY = 0;
let fabState = 'idle';
let refs = null;
let seccionAbierta = 'visual';

const NODE = {
  panel: 'panel',
  fab: 'fab',
  toasts: 'toasts',
  search: 'search',
  preset: 'preset',
  body: 'body',
  note: 'note',
  pause: 'pause',
  close: 'close',
  active: 'active',
};

function node(name) {
  return shadow.getElementById(NODE[name]);
}

function escapeHtml(value) {
  return String(value).replace(
    /[&<>"'`]/g,
    (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;', '`': '&#96;' })[char],
  );
}

function settingHtml(feature) {
  if (!feature.settings?.length) return '';
  const rows = feature.settings
    .map((setting) => {
      const value = get(setting.key);
      if (setting.type === 'bool') {
        return `<label class="row setting" data-setting-row="${setting.key}">
          <span>${escapeHtml(setting.label)}</span>
          <input type="checkbox" class="check" data-setting="${setting.key}"${value ? ' checked' : ''}>
        </label>`;
      }
      if (setting.type === 'select') {
        const options = setting.options
          .map(([id, label]) => `<option value="${escapeHtml(id)}"${String(id) === String(value) ? ' selected' : ''}>${escapeHtml(label)}</option>`)
          .join('');
        return `<label class="setting">
          <span>${escapeHtml(setting.label)}</span>
          <select data-setting="${setting.key}">${options}</select>
        </label>`;
      }
      const attrs = [
        `data-setting="${setting.key}"`,
        `type="${setting.type === 'number' ? 'number' : 'text'}"`,
        setting.placeholder ? `placeholder="${escapeHtml(setting.placeholder)}"` : '',
        Number.isFinite(setting.min) ? `min="${setting.min}"` : '',
        Number.isFinite(setting.max) ? `max="${setting.max}"` : '',
        Number.isFinite(setting.step) ? `step="${setting.step}"` : '',
        `value="${escapeHtml(value ?? '')}"`,
      ]
        .filter(Boolean)
        .join(' ');
      return `<label class="setting">
        <span>${escapeHtml(setting.label)}</span>
        <input ${attrs}>
      </label>`;
    })
    .join('');
  return `<div class="settings" data-settings="${feature.id}"${get(feature.id) ? '' : ' hidden'}>${rows}</div>`;
}

function featureRow(feature) {
  const tag = feature.remote ? '<span class="badge-remote">repo</span>' : '';
  const search = [feature.label, ...(feature.settings || []).map((setting) => setting.label)]
    .join(' ')
    .toLowerCase();
  const desc = describe(feature.id);
  return `<div class="feature" data-feature="${feature.id}" data-search="${escapeHtml(search)}">
    <label class="row label">
      <span class="row-text">
        <span class="row-title">${escapeHtml(feature.label)}${tag}</span>
        ${desc ? `<span class="row-desc">${escapeHtml(desc)}</span>` : ''}
        <span class="row-note" data-status="${feature.id}" hidden></span>
      </span>
      <input type="checkbox" data-key="${feature.id}">
    </label>
    ${settingHtml(feature)}
  </div>`;
}

function keybindRow(entry) {
  return `<label class="row" data-search="${escapeHtml(entry.label.toLowerCase())}">
    <span>${escapeHtml(entry.label)}</span>
    <input type="text" class="kb-input" data-kb="${entry.id}" spellcheck="false">
  </label>`;
}

function sectionsHtml() {
  const keys = keybindList();
  const html = SECTIONS.map((section) => {
    const features = allFeatures().filter((feature) => feature.section === section.id);
    const body =
      section.id === 'advanced'
        ? `
          <label class="row" data-search="catálogo remoto repo">
            <span>Catálogo remoto del repo</span>
            <input type="checkbox" data-key="catalog">
          </label>
          <label class="row" data-search="comprobar actualizaciones">
            <span>Comprobar actualizaciones</span>
            <input type="checkbox" data-key="autoUpdate">
          </label>
          <label class="row" data-search="depurar depuración debug">
            <span>Modo depuración</span>
            <input type="checkbox" data-key="debug">
          </label>
          ${keys.map(keybindRow).join('')}
          <div class="advanced-actions">
            <div class="advanced-title">Mantenimiento</div>
            <button class="action-btn" data-action="update" type="button">Buscar actualización</button>
            <button class="action-btn" data-action="catalog" type="button">Recargar catálogo</button>
            <button class="action-btn" data-action="export" type="button">Exportar</button>
            <button class="action-btn" data-action="import" type="button">Importar</button>
            <button class="action-btn" data-action="connectivity" type="button">Comprobar conexión</button>
            <button class="action-btn" data-action="diagnostics" type="button">Diagnóstico</button>
            <button class="action-btn" data-action="disableAll" type="button">Desactivar todas</button>
            <button class="action-btn danger" data-action="reset" type="button">Reset</button>
          </div>`
        : features.map(featureRow).join('');
    const open = section.id === seccionAbierta;
    return `<div class="section${open ? '' : ' collapsed'}" data-section="${section.id}">
      <button class="section-title" type="button" aria-expanded="${open}">${escapeHtml(section.title)}</button>
      <div class="section-body">${body}</div>
    </div>`;
  }).join('');
  return html;
}

/**
 * Recorta la posicion del FAB al area visible. Sin esto, una posicion guardada
 * en una ventana grande dejaba el boton fuera de pantalla al reducirla, y ya no
 * se podia arrastrar porque no habia donde agarrarlo.
 */
export function clampPlacement(right, bottom, winW = 1200, winH = 800) {
  const ancho = Number.isFinite(winW) && winW > 0 ? winW : 1200;
  const alto = Number.isFinite(winH) && winH > 0 ? winH : 800;
  const maxRight = Math.max(0, ancho - FAB_SIZE);
  const maxBottom = Math.max(0, alto - FAB_SIZE);
  const r = Math.min(maxRight, Math.max(0, Number.isFinite(right) ? right : 14));
  const b = Math.min(maxBottom, Math.max(0, Number.isFinite(bottom) ? bottom : 88));
  return { right: r, bottom: b, x: ancho - r - FAB_SIZE / 2, y: alto - b - FAB_SIZE / 2 };
}

function applyPlacement(right, bottom) {
  if (!host) return;
  const winW = (typeof window !== 'undefined' ? window.innerWidth : 1200) || 1200;
  const winH = (typeof window !== 'undefined' ? window.innerHeight : 800) || 800;
  const pos = clampPlacement(right, bottom, winW, winH);

  const isTop = pos.bottom > winH / 2;
  const isLeft = pos.right > winW / 2;

  // El centro del boton, en coordenadas de ventana. Da igual si se ancla por
  // la izquierda o por la derecha: el host mide 26px y queda a `right` del
  // borde derecho, asi que su centro es siempre `winW - right - 13`. Con la
  // formula anterior (right + 13) el punto de referencia se reflejaba al otro
  // lado, y con el boton en la mitad izquierda o superior el brillo al acercar
  // el raton no se activaba nunca.
  cachedFabX = pos.x;
  cachedFabY = pos.y;

  const wrap = shadow?.querySelector('.wrap');
  if (wrap) {
    wrap.classList.toggle('open-down', isTop);
    wrap.classList.toggle('open-up', !isTop);
    wrap.classList.toggle('align-left', isLeft);
    wrap.classList.toggle('align-right', !isLeft);
  }

  if (isTop) {
    const topPx = Math.max(0, winH - pos.bottom - FAB_SIZE);
    host.style.top = `${topPx}px`;
    host.style.bottom = 'auto';
  } else {
    host.style.bottom = `${pos.bottom}px`;
    host.style.top = 'auto';
  }

  if (isLeft) {
    const leftPx = Math.max(0, winW - pos.right - FAB_SIZE);
    host.style.left = `${leftPx}px`;
    host.style.right = 'auto';
  } else {
    host.style.right = `${pos.right}px`;
    host.style.left = 'auto';
  }

  if (panel) {
    const availH = isTop ? (pos.bottom - FAB_SIZE - 10) : (winH - pos.bottom - FAB_SIZE - 10);
    panel.style.maxHeight = `${Math.max(220, Math.min(650, availH))}px`;
  }
}

function build() {
  if (built) return;
  host = document.createElement('div');
  host.id = 'twpp-host';
  host.style.cssText = 'position:fixed;z-index:2147483000;';
  shadow = host.attachShadow({ mode: 'open' });
  shadow.innerHTML = `<style>${PANEL_CSS}</style>
    <div class="wrap">
      <div class="toasts" id="toasts" aria-live="polite"></div>
      <section class="panel" id="panel" role="dialog" aria-label="Panel de Twitch++" hidden>
        <header class="head">
          <span class="brand">Twitch<span class="plus">++</span></span>
          <span class="head-right">
            <span class="ver">v${VERSION}</span>
            <button class="close" id="close" type="button" aria-label="Cerrar panel" title="Cerrar (Esc)">×</button>
          </span>
        </header>
        <div class="toolbar">
          <input class="search" id="search" type="search" placeholder="Buscar…" spellcheck="false" autocomplete="off" aria-label="Buscar ajustes">
          <select class="preset" id="preset" aria-label="Preset">
            ${Object.entries(PRESET_LABELS)
              .map(([id, label]) => `<option value="${id}">${label}</option>`)
              .join('')}
          </select>
        </div>
        <div class="body" id="body">${sectionsHtml()}</div>
        <div class="note" id="note" role="status" hidden></div>
        <div class="actions">
          <button class="action-btn primary" id="pause" data-action="pause" type="button">Pausar chat</button>
        </div>
        <footer class="foot"><span id="active"></span> · Alt+Shift+T panel · Esc cierra</footer>
      </section>
      <button class="fab" id="fab" type="button" title="Twitch++" aria-label="Abrir panel de Twitch++" aria-expanded="false" aria-controls="panel">++</button>
    </div>`;

  (document.body || document.documentElement).appendChild(host);
  panel = node('panel');
  fab = node('fab');
  noteBox = node('note');
  setToastHost(node('toasts'));

  applyPlacement(get('fabRight'), get('fabBottom'));
  applyTheme();
  cacheRefs();
  bind();
  built = true;
  sync();
  flashFab();
  scheduleIdle();
}

/** Referencias estables para que `sync()` no recorra el shadow DOM en cada ruta. */
function cacheRefs() {
  if (!shadow) return;
  const features = new Map();
  for (const feature of allFeatures()) {
    features.set(feature.id, {
      input: shadow.querySelector(`input[data-key="${feature.id}"]`),
      settings: shadow.querySelector(`[data-settings="${feature.id}"]`),
      status: shadow.querySelector(`[data-status="${feature.id}"]`),
    });
  }
  refs = {
    features,
    extras: ['catalog', 'autoUpdate', 'debug'].map((key) => ({
      key,
      input: shadow.querySelector(`input[data-key="${key}"]`),
    })),
    settings: [...shadow.querySelectorAll('input[data-setting], select[data-setting]')],
    keybinds: [...shadow.querySelectorAll('.kb-input')],
    preset: node('preset'),
    pause: node('pause'),
    active: node('active'),
  };
}

/** El panel sigue el tema de Twitch: no es una isla negra en una página clara. */
function applyTheme() {
  if (panel) panel.dataset.theme = isDarkTheme() ? 'dark' : 'light';
}

/** Filtra por label y por nombres de ajustes; abre la sección si hay match. */
function applySearch() {
  if (!shadow) return;
  const query = (node('search')?.value || '').toLowerCase().trim();
  for (const section of shadow.querySelectorAll('.section')) {
    let visible = 0;
    for (const row of section.querySelectorAll('[data-search]')) {
      const match = !query || (row.dataset.search || '').includes(query);
      row.style.display = match ? '' : 'none';
      if (match) visible += 1;
    }
    const mostrar = !query || visible > 0;
    section.style.display = mostrar ? '' : 'none';
    const title = section.querySelector('.section-title');
    if (query) {
      const abrir = mostrar && visible > 0;
      section.classList.toggle('collapsed', !abrir);
      title?.setAttribute('aria-expanded', String(abrir));
    } else {
      const abrir = section.dataset.section === seccionAbierta;
      section.classList.toggle('collapsed', !abrir);
      title?.setAttribute('aria-expanded', String(abrir));
    }
  }
}

function setNote(html) {
  if (!noteBox) return;
  noteBox.innerHTML = html || '';
  noteBox.hidden = !html;
}

function readSetting(input) {
  const feature = allFeatures().find((f) => (f.settings || []).some((s) => s.key === input.dataset.setting));
  const setting = feature?.settings.find((s) => s.key === input.dataset.setting);
  if (!setting) return;

  let value;
  if (setting.type === 'bool') value = input.checked;
  else if (setting.type === 'number') {
    value = Number(input.value);
    if (!Number.isFinite(value)) return;
    if (Number.isFinite(setting.min)) value = Math.max(setting.min, value);
    if (Number.isFinite(setting.max)) value = Math.min(setting.max, value);
    input.value = String(value);
  } else value = input.value;

  set(setting.key, value);
}

function bind() {
  // --- FAB draggable: distingue click (toggle panel) de drag (mover) ---
  let dragFlag = false;

  fab.addEventListener('mousedown', (ev) => {
    if (ev.button !== 0) return;
    dragFlag = false;
    const startX = ev.clientX;
    const startY = ev.clientY;
    const origRight = get('fabRight');
    const origBottom = get('fabBottom');

    const onMove = (e) => {
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      if (!dragFlag && Math.abs(dx) < 4 && Math.abs(dy) < 4) return;
      dragFlag = true;
      fab.classList.add('dragging');
      const winW = (typeof window !== 'undefined' ? window.innerWidth : 1200) || 1200;
      const winH = (typeof window !== 'undefined' ? window.innerHeight : 800) || 800;
      const maxR = winW - 32;
      const maxB = winH - 32;
      const newRight = Math.max(0, Math.min(maxR, origRight - dx));
      const newBottom = Math.max(0, Math.min(maxB, origBottom - dy));
      applyPlacement(newRight, newBottom);
    };

    const onUp = (e) => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      fab.classList.remove('dragging');
      if (dragFlag) {
        const dx = e.clientX - startX;
        const dy = e.clientY - startY;
        const winW = (typeof window !== 'undefined' ? window.innerWidth : 1200) || 1200;
        const winH = (typeof window !== 'undefined' ? window.innerHeight : 800) || 800;
        const maxR = winW - 32;
        const maxB = winH - 32;
        const finalRight = Math.round(Math.max(0, Math.min(maxR, origRight - dx)));
        const finalBottom = Math.round(Math.max(0, Math.min(maxB, origBottom - dy)));
        set('fabRight', finalRight);
        set('fabBottom', finalBottom);
        applyPlacement(finalRight, finalBottom);
      }
    };

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  });

  if (typeof window !== 'undefined' && window.addEventListener) {
    window.addEventListener(
      'resize',
      () => {
        applyPlacement(get('fabRight'), get('fabBottom'));
      },
      { passive: true },
    );
  }

  let lastMoveTime = 0;
  let pendingMove = null;
  let pendingTimer = null;

  /** El cálculo en sí, sin ninguna limitación de frecuencia. */
  const evaluarWake = (event) => {
    if (!fab) return;

    const dx = Math.abs(event.clientX - cachedFabX);
    const dy = Math.abs(event.clientY - cachedFabY);

    // Salida rápida: si el ratón está lejos (> 140px en cualquier eje),
    // no se calculan raíces cuadradas ni se tocan clases ni timers.
    if (dx > 140 || dy > 140) {
      if (fabState !== 'idle') {
        fabState = 'idle';
        fab.classList.remove('awake', 'near');
      }
      return;
    }

    const dist = Math.hypot(dx, dy);

    if (dist < 30) {
      if (fabState !== 'near') {
        fabState = 'near';
        fab.classList.add('awake', 'near');
      }
      scheduleIdle();
    } else if (dist < 140) {
      if (fabState !== 'awake') {
        fabState = 'awake';
        fab.classList.add('awake');
        fab.classList.remove('near');
      }
      scheduleIdle();
    } else if (fabState !== 'idle') {
      fabState = 'idle';
      fab.classList.remove('awake', 'near');
    }
  };

  const wakeFab = (event) => {
    if (!fab) return;
    const now = Date.now();
    const espera = 50 - (now - lastMoveTime);

    if (espera > 0) {
      // NO se descarta el evento. Se guarda el último y se evalúa al abrirse
      // la ventana, porque la posición que importa es donde se para el ratón:
      // descartarla era justo lo que dejaba el botón apagado para siempre tras
      // el primer ciclo de entrar y salir.
      pendingMove = event;
      if (!pendingTimer) {
        pendingTimer = setTimeout(() => {
          pendingTimer = null;
          const ultimo = pendingMove;
          pendingMove = null;
          if (!ultimo) return;
          lastMoveTime = Date.now();
          evaluarWake(ultimo);
        }, espera);
      }
      return;
    }

    lastMoveTime = now;
    evaluarWake(event);
  };
  document.addEventListener('mousemove', wakeFab, { passive: true });

  const onEscape = (event) => {
    if (event.key === 'Escape' && panel && !panel.hidden) {
      togglePanel(false);
    }
  };
  shadow.addEventListener('keydown', onEscape);
  document.addEventListener('keydown', onEscape);

  fab.addEventListener('click', () => {
    if (dragFlag) { dragFlag = false; return; }
    togglePanel();
  });

  node('close').addEventListener('click', () => togglePanel(false));

  shadow.addEventListener('change', (event) => {
    const toggle = event.target.closest('input[type="checkbox"][data-key]');
    if (toggle) {
      const { key } = toggle.dataset;
      set(key, toggle.checked);
      if (!PRESETS[key]) set('preset', 'custom');
      if (key === 'debug') setDebug(toggle.checked);
      apply(key);
      sync();
      return;
    }
    const setting = event.target.closest('[data-setting]');
    if (setting) {
      readSetting(setting);
      sync();
    }
  });

  shadow.addEventListener(
    'blur',
    (event) => {
      const input = event.target.closest('.kb-input');
      if (!input) return;
      if (setCombo(input.dataset.kb, input.value.trim())) {
        sync();
        toast('Atajo guardado');
      } else {
        sync();
      }
    },
    true,
  );

  shadow.addEventListener('click', (event) => {
    const title = event.target.closest('.section-title');
    if (title) {
      const section = title.closest('.section');
      const abrir = section?.classList.contains('collapsed');
      for (const otra of shadow.querySelectorAll('.section')) {
        const open = abrir && otra === section;
        otra.classList.toggle('collapsed', !open);
        otra.querySelector('.section-title')?.setAttribute('aria-expanded', String(open));
      }
      seccionAbierta = abrir ? section.dataset.section : null;
      return;
    }
    const action = event.target.closest('[data-action]');
    if (!action) return;
    const handlers = {
      pause: () => {
        ChatPause.toggle();
        sync();
      },
      update: () => runUpdateCheck(),
      install: () => installUpdate(),
      catalog: () => runCatalogRefresh(),
      export: () => runExport(),
      import: () => runImport(),
      diagnostics: () => runDiagnostics(),
      connectivity: () => runConnectivityCheck(),
      disableAll: () => runDisableAll(),
      reset: () => runReset(),
    };
    handlers[action.dataset.action]?.();
  });

  node('search').addEventListener('input', applySearch);

  node('preset').addEventListener('change', (event) => applyPreset(event.target.value));

  onBus('route', () => sync());
  onBus('chatPause:change', () => sync());
  onBus('catalog:updated', () => {
    // El catálogo pudo añadir features: se redibuja sin perder scroll ni filtro.
    const body = node('body');
    const scroll = body.scrollTop;
    body.innerHTML = sectionsHtml();
    body.scrollTop = scroll;
    cacheRefs();
    applySearch();
    sync();
  });
  onBus('feature:disabled', ({ id }) => {
    toast(`"${id}" se desactivó por errores`);
    sync();
  });
}

function applyPreset(name) {
  if (name === 'custom') return;
  const active = idsOf(name);
  const updates = {};
  for (const feature of allFeatures()) updates[feature.id] = active.includes(feature.id);
  updates.preset = name;
  setMany(updates);
  applyAll();
  sync();
  toast(`Preset: ${PRESET_LABELS[name]}`);
}

function scheduleIdle() {
  clearTimeout(idleTimer);
  idleTimer = setTimeout(() => {
    if (panel && !panel.hidden) return;
    fabState = 'idle';
    fab?.classList.remove('awake', 'near');
  }, 4000);
}

function flashFab() {
  if (!fab) return;
  if (get('hasSeenFab')) return;
  set('hasSeenFab', true);
  fab.classList.add('flash');
  setTimeout(() => {
    if (panel && !panel.hidden) return;
    fab.classList.remove('flash');
  }, 2500);
}

export function isOpen() {
  return !!panel && !panel.hidden;
}

export function togglePanel(force) {
  if (!panel) build();
  const open = typeof force === 'boolean' ? force : panel.hidden;
  panel.hidden = !open;
  fab.setAttribute('aria-expanded', String(open));
  fab.setAttribute('aria-label', open ? 'Cerrar panel de Twitch++' : 'Abrir panel de Twitch++');
  if (open) {
    prevFocus = document.activeElement;
    applyTheme();
    applyPlacement(get('fabRight'), get('fabBottom'));
    fab.classList.add('awake');
    clearTimeout(idleTimer);
    sync();
    setTimeout(() => {
      const search = node('search');
      if (search && typeof search.focus === 'function') search.focus();
    }, 0);
  } else {
    scheduleIdle();
    if (prevFocus && prevFocus.isConnected && typeof prevFocus.focus === 'function') {
      try {
        prevFocus.focus();
      } catch {
        /* ignore */
      }
    }
    prevFocus = null;
  }
  return open;
}

export function sync() {
  if (!shadow) return;
  if (!refs) cacheRefs();

  const list = statuses();
  const byId = new Map(list.map((item) => [item.id, item]));

  for (const feature of allFeatures()) {
    const cached = refs?.features.get(feature.id);
    if (!cached) continue;
    const enabled = !!get(feature.id);
    if (cached.input) cached.input.checked = enabled;
    if (cached.settings) cached.settings.hidden = !enabled;
    if (cached.status) {
      const info = byId.get(feature.id);
      const note = enabled && info ? info.motivo || (info.blocked ? 'inactiva ahora' : '') : '';
      cached.status.textContent = note;
      cached.status.hidden = !note;
    }
  }

  for (const { key, input } of refs?.extras || []) {
    if (input) input.checked = !!get(key);
  }

  for (const input of refs?.settings || []) {
    const key = input.dataset.setting;
    if (input.type === 'checkbox') input.checked = !!get(key);
    else input.value = String(get(key) ?? '');
  }

  const keybinds = get('keybinds') || {};
  for (const input of refs?.keybinds || []) {
    input.value = keybinds[input.dataset.kb] || '';
  }

  const preset = get('preset');
  if (refs?.preset) refs.preset.value = PRESETS[preset] ? preset : 'custom';

  if (refs?.pause) {
    refs.pause.textContent = ChatPause.isActive() ? 'Reanudar chat' : 'Pausar chat';
    refs.pause.classList.toggle('on', ChatPause.isActive());
  }
  fab.classList.toggle('active', ChatPause.isActive());
  fab.title = ChatPause.isActive() ? 'Twitch++ — chat pausado' : 'Twitch++ (Alt+Shift+T)';
  if (refs?.active) {
    const active = list.filter((feature) => feature.active).length;
    refs.active.textContent = `${active}/${list.length} activas`;
  }
  if (panel && !panel.hidden) applyTheme();
}

async function runUpdateCheck() {
  const button = shadow.querySelector('[data-action="update"]');
  button.disabled = true;
  const result = await checkUpdate({ force: true });
  button.disabled = false;

  if (result.error) return setNote(`No se pudo comprobar: ${escapeHtml(result.error)}`);
  if (!result.update) return setNote(`Estás en la última versión (${VERSION}).`);

  setNote(
    `Hay versión <b>${escapeHtml(result.latest)}</b>.${
      result.notes ? `<br><span>${escapeHtml(result.notes).replace(/\n/g, '<br>')}</span>` : ''
    }<br><button class="action-btn" data-action="install" style="margin-top:6px">Instalar ${escapeHtml(result.latest)}</button>`,
  );
  toast(`Actualización disponible: ${result.latest}`);
}

async function runCatalogRefresh() {
  const button = shadow.querySelector('[data-action="catalog"]');
  button.disabled = true;
  const result = await refreshCatalog({ force: true });
  button.disabled = false;
  renderCatalogNote();
  sync();
  toast(result?.error ? 'Catálogo no disponible' : 'Catálogo actualizado');
}

function renderCatalogNote() {
  const info = catalogStatus();
  if (!get('catalog')) return setNote('');
  if (info.error) {
    return setNote('No se pudo leer el catálogo remoto; se usan los selectores locales. El detalle está en Diagnóstico.');
  }
  setNote('');
}

function runExport() {
  const json = exportJSON();
  if (navigator.clipboard?.writeText) {
    navigator.clipboard
      .writeText(json)
      .then(() => toast('Configuración copiada'))
      .catch(() => window.prompt('Copia tu configuración:', json));
    return;
  }
  window.prompt('Copia tu configuración:', json);
}

function runImport() {
  const raw = window.prompt('Pega tu configuración JSON:');
  if (!raw) return;
  try {
    importJSON(raw);
    setDebug(!!get('debug'));
    applyAll();
    sync();
    toast('Configuración importada');
  } catch {
    toast('JSON inválido');
  }
}

async function runConnectivityCheck() {
  const button = shadow.querySelector('[data-action="connectivity"]');
  if (button) button.disabled = true;

  let twitch = false;
  try {
    await fetch('/favicon.ico', { cache: 'no-store' });
    twitch = true;
  } catch {
    twitch = false;
  }

  const gql = (await estaEnDirecto('twitch')).ok;
  const online = navigator.onLine !== false;
  const brave = Boolean(navigator.brave);
  const login = currentUsername() || '';
  const resumen = `Conexión: ${online ? 'online' : 'offline'} · Twitch: ${twitch ? 'ok' : 'falla'} · GQL: ${gql ? 'ok' : 'falla'} · Brave: ${brave ? 'sí' : 'no'} · sesión: ${login || 'no detectada'}`;
  setNote(resumen);
  if (navigator.clipboard?.writeText) {
    navigator.clipboard.writeText(`${resumen}\n\n${report()}`).catch(() => {});
  }
  toast(gql && twitch ? 'Conexión correcta' : 'Hay fallos de conexión');
  if (button) button.disabled = false;
}

function runDiagnostics() {
  const errors = trackedErrors();
  const dead = brokenSelectors();
  const texto = report();
  console.table(statuses());
  console.table(selectorReport());
  if (errors.length) console.table(errors);
  console.log('[Twitch++] informe:\n' + texto);
  if (navigator.clipboard?.writeText) {
    navigator.clipboard.writeText(texto).then(() => toast('Informe copiado')).catch(() => {});
  }

  const parts = [`${statuses().length} features`, `${errors.length} errores`];
  if (dead.length) parts.push(`${dead.length} selectores rotos`);
  toast(`Diagnóstico: ${parts.join(' · ')}`);
  if (dead.length) setNote(`Selectores sin resolver: <b>${dead.map((row) => row.key).join(', ')}</b><br>Copia el informe de la consola y abre una issue.`);
}

function runDisableAll() {
  disableAll();
  sync();
  toast('Todas las features desactivadas');
}

function runReset() {
  if (!window.confirm('¿Resetear toda la configuración de Twitch++?')) return;
  resetStore();
  setDebug(!!get('debug'));
  applyAll();
  sync();
  toast('Configuración reseteada');
}

export const UI = {
  build,
  sync,
  togglePanel,
  isOpen,
  renderCatalogNote,
  checkOnStartup: shouldCheck,
};
