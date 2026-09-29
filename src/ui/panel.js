/** Panel de control en shadow DOM (sin colisiones con el CSS de Twitch). */
import { on as onBus } from '../core/bus.js';
import { setDebug, trackedErrors } from '../core/log.js';
import { all as allFeatures, apply, applyAll, SECTIONS, statuses } from '../core/registry.js';
import { exportJSON, get, importJSON, reset as resetStore, set, setMany } from '../core/store.js';
import { list as keybindList, setCombo } from '../core/keybinds.js';
import { setHost as setToastHost, show as toast } from '../core/toast.js';
import { clearCache, refresh as refreshCatalog, status as catalogStatus } from '../core/catalog.js';
import { check as checkUpdate, install as installUpdate, shouldCheck } from '../core/updater.js';
import { ChatPause } from '../features/chat-pause.js';
import { VERSION } from '../core/version.js';
import { PANEL_CSS } from './panel-css.js';
import { PRESETS, PRESET_LABELS, idsOf } from './presets.js';

let host = null;
let shadow = null;
let panel = null;
let fab = null;
let noteBox = null;
let idleTimer = null;
let built = false;

const NODE = {
  panel: 'panel',
  fab: 'fab',
  toasts: 'toasts',
  search: 'search',
  preset: 'preset',
  body: 'body',
  note: 'note',
  pause: 'pause',
};

function node(name) {
  return shadow.getElementById(NODE[name]);
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
}

