/**
 * Registro central de selectores.
 *
 * Cada clave tiene una lista de candidatos: se prueban en orden hasta que uno
 * funciona. El catálogo remoto del repo puede anteponer candidatos nuevos
 * (los fixes de la comunidad entran sin publicar una release del script) y el
 * fallback local sigue funcionando si el repo no responde o algo se rompe.
 */
import { log, warn } from './log.js';

const BASE = {
  'chat.container': [
    '[data-test-selector="chat-scrollable-area__message-container"]',
    '.chat-scrollable-area__message-container',
  ],
  'chat.line': ['[data-a-target="chat-line-message"]', '.chat-line__message'],
  'chat.username': ['.chat-line__username', '[data-a-target="chat-message-username"]'],
  'chat.input': [
    '[data-a-target="chat-input"]',
    'div[contenteditable="true"][data-a-target="chat-input"]',
    '.chat-input__textarea-container textarea',
    '.chat-input textarea',
    '.chat-input__textarea [contenteditable="true"]',
    '[data-a-target="chat-input"] textarea',
  ],
  'sideNav.root': ['[data-a-target="side-nav-bar"]', '.side-nav', '[data-test-selector="side-nav"]'],
  'sideNav.card': ['[data-a-target="side-nav-card"]', '.side-nav-card'],
  'sideNav.group': ['[data-a-target="side-nav-bar"] .tw-transition-group', '.side-nav .tw-transition-group', '.side-nav__section'],
  'sideNav.more': [
    '[data-a-target="side-nav-more"]',
    'button[data-a-target="side-nav-show-more-button"]',
    'button[data-a-target="side-nav-more-toggle"]',
    '[data-test-selector="ShowMore"] button',
    'button[data-test-selector="ShowMore"]',
    '.side-nav__more',
    'button.side-nav-show-more',
    'button[aria-label*="más" i]',
    'button[aria-label*="more" i]',
  ],
  'sideNav.link': [
    '[data-a-target="side-nav-link"]',
    '[data-a-target="side-nav-card-link"]',
    'a[data-test-selector="followed-channel"]',
    'a[data-test-selector="recommended-channel"]',
    'a.side-nav-card__link',
    '.side-nav-card a',
    '.side-nav a[href^="/"]',
  ],
  'player': ['[data-a-target="video-player"]', '.video-player', '.persistent-player'],
  'topNav': ['[data-a-target="top-nav-container"]', '.top-nav'],
  'viewerCount': [
    'strong[data-a-target="animated-channel-viewers-count"]',
    '[data-test-selector="viewer-count"]',
    '.channel-info-bar__viewers',
  ],
  'channelPoints': [
    '[data-test-selector="community-points-summary"]',
    '.community-points-summary',
    '[data-a-target="community-points-summary"]',
  ],
  'claimBonus': [
    'button:has([data-test-selector="claimable-bonus-icon"])',
    'button:has(.claimable-bonus__icon)',
    '[data-a-target="community-points-summary"] button[aria-label*="Bonus" i]',
    '[data-test-selector="community-points-summary"] button[aria-label*="Bonus" i]',
    '[data-a-target="community-points-summary"] button[aria-label*="bonificación" i]',
    '[data-test-selector="community-points-summary"] button[aria-label*="bonificación" i]',
    '.claimable-bonus__icon',
    '[data-test-selector="claimable-bonus-icon"]',
  ],
  'pauseChat': [
    'button[data-a-target="chat-pause-button"]',
    '[data-test-selector="chat-pause-button"]',
    'button[aria-label*="pause chat" i]',
    'button[aria-label*="pausar chat" i]',
    'button[aria-label*="reanudar chat" i]',
    'button[aria-label*="resume chat" i]',
    '[data-a-target="chat-pause-indicator"] button',
    '.chat-paused-footer button',
  ],
  'upNext': ['[data-a-target="up-next-queue"]', '.up-next-queue', '[data-test-selector="up-next-queue"]', '[class*="up-next-queue"]'],
  'stories': ['[data-a-target="stories-tray"]', '.stories-tray', '[data-test-selector="stories-tray"]', '[class*="stories-tray"]'],
  'userMenu': ['[data-a-target="user-menu-toggle"]', '[data-a-target="user-menu-button"]'],
};

