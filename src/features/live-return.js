/**
 * Volver al canal cuando el streamer vuelve a emitir.
 *
 * Se arma al salir de un canal que se quedo offline: si el salto es una raid,
 * se sabe sin consultar nada; si es una navegacion normal, se pregunta una vez
 * a Twitch. Mientras hay un objetivo se consulta cada minuto, y cuando el canal
 * aparece en directo se vuelve a el.
 *
 * La consulta es el GQL publico de Twitch: no usa la cuenta, no manda tokens y
 * solo pregunta si un login tiene stream. Va por `postJson` (`gm.js`) para
 * respetar el mismo timeout y fallback que el resto de la red del script.
 */
import { postJson } from '../core/gm.js';
import { log } from '../core/log.js';
import { anotarMotivo, defineFeature, limpiarMotivo } from '../core/registry.js';
import { read as leerSesion, remove as borrarSesion, write as guardarSesion } from '../core/session.js';
import { get as storeGet } from '../core/store.js';
import { channelFromHref, isRaidUrl } from '../core/twitch.js';

const ID = 'liveReturn';
const CLAVE_OBJETIVO = 'twpp:liveReturn.target';
const CLAVE_ULTIMO = 'twpp:liveReturn.last';
const CLAVE_RETORNO = 'twpp:liveReturn.retorno';

const GQL = 'https://gql.twitch.tv/gql';
const CONSULTA = 'query($login:String!){user(login:$login){stream{id}}}';
// Cliente web publico de Twitch. Solo se pregunta por un login; no se envia
// ningun dato de la cuenta ni se necesita OAuth.
const CLIENT_ID = 'kimne78kx3ncx6brgo4mv6wki5h1ko';

const INTERVALO = 60_000;
const VENTANA_ULTIMO = 10 * 60_000;
const VENTANA_RETORNO = 30_000;
const MAX_FALLOS = 5;
const TOPE_REINTENTO = 10 * 60_000;

let activo = false;
let objetivo = null;
let ultimo = null;
let proximo = 0;
let fallos = 0;
let comprobando = false;
let volviendo = null;
const comprobandoSalida = new Set();

function canalActual() {
  return channelFromHref(globalThis.location?.pathname || '/') || '';
}

function limiteMs() {
  const horas = Number(storeGet('liveReturnMax'));
  return (Number.isFinite(horas) && horas > 0 ? horas : 6) * 3600_000;
}

/**
 * Pregunta a Twitch si `canal` tiene stream. Devuelve un objeto porque hay tres
 * respuestas distintas: en directo, offline y "no se pudo preguntar".
 */
export async function estaEnDirecto(canal) {
  if (!canal) return { ok: false };
  const respuesta = await postJson(
    GQL,
    { query: CONSULTA, variables: { login: canal } },
    { headers: { 'Client-ID': CLIENT_ID }, timeout: 8000 },
  );

  if (!respuesta || typeof respuesta !== 'object' || !respuesta.data) return { ok: false };
  const user = respuesta.data.user;
  if (user === null) return { ok: true, existe: false, live: false };
  if (!user || typeof user !== 'object') return { ok: false };
  return { ok: true, existe: true, live: Boolean(user.stream?.id) };
}

function guardarObjetivo() {
  guardarSesion(CLAVE_OBJETIVO, objetivo);
}

function armar(canal) {
  if (!canal || canal === canalActual()) return;
  if (objetivo?.canal === canal) {
    limpiarMotivo(ID);
    return;
  }

  const ahora = Date.now();
  objetivo = { canal, desde: ahora, limite: ahora + limiteMs() };
  guardarObjetivo();
  proximo = ahora + INTERVALO;
  fallos = 0;
  limpiarMotivo(ID);
  log('vuelta: se vigila', canal, 'hasta', new Date(objetivo.limite).toISOString());
}

function desarmar(motivo = '') {
  if (objetivo) log('vuelta: se deja de vigilar', objetivo.canal, motivo);
  objetivo = null;
  proximo = 0;
  fallos = 0;
  borrarSesion(CLAVE_OBJETIVO);
  if (motivo) anotarMotivo(ID, motivo);
  else limpiarMotivo(ID);
}

function alSalir() {
  const canal = volviendo || canalActual();
  if (!canal) return;
  guardarSesion(CLAVE_ULTIMO, { canal, at: Date.now() });
  volviendo = null;
}

/**
 * Al salir de A hacia cualquier otro sitio se pregunta una vez por A. Si ya
 * estaba offline, se arma; si seguia en directo, no se toca nada. La raid se
 * salta la consulta porque es la prueba de que A acaba de terminar.
 */
async function comprobarSalida(canal) {
  if (!canal || canal === canalActual() || comprobandoSalida.has(canal)) return;
  comprobandoSalida.add(canal);
  try {
    const estado = await estaEnDirecto(canal);
    if (!activo) return;
    if (estado.ok && estado.existe && !estado.live && canalActual() !== canal) armar(canal);
  } finally {
    comprobandoSalida.delete(canal);
  }
}

