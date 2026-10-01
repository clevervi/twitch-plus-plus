/**
 * Sonda de diagnóstico: fuerza todas las features contra el DOM que hay ahora
 * mismo y devuelve qué funcionó y qué se rompió. Se usa desde probe.html (con un
 * volcado del HTML de Twitch) y desde `TwitchPP.diagnostics.probe()`.
 * Restaura la configuración del usuario al terminar.
 */
import { trackedErrors } from './log.js';
import { all, applyAll, failureCount, isActive, tickAll } from './registry.js';
import { selectorReport } from './selectors.js';
import { get as storeGet, set as storeSet } from './store.js';

export function probe({ ticks = 2, root = document } = {}) {
  const before = trackedErrors().length;
  const snapshot = all().map((feature) => [feature.id, !!storeGet(feature.id)]);

  // La restauración va en un finally: si algo lanza a mitad, el panel se
  // queda con todas las features encendidas y la config del usuario persistida.
  try {
    for (const [id] of snapshot) storeSet(id, true);
    applyAll(); // reactivar limpia los contadores de fallos
    for (let i = 0; i < ticks; i += 1) tickAll(Date.now() + i * 60_000, { force: true });

    const features = all().map((feature) => ({
      id: feature.id,
      section: feature.section,
      hasTick: !!feature.tick,
      active: isActive(feature.id),
      blocked: typeof feature.when === 'function' && !isActive(feature.id),
      errors: failureCount(feature.id),
    }));

    const selectors = selectorReport(root);
    const errors = trackedErrors().slice(before);

    return {
      at: new Date().toISOString(),
      url: root.location?.href ?? '',
      features,
      selectors,
      errors,
      summary: {
        featuresOk: features.filter((feature) => feature.errors === 0).length,
        featuresTotal: features.length,
        selectorsOk: selectors.filter((row) => row.ok).length,
        selectorsTotal: selectors.length,
      },
    };
  } finally {
    for (const [id, enabled] of snapshot) storeSet(id, enabled);
    applyAll();
  }
}
