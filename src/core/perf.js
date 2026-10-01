/**
 * Contadores de coste, de bajo coste.
 *
 * Un userscript puede parecer ligero y estar recorriendo el DOM cada latido.
 * Aquí se cuentan las cosas que de verdad se pagan: ticks del scheduler,
 * consultas al DOM y ráfagas de mutación.
 *
 * Todos los contadores son incrementos enteros en un objeto plano. Nada de
 * `performance.mark`, nada de listas, nada que limpiar.
 */

/** Ticks recientes, para sacar una media en vez de un pico. */
const VENTANA = 20;

const contadores = {
  /** Ciclos del scheduler que llegaron a `tickAll`. */
  ticks: 0,
  /** Consultas al DOM lanzadas desde `dom.js`. */
  consultas: 0,
  /** Ráfagas de mutación que despertaron al scheduler. */
  mutaciones: 0,
  /** Arranque hasta la primera feature activa, en ms. */
  arranqueMs: null,
};

const ticksRecientes = [];

export function contar(clave, delta = 1) {
  if (contadores[clave] === undefined) return;
  contadores[clave] += delta;
}

export function registrarTick() {
  const ahora = Date.now();
  contadores.ticks += 1;
  ticksRecientes.push(ahora);
  if (ticksRecientes.length > VENTANA) ticksRecientes.shift();
}

export function registrarArranque(ms) {
  if (contadores.arranqueMs === null) contadores.arranqueMs = ms;
}

export function snapshot() {
  const total = ticksRecientes.length;
  let porSegundo = 0;
  if (total > 1) {
    const span = ticksRecientes[total - 1] - ticksRecientes[0];
    if (span > 0) porSegundo = Math.round(((total - 1) / span) * 1000 * 10) / 10;
  }
  return {
    ticks: contadores.ticks,
    ticksPorSegundo: porSegundo,
    consultas: contadores.consultas,
    mutaciones: contadores.mutaciones,
    arranqueMs: contadores.arranqueMs,
  };
}

export function reset() {
  contadores.ticks = 0;
  contadores.consultas = 0;
  contadores.mutaciones = 0;
  contadores.arranqueMs = null;
  ticksRecientes.length = 0;
}
