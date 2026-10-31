/**
 * No dejarse llevar a la raid cuando el directo termina.
 *
 * Twitch puede saltar al canal de la raid de dos maneras: cambiando la ruta sin
 * recargar o recargando la pagina. La primera se deshace con `history.back()`
 * (o con `location.replace()` si la entrada anterior ya no existe) y la segunda
 * se reconoce al arrancar por el `referrer=raid` de la URL.
 *
 * Un clic o un Enter sobre un enlace de raid cuenta como intencion del usuario:
 * en ese caso el guardia no toca nada.
 */
import { log } from '../core/log.js';
import { anotarMotivo, defineFeature, limpiarMotivo } from '../core/registry.js';
import { read as leerSesion, remove as borrarSesion, write as guardarSesion } from '../core/session.js';
import { channelFromHref, isRaidUrl } from '../core/twitch.js';

const ID = 'raidGuard';
const CLAVE = 'twpp:raidGuard';
const CLAVE_MANUAL = `${CLAVE}.manual`;
const CLAVE_REBOTE = `${CLAVE}.rebote`;
const VENTANA_MANUAL = 3000;
const VENTANA_MANUAL_RECARGA = 30_000;
const VENTANA_SALIDA = 60_000;
const VENTANA_REBOTE = 10_000;
const VENTANA_ANTI_BUCLE = 5000;
const MAX_BLOQUEOS = 3;
const SELECTOR_RAID = '[data-a-target*="raid" i], [data-test-selector*="raid" i]';

let activo = false;
let anterior = null;
let manual = { at: 0, destino: '' };
let bloqueos = 0;
let ultimoDestino = '';
let ultimoBloqueo = 0;
let pendiente = null;

function urlActual() {
  const { pathname = '/', search = '', hash = '' } = globalThis.location || {};
  return `${pathname}${search}${hash}`;
}

function canalDe(url) {
  try {
    return channelFromHref(new URL(url, 'https://www.twitch.tv').pathname) || '';
  } catch {
    return '';
  }
}

function esManual(destino) {
  if (!manual.at || Date.now() - manual.at >= VENTANA_MANUAL) return false;
  return !manual.destino || manual.destino === destino;
}

function recordarManual(evento) {
  const target = evento?.target;
  if (!target || typeof target.closest !== 'function') return;

  const enRaid = target.closest(SELECTOR_RAID);
  const enlace = target.closest('a[href]');
  const href = enlace?.getAttribute?.('href') || '';
  const destino = canalDe(href);

  if (!destino && !enRaid) return;
  manual = { at: Date.now(), destino: destino || '' };
  guardarSesion(CLAVE_MANUAL, manual);
}

function alTeclear(evento) {
  if (evento?.key !== 'Enter') return;
  recordarManual(evento);
}

/**
 * Al irse la pagina se recuerda de donde salimos. No se guarda una URL con
 * `referrer=raid`: si la raid vuelve a recargar, no queremos rebotar en circulo.
 */
function alSalir() {
  if (isRaidUrl(urlActual())) return;
  guardarSesion(CLAVE, { url: urlActual(), at: Date.now() });
}

function reiniciarContador() {
  bloqueos = 0;
  ultimoDestino = '';
  ultimoBloqueo = 0;
}

function bloquear(previo, route, actual) {
  const ahora = Date.now();
  const destino = route.path || actual;
  if (destino === ultimoDestino && ahora - ultimoBloqueo < VENTANA_ANTI_BUCLE) {
    bloqueos += 1;
  } else {
    bloqueos = 1;
    ultimoDestino = destino;
  }
  ultimoBloqueo = ahora;

  if (bloqueos > MAX_BLOQUEOS) {
    anotarMotivo(ID, 'Twitch insiste en la raid; se deja pasar');
    log('raid: se deja pasar tras', MAX_BLOQUEOS, 'intentos');
    return;
  }

  limpiarMotivo(ID);
  log('raid: se evita el salto a', route.path, 'y se vuelve a', previo);

  // El primer salto con pushState se deshace sin recargar. Si Twitch vuelve a
  // empujar la misma raid, una recarga rompe el bucle de su router.
  const metodo = route.razon === 'pushState' && bloqueos === 1 ? 'atras' : 'recarga';
  if (pendiente !== null) clearTimeout(pendiente);
  pendiente = setTimeout(() => {
    pendiente = null;
    if (metodo === 'atras') globalThis.history?.back?.();
    else globalThis.location?.replace?.(previo);
  }, 0);
}