function enRuta(route) {
  if (!activo) return;

  const actual = route?.canal || '';
  const previo = ultimo;
  const ahora = Date.now();

  ultimo = { canal: actual, at: ahora, deSesion: false };
  if (actual) guardarSesion(CLAVE_ULTIMO, ultimo);

  if (objetivo && actual === objetivo.canal) desarmar();

  if (!previo?.canal || previo.canal === actual) return;
  if (previo.deSesion && ahora - previo.at > VENTANA_ULTIMO) return;

  if (isRaidUrl(globalThis.location?.search || '')) armar(previo.canal);
  else comprobarSalida(previo.canal);
}

function comprobar(now) {
  if (!activo || !objetivo || comprobando) return;
  if (now >= objetivo.limite) {
    desarmar('se agoto el tiempo de espera');
    return;
  }
  if (now < proximo) return;

  const canal = objetivo.canal;
  comprobando = true;
  estaEnDirecto(canal)
    .then((estado) => {
      comprobando = false;
      if (!activo || !objetivo || objetivo.canal !== canal) return;

      if (!estado.ok) {
        fallos += 1;
        if (fallos >= MAX_FALLOS) {
          desarmar('no se pudo comprobar si el canal volvia');
          return;
        }
        proximo = Date.now() + Math.min(INTERVALO * 2 ** fallos, TOPE_REINTENTO);
        return;
      }

      fallos = 0;
      if (!estado.existe) {
        desarmar('el canal ya no existe');
        return;
      }
      if (!estado.live) {
        proximo = Date.now() + INTERVALO;
        return;
      }
      if (Date.now() >= objetivo.limite) {
        desarmar('se agoto el tiempo de espera');
        return;
      }
      if (canalActual() === canal) {
        desarmar();
        return;
      }

      log('vuelta: el canal vuelve a emitir, se va a', canal);
      volviendo = canal;
      guardarSesion(CLAVE_RETORNO, { canal, at: Date.now() });
      desarmar();
      globalThis.location?.assign?.(`/${canal}`);
    })
    .catch(() => {
      comprobando = false;
      fallos += 1;
      if (fallos >= MAX_FALLOS) desarmar('no se pudo comprobar si el canal volvia');
      else proximo = Date.now() + Math.min(INTERVALO * 2 ** fallos, TOPE_REINTENTO);
    });
}

function arrancar() {
  if (activo) return;
  activo = true;
  comprobando = false;
  fallos = 0;
  volviendo = null;

  const ahora = Date.now();
  const guardado = leerSesion(CLAVE_OBJETIVO);
  if (guardado?.canal && Number.isFinite(guardado.limite) && ahora < guardado.limite) {
    objetivo = guardado;
    proximo = ahora + INTERVALO;
    log('vuelta: se recupera el objetivo de', guardado.canal);
  } else {
    objetivo = null;
    borrarSesion(CLAVE_OBJETIVO);
  }

  const cargando = globalThis.document?.readyState === 'loading';
  const retorno = leerSesion(CLAVE_RETORNO);
  const previo = leerSesion(CLAVE_ULTIMO);
  const actual = canalActual();

  if (retorno?.canal && retorno.canal === actual && ahora - retorno.at < VENTANA_RETORNO) {
    // Venimos de nuestro propio retorno: el canal anterior real es este, no el
    // que quedo guardado al salir. Sin esto se podria armar el canal de origen
    // y entrar en un ping-pong.
    borrarSesion(CLAVE_RETORNO);
    ultimo = { canal: actual, at: ahora, deSesion: false };
    guardarSesion(CLAVE_ULTIMO, ultimo);
  } else if (cargando && previo?.canal && Number.isFinite(previo.at) && ahora - previo.at < VENTANA_ULTIMO) {
    ultimo = { ...previo, deSesion: true };
  } else {
    if (retorno) borrarSesion(CLAVE_RETORNO);
    ultimo = { canal: actual, at: ahora, deSesion: false };
    if (actual) guardarSesion(CLAVE_ULTIMO, ultimo);
  }

  if (objetivo && objetivo.canal === actual) desarmar();

  globalThis.window?.addEventListener?.('pagehide', alSalir);
  limpiarMotivo(ID);
}

function parar() {
  if (!activo) return;
  activo = false;
  objetivo = null;
  ultimo = null;
  proximo = 0;
  fallos = 0;
  comprobando = false;
  volviendo = null;
  comprobandoSalida.clear();
  borrarSesion(CLAVE_OBJETIVO);
  borrarSesion(CLAVE_ULTIMO);
  borrarSesion(CLAVE_RETORNO);
  globalThis.window?.removeEventListener?.('pagehide', alSalir);
  limpiarMotivo(ID);
}

defineFeature({
  id: ID,
  label: 'Volver cuando el canal vuelva a emitir',
  section: 'auto',
  default: false,
  interval: 5000,
  tick: comprobar,
  onEnable: arrancar,
  onDisable: parar,
  onRoute: enRuta,
  settings: [
    {
      key: 'liveReturnMax',
      label: 'Dejar de esperar tras',
      type: 'select',
      options: [['2', '2 h'], ['6', '6 h'], ['24', '24 h']],
      default: '6',
    },
  ],
});
