/**
 * Reconexion cuando el directo se corta a mitad.
 *
 * Detecta que el player se ha congelado y lo despierta. NO evita que un directo
 * termine: eso no puede hacerse desde un navegador, porque el video viene del
 * servidor del streamer y cuando deja de emitir no hay datos que reproducir.
 * Aqui solo se recupera de un corte mientras el canal sigue emitiendo.
 */
import { log } from '../core/log.js';
import { defineFeature, anotarMotivo, limpiarMotivo } from '../core/registry.js';
import { selectAll } from '../core/selectors.js';
import { get as storeGet } from '../core/store.js';

const ID = 'autoReconnect';

const SONDEO = 1000;
const GRACIA = 8000;
const MAX_INTENTOS = 4;

/**
 * `document.hidden` para el heartbeat del scheduler (`scheduler.js`), asi que un
 * tick no serviria de nada justo cuando mas hace falta: el directo se corta
 * mientras se esta haciendo otra cosa. Por eso esta feature lleva su propio
 * temporizador en vez de usar `tick`.
 */
let temporizador = null;
let ultimoVideo = null;
let ultimoTiempo = -1;
let ultimoAvance = 0;
let reintentando = false;
let proximoIntento = 0;
let intentos = 0;
let agotado = false;

function opcion(clave, defecto) {
  const valor = Number(storeGet(clave));
  return Number.isFinite(valor) && valor > 0 ? valor : defecto;
}

function esperaBase() {
  return opcion('reconnectBase', 5) * 1000;
}

function esperaTope() {
  return opcion('reconnectMax', 60) * 1000;
}

/** Espera del siguiente intento: 5s, 10s, 20s, 40s... hasta el tope. */
function espera(intento) {
  return Math.min(esperaBase() * 2 ** (intento - 1), esperaTope());
}

function sinIntento() {
  reintentando = false;
  proximoIntento = 0;
  intentos = 0;
  agotado = false;
}

/** El player esta bien: se olvida cualquier intento en curso. */
function funcionando() {
  sinIntento();
  limpiarMotivo(ID);
}

function recargarPagina() {
  log('reconexion: se recarga la pagina como ultimo recurso');
  location.reload();
  return true;
}

/**
 * Intenta despertar el player. Primero `play()`, que resuelve casi todos los
 * cortes. La recarga es el ultimo recurso y va apagada por defecto: recargar en
 * bucle puede provocar que Twitch bloquee la IP, y eso no debe pasar sin que
 * quien lo usa lo haya pedido.
 */
function intentar(video, ahora) {
  // Sin esto, al agotar los intentos se reiniciaba el contador y vuelta a
  // empezar: un bucle infinito con pausas entre lotes.
  if (agotado) return;

  if (intentos >= MAX_INTENTOS) {
    if (!storeGet('reconnectReload')) {
      agotado = true;
      anotarMotivo(
        ID,
        `el directo lleva congelado y se han agotado los ${MAX_INTENTOS} intentos`,
      );
      return;
    }
    recargarPagina();
    return;
  }

  intentos += 1;
  reintentando = true;
  proximoIntento = ahora + espera(intentos);

  const prometido = video.play();
  if (prometido && typeof prometido.catch === 'function') {
    prometido.catch(() => {
      // play() rechaza cuando el player todavia no puede. El siguiente
      // reintento lo recoge.
    });
  }
  log('reconexion: intento', intentos, 'en', espera(intentos) / 1000, 's');
}

/**
 * Elige el video del reproductor principal, no el primero del documento.
 *
 * En la pagina puede haber miniaturas o previews con `<video>` propio. Quedarse
 * con el primero podía vigilar un preview que nunca avanza y dejar el directo
 * real congelado sin tocar. Si hay varios dentro del player, gana el de mayor
 * area visible; si el player no tiene ninguno, se usa el mayor de la pagina.
 */
export function pickPlayerVideo(root = document) {
  let videos = [];
  for (const player of selectAll('player', root)) {
    videos.push(...(player.querySelectorAll?.('video') || []));
  }
  if (!videos.length) {
    videos = [...(root.querySelectorAll?.('video') || [])];
  }
  if (!videos.length) return null;

  let mejor = videos[0];
  let mejorArea = -1;
  for (const video of videos) {
    let area = 0;
    try {
      const rect = video.getBoundingClientRect?.();
      area = rect ? Math.max(0, rect.width) * Math.max(0, rect.height) : 0;
    } catch {
      area = 0;
    }
    if (area > mejorArea) {
      mejor = video;
      mejorArea = area;
    }
  }
  return mejor;
}

function comprobar() {
  const video = pickPlayerVideo();
  if (!video) return;

  if (video !== ultimoVideo) {
    ultimoVideo = video;
    ultimoTiempo = -1;
    ultimoAvance = Date.now();
    sinIntento();
  }

  // El usuario ha pausado a proposito, o no hay nada que reproducir: no es cosa
  // nuestra y recargarle en esa situacion seria molesto.
  if (video.paused || video.ended || video.readyState < 2) {
    sinIntento();
    return;
  }

  // Solo directos. En un VOD la duracion es finita y el "corte" suele ser otra
  // cosa; ademas recargar a mitad de un VOD perderia la posicion.
  if (video.duration !== Infinity) {
    funcionando();
    return;
  }

  const ahora = Date.now();

  if (video.currentTime !== ultimoTiempo) {
    ultimoTiempo = video.currentTime;
    ultimoAvance = ahora;
    funcionando();
    return;
  }

  if (!reintentando) {
    if (ahora - ultimoAvance < GRACIA) return;
    intentar(video, ahora);
  } else if (ahora >= proximoIntento) {
    intentar(video, ahora);
  }
}

function arrancar() {
  if (temporizador !== null) return;
  ultimoAvance = Date.now();
  temporizador = setInterval(comprobar, SONDEO);
}

function parar() {
  if (temporizador !== null) clearInterval(temporizador);
  temporizador = null;
  ultimoVideo = null;
  sinIntento();
  limpiarMotivo(ID);
}

/** Sin timer: solo olvida el estado. Cambiar de canal no es un corte. */
function reiniciar() {
  sinIntento();
  ultimoVideo = null;
  ultimoTiempo = -1;
  ultimoAvance = Date.now();
  limpiarMotivo(ID);
}

defineFeature({
  id: ID,
  label: 'Reconectar si se corta el directo',
  section: 'auto',
  default: false,
  onEnable: arrancar,
  onDisable: parar,
  onRoute: reiniciar,
  settings: [
    {
      key: 'reconnectBase',
      label: 'Espera inicial',
      type: 'select',
      options: [['5', '5 s'], ['10', '10 s'], ['30', '30 s']],
      default: '5',
    },
    {
      key: 'reconnectMax',
      label: 'Espera maxima',
      type: 'select',
      options: [['60', '1 min'], ['120', '2 min'], ['300', '5 min']],
      default: '60',
    },
    {
      key: 'reconnectReload',
      label: 'Recargar la pagina si no basta con play()',
      type: 'bool',
      default: false,
    },
  ],
});