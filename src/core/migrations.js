/** Migraciones de configuración. Añadir una entrada nueva es lo único que hay que tocar al tocar el formato. */

export const CONFIG_VERSION = 5;

export const MIGRATIONS = [
  {
    to: 1,
    run(cfg) {
      if (cfg.hideExt !== undefined && cfg.hideExtensions === undefined) {
        cfg.hideExtensions = cfg.hideExt;
        delete cfg.hideExt;
      }
      if (cfg.cleanMode === undefined) cfg.cleanMode = true;
    },
  },
  { to: 2, run: (cfg) => void (cfg.viewerAnalytics ??= false) },
  { to: 3, run: (cfg) => void (cfg.sidebarThumbnailPreview ??= false) },
  {
    to: 4,
    run: (cfg) => {
      cfg.sidebarCompact ??= false;
      cfg.hideOfflineChannels ??= false;
      cfg.chatSearch ??= false;
    },
  },
  {
    to: 5,
    run: (cfg) => {
      cfg.chatKeywordHighlight ??= false;
      cfg.mentionHighlight ??= false;
      cfg.catalog ??= true;
      cfg.autoUpdate ??= true;
      cfg.debug ??= false;
      if (!cfg.keybinds || typeof cfg.keybinds !== 'object') cfg.keybinds = {};
    },
  },
];

export function migrate(input) {
  const cfg = { ...(input || {}) };
  let from = Number.isFinite(cfg._v) ? cfg._v : 0;
  if (from > CONFIG_VERSION) from = 0; // config de una versión futura: se normaliza a los defaults

  for (const step of MIGRATIONS) {
    if (step.to <= from) continue;
    try {
      step.run(cfg);
    } catch {
      /* una migración rota no debe tumbar el arranque */
    }
    from = step.to;
  }

  cfg._v = CONFIG_VERSION;
  return cfg;
}