function settingHtml(feature) {
  if (!feature.settings?.length) return '';
  const rows = feature.settings
    .map((setting) => {
      const value = get(setting.key);
      if (setting.type === 'bool') {
        return `<label class="row setting" data-setting-row="${setting.key}">
          <span>${escapeHtml(setting.label)}</span>
          <input type="checkbox" class="check" data-setting="${setting.key}">
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
  return `<div class="feature" data-feature="${feature.id}">
    <label class="row label" data-search="${escapeHtml(feature.label.toLowerCase())}">
      <span>${escapeHtml(feature.label)}${tag}</span>
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
          ${keys.map(keybindRow).join('')}`
        : features.map(featureRow).join('');
    return `<div class="section" data-section="${section.id}">
      <div class="section-title">${escapeHtml(section.title)}</div>
      <div class="section-body">${body}</div>
    </div>`;
  }).join('');
  return html;
}

function build() {
  if (built) return;
  host = document.createElement('div');
  host.id = 'twpp-host';
  host.style.cssText = 'position:fixed;right:14px;bottom:14px;z-index:2147483000;';
  shadow = host.attachShadow({ mode: 'open' });
  shadow.innerHTML = `<style>${PANEL_CSS}</style>
    <div class="wrap">
      <div class="toasts" id="toasts"></div>
      <section class="panel" id="panel" hidden>
        <header class="head">
          <span>Twitch<span class="plus">++</span></span>
          <span class="ver">v${VERSION}</span>
        </header>
        <div class="toolbar">
          <input class="search" id="search" type="text" placeholder="Buscar…" spellcheck="false">
          <select class="preset" id="preset">
            ${Object.entries(PRESET_LABELS)
              .map(([id, label]) => `<option value="${id}">${label}</option>`)
              .join('')}
          </select>
        </div>
        <div class="body" id="body">${sectionsHtml()}</div>
        <div class="note" id="note" hidden></div>
        <div class="actions">
          <button class="action-btn" id="pause">Pausar chat</button>
          <div class="action-row">
            <button class="action-btn" data-action="update">Buscar actualización</button>
            <button class="action-btn" data-action="catalog">Recargar catálogo</button>
          </div>
          <div class="action-row">
            <button class="action-btn" data-action="export">Exportar</button>
            <button class="action-btn" data-action="import">Importar</button>
            <button class="action-btn" data-action="diagnostics">Diagnóstico</button>
            <button class="action-btn" data-action="reset">Reset</button>
          </div>
        </div>
        <footer class="foot">Alt+O panel · Alt+P pausa de chat</footer>
      </section>
      <button class="fab" id="fab" title="Twitch++">++</button>
    </div>`;

  (document.body || document.documentElement).appendChild(host);
  panel = node('panel');
  fab = node('fab');
  noteBox = node('note');
  setToastHost(node('toasts'));

  bind();
  built = true;
  sync();
  scheduleIdle();
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
  fab.addEventListener('click', () => togglePanel());

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
      title.closest('.section')?.classList.toggle('collapsed');
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
      reset: () => runReset(),
    };
    handlers[action.dataset.action]?.();
  });

  node('search').addEventListener('input', (event) => {
    const query = event.target.value.toLowerCase().trim();
    for (const section of shadow.querySelectorAll('.section')) {
      let visible = 0;
      for (const row of section.querySelectorAll('[data-search]')) {
        const match = !query || (row.dataset.search || '').includes(query);
        row.style.display = match ? '' : 'none';
        if (match) visible += 1;
      }
      section.style.display = visible > 0 || !query ? '' : 'none';
    }
  });

  node('preset').addEventListener('change', (event) => applyPreset(event.target.value));

  onBus('route', () => sync());
  onBus('catalog:updated', () => {
    // el catálogo pudo añadir features: hay que redibujar las filas
    node('body').innerHTML = sectionsHtml();
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
    fab?.classList.remove('awake');
  }, 4000);
}

export function isOpen() {
  return !!panel && !panel.hidden;
}

export function togglePanel(force) {
  if (!panel) build();
  const open = typeof force === 'boolean' ? force : panel.hidden;
  panel.hidden = !open;
  if (open) {
    fab.classList.add('awake');
    clearTimeout(idleTimer);
  } else {
    scheduleIdle();
  }
  return open;
}

export function sync() {
  if (!shadow) return;
  for (const feature of allFeatures()) {
    const input = shadow.querySelector(`input[data-key="${feature.id}"]`);
    if (input) input.checked = !!get(feature.id);
    const box = shadow.querySelector(`[data-settings="${feature.id}"]`);
    if (box) box.hidden = !get(feature.id);
  }
  for (const key of ['catalog', 'autoUpdate', 'debug']) {
    const input = shadow.querySelector(`input[data-key="${key}"]`);
    if (input) input.checked = !!get(key);
  }

  const keybinds = get('keybinds') || {};
  for (const input of shadow.querySelectorAll('.kb-input')) {
    input.value = keybinds[input.dataset.kb] || '';
  }

  const preset = get('preset');
  node('preset').value = PRESETS[preset] ? preset : 'custom';

  const pause = node('pause');
  pause.textContent = ChatPause.isActive() ? 'Reanudar chat' : 'Pausar chat';
  pause.classList.toggle('on', ChatPause.isActive());
  fab.classList.toggle('active', ChatPause.isActive());
  fab.title = ChatPause.isActive() ? 'Twitch++ — chat pausado' : 'Twitch++ (Alt+O)';
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
  clearCache();
  const result = await refreshCatalog({ force: true });
  button.disabled = false;
  renderCatalogNote(result);
  sync();
  toast(result?.error ? 'Catálogo no disponible' : 'Catálogo actualizado');
}

function renderCatalogNote(result) {
  const info = catalogStatus();
  if (!get('catalog')) return setNote('Catálogo remoto desactivado.');
  if (info.error) return setNote(`Catálogo: ${escapeHtml(info.error)}`);
  const parts = [`Catálogo rev. ${info.revision}`];
  if (info.selectors) parts.push(`${info.selectors} selectores remotos`);
  if (info.features) parts.push(`${info.features} features del repo`);
  if (info.note) parts.push(escapeHtml(info.note));
  setNote(parts.join(' · '));
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

function runDiagnostics() {
  const errors = trackedErrors();
  console.table(statuses());
  if (errors.length) console.table(errors);
  toast(`Diagnóstico: ${statuses().length} features, ${errors.length} errores`);
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
