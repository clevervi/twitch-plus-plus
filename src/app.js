/**
 * Arranque y API de diagnóstico.
 *
 * Orden: catálogo cacheado (sin red) → estilos → features → atajos → router →
 * scheduler → UI → tareas de red (catálogo + comprobación de actualización).
 */
import { on as onBus } from './core/bus.js';
import { refresh as refreshCatalog, status as catalogStatus, warm as warmCatalog } from './core/catalog.js';
import { onIdle, ready } from './core/dom.js';
import { capabilities } from './core/gm.js';
import { bindGlobal, register as registerKeybind } from './core/keybinds.js';
import { setDebug, track, trackedErrors, warn } from './core/log.js';
import { probe } from './core/probe.js';
import { report } from './core/report.js';
import { applyAll, disableAll, onRouteAll, statuses } from './core/registry.js';
import { start as startRouter } from './core/router.js';
import { brokenSelectors, selectorReport } from './core/selectors.js';
import { kick as kickScheduler, scheduleRoute, start as startScheduler } from './core/scheduler.js';
import { declare, get as storeGet, set as storeSet } from './core/store.js';
import { rebuild as rebuildStyles } from './core/styles.js';
import { show as toast } from './core/toast.js';
import { check as checkUpdate, shouldCheck } from './core/updater.js';
import { VERSION } from './core/version.js';
import { ChatPause } from './features/chat-pause.js';
import './features/index.js';
import { UI } from './ui/panel.js';

declare('keybinds', 'object', {}, (v) =>
  v && typeof v === 'object' && !Array.isArray(v) && Object.values(v).every((x) => typeof x === 'string'),
);
declare('preset', 'string', 'balanced');
declare('catalog', 'bool', true);
declare('autoUpdate', 'bool', true);
declare('debug', 'bool', false);

function registerKeybinds() {
  registerKeybind('panel', 'Abrir panel', 'Alt+Shift+T', { allowWhileTyping: true });
  registerKeybind('chatPause', 'Pausar chat', 'Alt+Shift+P');
  registerKeybind('pauseAll', 'Desactivar todo', 'Alt+Shift+X');
}

function runAction(id) {
  if (id === 'panel') {
    UI.togglePanel();
    return;
  }
  if (id === 'chatPause') {
    ChatPause.toggle();
    UI.sync();
    return;
  }
  if (id === 'pauseAll') {
    disableAll();
    UI.sync();
  }
}

async function networkTasks() {
  // Fuera de twitch.tv (p.ej. la sonda de probe.html) no hay nada que buscar y
  // un catálogo remoto contaminaría la medición.
  if (!/(^|\.)twitch\.tv$/i.test(location.hostname)) return;
  try {
    await refreshCatalog();
  } catch {
    /* el catálogo es opcional: nunca debe romper el arranque */
  }
  UI.renderCatalogNote();
  if (!shouldCheck()) return;
  try {
    const result = await checkUpdate();
    if (result?.update) UI.renderCatalogNote();
  } catch {
    /* sin red: se ignora */
  }
}

const BOOT_BUDGET_MS = 150;

export const bootReport = {
  startedAt: 0,
  completedAt: 0,
  durationMs: 0,
  budgetMs: BOOT_BUDGET_MS,
  slow: false,
  stages: {
    styles: { ok: false, error: null },
    ui: { ok: false, error: null },
  },
};

export function start() {
  bootReport.startedAt = Date.now();
  if (typeof performance !== 'undefined' && performance.mark) {
    try {
      performance.mark('twpp-boot-start');
    } catch {
      /* ignore */
    }
  }

  // Capa 1: todo lo que no necesita <body>. Se ejecuta en document-start para
  // que el CSS esté en la página antes de que Twitch pinte el tema claro.
  try {
    bootStyles();
    bootReport.stages.styles.ok = true;
  } catch (error) {
    bootReport.stages.styles.error = String(error?.message || error);
    reportBootFailure('estilos', error);
    return;
  }

  // Capa 2: UI y scheduler, cuando ya existe el DOM.
  ready(() => {
    try {
      startScheduler();
      UI.build();
      UI.renderCatalogNote();
      bootReport.stages.ui.ok = true;
      bootReport.completedAt = Date.now();
      bootReport.durationMs = bootReport.completedAt - bootReport.startedAt;
      bootReport.slow = bootReport.durationMs > bootReport.budgetMs;

      if (typeof performance !== 'undefined' && performance.mark) {
        try {
          performance.mark('twpp-boot-end');
          performance.measure?.('twpp-boot', 'twpp-boot-start', 'twpp-boot-end');
        } catch {
          /* ignore */
        }
      }

      if (bootReport.slow) {
        warn(`arranque lento: ${bootReport.durationMs}ms (presupuesto: ${bootReport.budgetMs}ms)`);
      }

      onIdle(networkTasks);
    } catch (error) {
      bootReport.stages.ui.error = String(error?.message || error);
      reportBootFailure('interfaz', error);
    }
  });
}

function bootStyles() {
  setDebug(!!storeGet('debug'));
  warmCatalog();
  rebuildStyles();
  applyAll();
  registerKeybinds();
  bindGlobal(runAction);
  startRouter();

  onBus('route', (route) => {
    onRouteAll(route);
    ChatPause.ensure();
    scheduleRoute();
    kickScheduler();
  });

  announce();
}

function announce() {
  const list = statuses();
  const active = list.filter((feature) => feature.active).length;
  console.info(
    `%c[Twitch++]%c v${VERSION} · ${active}/${list.length} features activas · catálogo rev. ${catalogStatus().revision || 'local'}`,
    'color:#9147ff;font-weight:bold',
    'color:inherit',
  );
}

/** Un fallo al arrancar no puede dejar al usuario sin panel ni explicación. */
function reportBootFailure(stage, error) {
  track(`boot:${stage}`, error);
  const message = `Twitch++ no pudo arrancar (${stage})`;
  window.dispatchEvent(new CustomEvent('twpp:boot-error', { detail: { stage, error: String(error?.message || error) } }));
  // Toast.show encola si el panel todavía no existe: se verá en cuanto se monte.
  toast(message);
  console.error(`%c[Twitch++]%c ${message}:`, 'color:#ff5c5c;font-weight:bold', 'color:inherit', error);
}

export function setFeature(id, value) {
  storeSet(id, !!value);
  applyAll();
}

export const diagnostics = {
  version: VERSION,
  features: statuses,
  errors: trackedErrors,
  catalog: catalogStatus,
  selectors: selectorReport,
  broken: brokenSelectors,
  probe,
  report,
  apis: capabilities,
  boot: () => ({ ...bootReport, stages: { ...bootReport.stages } }),
};