const MAX_CANDIDATES = 8;
const MAX_LENGTH = 300;
const FORBIDDEN = /[{};@]|url\(|expression\(|javascript:|\\|\/\*/i;

const state = new Map();
for (const [key, list] of Object.entries(BASE)) state.set(key, { local: list, remote: [] });

/**
 * Salud POR CANDIDATO, no por clave.
 *
 * Con la salud por clave no se puede distinguir "el candidato remoto funciona"
 * de "funciona el local". Y como los remotos se prueban siempre primero, un
 * selector nuevo del catálogo que acierta una vez se queda como campeón para
 * siempre, aunque sea el elemento equivocado.
 *
 * Cada candidato lleva su propio historial: aciertos, fallos, y sobre todo la
 * racha de fallos seguidos, que es lo que permite degradarlo sin esperar.
 */
const MAX_RACHA_FALLOS = 3;

const salud = new Map();

function ficha(key, selector) {
  let porClave = salud.get(key);
  if (!porClave) {
    porClave = new Map();
    salud.set(key, porClave);
  }
  let ficha = porClave.get(selector);
  if (!ficha) {
    ficha = { selector, aciertos: 0, fallos: 0, rachaFallos: 0, ultimoAcierto: 0, coincidencias: 0 };
    porClave.set(selector, ficha);
  }
  return ficha;
}

/** Un candidato con racha de fallos ya no es de fiar. */
function degradado(ficha) {
  return ficha.rachaFallos >= MAX_RACHA_FALLOS;
}

/**
 * Ordena los candidatos por confianza, no por llegada.
 *
 * 1. Los que ya han acertado, por número de aciertos. Es la prueba de que el
 *    candidato engancha lo que debe.
 * 2. Los que no tienen historial, en su orden original. Sin datos no se
 *    inventa nada: el comportamiento del primer arranque es idéntico al de
 *    siempre, con los remotos delante.
 * 3. Los que llevan tres fallos seguidos, al final. Siguen probándose, pero
 *    ya no pueden tapar a los que funcionan.
 */
function ordenar(fichas) {
  const probados = [];
  const nuevos = [];
  const caidos = [];
  fichas.forEach((registro) => {
    if (degradado(registro)) caidos.push(registro);
    else if (registro.aciertos > 0) probados.push(registro);
    else nuevos.push(registro);
  });
  probados.sort((a, b) => b.aciertos - a.aciertos);
  return [...probados, ...nuevos, ...caidos].map((registro) => registro.selector);
}

function list(key) {
  const entry = state.get(key);
  if (!entry) return [];
  const todos = entry.remote.concat(entry.local);
  // `ordenar` trabaja con las fichas, no con las cadenas: el criterio es el
  // historial de cada candidato, que vive en la ficha.
  return ordenar(todos.map((selector) => ficha(key, selector)));
}

function anotar(key, selector, acierto, coincidencias = 1) {
  // El registro se llama `registro` y no `ficha` a propósito: `const ficha =
  // ficha(...)` se referencia a sí mismo en el inicializador y revienta con
  // ReferenceError por zona muerta temporal.
  const registro = ficha(key, selector);
  if (acierto) {
    registro.aciertos += 1;
    registro.rachaFallos = 0;
    registro.ultimoAcierto = Date.now();
    registro.coincidencias = Math.max(registro.coincidencias, coincidencias);
  } else {
    registro.fallos += 1;
    registro.rachaFallos += 1;
  }
}

export function candidates(key) {
  return list(key);
}

export function select(key, root = document, { track = true } = {}) {
  const candidatos = list(key);
  for (const selector of candidatos) {
    try {
      const found = root.querySelector(selector);
      if (found) {
        if (track) anotar(key, selector, true);
        // Los que están por detrás cuentan como fallo: no resolvieron, y con
        // el tiempo un candidato que siempre encaja primero deja de hacerlo.
        for (const otro of candidatos) {
          if (otro !== selector && track) anotar(key, otro, false);
        }
        return found;
      }
      if (track) anotar(key, selector, false);
    } catch {
      /* candidato inválido: se ignora */
    }
  }
  return null;
}

export function selectAll(key, root = document) {
  const candidatos = list(key);
  for (const selector of candidatos) {
    try {
      const encontrados = root.querySelectorAll(selector);
      if (encontrados && encontrados.length) {
        anotar(key, selector, true, encontrados.length);
        return Array.from(encontrados);
      }
    } catch {
      /* ignorar */
    }
    anotar(key, selector, false);
  }
  return [];
}

const TOO_BROAD = [
  /^\*$/,                          // universal
  /^[a-z]+$/i,                     // solo un tag: button, div, span, a
  /^\[[a-z-]+\]$/i,                // solo un atributo: [class], [id], [href]
  /^\.\w+$/,                       // una sola clase sin contexto: .foo
  /^#\w+$/,                        // un solo id sin contexto: #bar
  /^[a-z]+\s*>\s*\*$/i,            // button > * , div > *
  /^[a-z]+\s+\*$/i,                // button * , div *
];

function isTooBroad(selector) {
  const s = selector.trim();
  if (s.length < 6) return true;   // demasiado corto para ser específico
  for (const re of TOO_BROAD) if (re.test(s)) return true;
  return false;
}

export function isValidSelector(selector) {
  if (typeof selector !== 'string') return false;
  const s = selector.trim();
  if (!s || s.length > MAX_LENGTH) return false;
  if (FORBIDDEN.test(s)) return false;
  if (isTooBroad(s)) return false;
  return true;
}

/** Aplica selectores remotos. Devuelve cuántos se aceptaron y cuáles se rechazaron. */
export function applyRemote(map) {
  const applied = [];
  const rejected = [];
  const rejectedBroad = [];
  if (!map || typeof map !== 'object') return { applied, rejected, rejectedBroad };

  for (const [key, raw] of Object.entries(map)) {
    const entry = state.get(key);
    if (!entry) {
      rejected.push(key);
      continue;
    }
    const items = Array.isArray(raw) ? raw : [raw];
    const incoming = items.filter(isValidSelector);
    const broad = items.filter((s) => typeof s === 'string' && !FORBIDDEN.test(s) && isTooBroad(s));

    if (!incoming.length) {
      rejected.push(key);
      if (broad.length) rejectedBroad.push(`${key}: ${broad.join(', ')}`);
      continue;
    }
    entry.remote = incoming.slice(0, MAX_CANDIDATES);
    applied.push(key);
  }

  if (applied.length) log('selectores remotos aplicados:', applied.join(', '));
  if (rejected.length) warn('selectores remotos rechazados:', rejected.join(', '));
  if (rejectedBroad.length) warn('selectores remotos demasiado amplios:', rejectedBroad.join(' | '));
  return { applied, rejected, rejectedBroad };
}

export function clearRemote() {
  for (const entry of state.values()) entry.remote = [];
}

export function snapshot() {
  const out = {};
  for (const [key, entry] of state) out[key] = list(key);
  return out;
}

/**
 * Estado de todas las claves: qué selector sigue funcionando y cuáles han
 * dejado de existir. Es el dato que dice "qué se rompió" sin adivinar.
 *
 * Ahora incluye el detalle por candidato, que es lo que permite ver por qué
 * uno funciona mejor que otro: cuántos aciertos lleva, si está degradado, y
 * cuántos elementos encuentra cuando encuentra.
 */
export function selectorReport(root = document) {
  return [...state.keys()].map((key) => {
    const entry = state.get(key);
    // `ok` significa "resuelve contra este DOM", que es lo que necesita saber
    // quien lee el informe. Se resuelve con track:false para no contaminar el
    // historial con una comprobación de diagnóstico.
    const ok = select(key, root, { track: false }) !== null;
    const porCandidato = list(key).map((selector) => {
      const registro = salud.get(key)?.get(selector);
      return {
        selector,
        remoto: entry.remote.includes(selector),
        aciertos: registro?.aciertos ?? 0,
        fallos: registro?.fallos ?? 0,
        degradado: registro ? degradado(registro) : false,
        ultimoAcierto: registro?.ultimoAcierto ?? 0,
      };
    });
    const elegido = porCandidato.find((c) => c.aciertos > 0 && !c.degradado) || porCandidato[0] || null;
    return {
      key,
      ok,
      candidato: elegido?.selector ?? null,
      total: porCandidato.length,
      remoto: entry.remote.length,
      candidatos: porCandidato,
    };
  });
}

export function brokenSelectors(root = document) {
  return selectorReport(root).filter((row) => !row.ok);
}

/** Claves cuyo candidato ganador es remoto, para ver qué ha cambiado de golpe. */
export function promovidosRemotamente() {
  const out = [];
  for (const [key, porCandidato] of salud) {
    const ganador = [...porCandidato.values()]
      .filter((f) => f.aciertos > 0 && !degradado(f))
      .sort((a, b) => b.aciertos - a.aciertos)[0];
    if (!ganador) continue;
    const entry = state.get(key);
    if (ganador.selector && entry?.remote.includes(ganador.selector) && entry.local.length) {
      out.push({ key, candidato: ganador.selector, aciertos: ganador.aciertos });
    }
  }
  return out;
}

export function resetHealth() {
  salud.clear();
}