function enRuta(route) {
  if (!activo) return;

  const actual = urlActual();
  const previo = anterior;
  const esRaid = isRaidUrl(actual);

  if (!esRaid) {
    anterior = { url: actual, canal: route?.canal || '' };
    // El contador solo se reinicia cuando la racha de raids ya paso: si se
    // reiniciara en cada vuelta al canal, el anti-bucle no serviria de nada.
    if (ultimoBloqueo && Date.now() - ultimoBloqueo > VENTANA_ANTI_BUCLE * 2) reiniciarContador();
    limpiarMotivo(ID);
    return;
  }

  // Volver atras a mano o cargar la pagina no son saltos que haya que deshacer.
  if (route.razon !== 'pushState' && route.razon !== 'replaceState') {
    anterior = { url: actual, canal: route?.canal || '' };
    return;
  }

  // Sin un canal anterior del que fiarse no hay a donde volver.
  if (!previo || isRaidUrl(previo.url)) {
    anterior = { url: actual, canal: route?.canal || '' };
    return;
  }

  const destino = route.canal || canalDe(actual);
  if (!destino || destino === previo.canal) {
    anterior = { url: actual, canal: route?.canal || '' };
    return;
  }

  if (esManual(destino)) {
    anterior = { url: actual, canal: route?.canal || '' };
    limpiarMotivo(ID);
    log('raid: el usuario ha pedido el salto');
    return;
  }

  // No se actualiza `anterior`: si `history.back()` se retrasa, el siguiente
  // empujon de Twitch debe seguir viendo el canal del que venimos.
  bloquear(previo.url, route, actual);
}

/**
 * Si la pagina acaba de cargar en una raid, la salida anterior esta en
 * `sessionStorage` (por pestaña, no en la config global). Se vuelve una sola vez
 * para no entrar en un bucle si Twitch insiste.
 */
function comprobarRecarga() {
  if (!isRaidUrl(urlActual())) return;

  const guardado = leerSesion(CLAVE);
  const manualGuardado = leerSesion(CLAVE_MANUAL);
  const rebote = leerSesion(CLAVE_REBOTE);
  const ahora = Date.now();

  if (manualGuardado && ahora - manualGuardado.at < VENTANA_MANUAL_RECARGA) {
    if (!manualGuardado.destino || manualGuardado.destino === canalDe(urlActual())) {
      borrarSesion(CLAVE);
      borrarSesion(CLAVE_MANUAL);
      return;
    }
  }

  if (!guardado?.url || !Number.isFinite(guardado.at)) return;
  if (ahora - guardado.at > VENTANA_SALIDA) {
    borrarSesion(CLAVE);
    return;
  }
  if (rebote && ahora - rebote < VENTANA_REBOTE) return;
  if (canalDe(guardado.url) === canalDe(urlActual())) return;

  guardarSesion(CLAVE_REBOTE, { at: ahora, url: urlActual() });
  log('raid: recarga detectada, se vuelve a', guardado.url);
  globalThis.location?.replace?.(guardado.url);
}

function arrancar() {
  if (activo) return;
  activo = true;

  anterior = isRaidUrl(urlActual()) ? null : { url: urlActual(), canal: canalDe(urlActual()) };

  globalThis.document?.addEventListener?.('click', recordarManual, true);
  globalThis.document?.addEventListener?.('keydown', alTeclear, true);
  globalThis.window?.addEventListener?.('pagehide', alSalir);

  // Solo al cargar la pagina. Encenderla desde el panel no debe rebotar a una
  // salida vieja que no tiene nada que ver con lo que se esta viendo ahora.
  if (globalThis.document?.readyState === 'loading') comprobarRecarga();
}

function parar() {
  if (!activo) return;
  activo = false;

  globalThis.document?.removeEventListener?.('click', recordarManual, true);
  globalThis.document?.removeEventListener?.('keydown', alTeclear, true);
  globalThis.window?.removeEventListener?.('pagehide', alSalir);

  if (pendiente !== null) clearTimeout(pendiente);
  pendiente = null;
  anterior = null;
  manual = { at: 0, destino: '' };
  reiniciarContador();
  limpiarMotivo(ID);
  borrarSesion(CLAVE_MANUAL);
  borrarSesion(CLAVE_REBOTE);
}

defineFeature({
  id: ID,
  label: 'No saltar automáticamente a la raid',
  section: 'auto',
  default: false,
  onEnable: arrancar,
  onDisable: parar,
  onRoute: enRuta,
});
