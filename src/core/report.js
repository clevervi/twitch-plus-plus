/** Informe de una línea por dato, pensado para pegar en un issue. */
import { status as catalogStatus } from './catalog.js';
import { capabilities } from './gm.js';
import { trackedErrors } from './log.js';
import { statuses } from './registry.js';
import { brokenSelectors } from './selectors.js';
import { VERSION } from './version.js';

export function report() {
  const list = statuses();
  const active = list.filter((feature) => feature.active).map((feature) => feature.id);
  const blocked = list.filter((feature) => feature.enabled && !feature.active).map((feature) => feature.id);
  const failing = list.filter((feature) => feature.failures > 0).map((feature) => `${feature.id} (${feature.failures})`);
  const dead = brokenSelectors().map((row) => row.key);
  const catalog = catalogStatus();
  const apis = capabilities();

  const lines = [
    `Twitch++ v${VERSION}`,
    `gestor de scripts: ${apis.gestor}`,
    `navegador: ${globalThis.navigator?.userAgent || 'desconocido'}`,
    `página: ${location.pathname}`,
    `features activas: ${active.join(', ') || '—'}`,
    `features bloqueadas por condición: ${blocked.join(', ') || '—'}`,
    `features con errores: ${failing.join(', ') || '—'}`,
    `selectores sin resolver: ${dead.join(', ') || '—'}`,
    `APIs ausentes: ${apis.ausentes.join(', ') || 'ninguna'}`,
    `catálogo: rev. ${catalog.revision || 'local'}${catalog.remote ? '' : ' (sin remoto)'}${catalog.error ? ` — ${catalog.error}` : ''}`,
  ];
  for (const entry of trackedErrors().slice(-5)) lines.push(`error: ${entry.scope}: ${entry.message}`);
  return lines.join('\n');
}
