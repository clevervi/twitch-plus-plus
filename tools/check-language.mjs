// Detector de mezcla de idiomas en la documentación y las plantillas de issue.
// Solo vigila los tokens que delatan prosa en inglés o en otro idioma
// colada dentro de un texto que debe estar en español.
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { extname, join, relative, resolve } from 'node:path';

const RAIZ = resolve('.');

/**
 * Documentos que se revisan enteros: son prosa, y su inglés sería un error.
 */
const PROSA = [
  '.github/ISSUE_TEMPLATE',
  '.github/PULL_REQUEST_TEMPLATE.md',
  'README.md',
  'CHANGELOG.md',
  'CONTRIBUTING.md',
  'SECURITY.md',
  'CODE_OF_CONDUCT.md',
];

/**
 * Ficheros YAML que se revilan **solo por sus comentarios**. El resto es
 * código: claves, nombres de acciones y `run:` llevan inglés a propósito, y
 * revisarlos enteros daría falsos positivos por dozen.
 *
 * Se cubre igualmente porque los comentarios de estos ficheros son los
 * lugares donde se documenta el porqué de cada paso, y es prosa en español
 * igual que el resto.
 */
const SOLO_COMENTARIOS = ['.github/workflows', '.github/dependabot.yml'];

// Solo palabras que no pueden aparecer en español. La jerga del proyecto
// (feature, commit, workflow, build) es intencionada y no se vigila.
const SOSPECHOSOS = [
  ' the ',
  ' and ',
  ' with ',
  ' this ',
  ' that ',
  ' from ',
  ' have ',
  ' been ',
  ' was ',
  ' were ',
  ' which ',
  ' there ',
  ' about ',
  ' please ',
  ' should ',
  ' would ',
  ' could ',
  ' when ',
  ' what ',
  ' will ',
  ' your ',
  ' their ',
  ' into ',
  ' than ',
  ' then ',
  ' not ',
  ' but ',
  ' for ',
  ' are ',
];

/**
 * Alfabetos que no aparecen en español. Ningún documento de este repo los
 * necesita, y son justo lo que se cuela cuando se escribe deprisa: dos veces
 * colaron ideogramas dentro de un changelog y de un comentario de CI.
 *
 * No se vigilan aquí los `.js` de `src/`, donde `auto-claim` incluye
 * cirílico a propósito en sus expresiones de detección, ni la fixture del
 * navegador, que lleva una línea de chat en chino a propósito.
 */
const ALFABETOS = [
  { nombre: 'ideogramas CJK', patron: /[\u3000-\u9fff\uff00-\uffef]/g },
  { nombre: 'cirílico', patron: /[\u0400-\u04ff]/g },
  { nombre: 'hangul', patron: /[\uac00-\ud7af]/g },
];

const RUTAS = [];
const SOLO_YAML = new Set();

function recorrer(ruta, soloComentarios) {
  const info = statSync(ruta);
  if (info.isDirectory()) {
    for (const entrada of readdirSync(ruta)) recorrer(join(ruta, entrada), soloComentarios);
    return;
  }
  if (!['.md', '.yml', '.yaml'].includes(extname(ruta))) return;
  RUTAS.push({ ruta, soloComentarios });
  if (soloComentarios) SOLO_YAML.add(ruta);
}

for (const objetivo of PROSA) recorrer(join(RAIZ, objetivo), false);
for (const objetivo of SOLO_COMENTARIOS) recorrer(join(RAIZ, objetivo), true);

/** Deja solo la prosa: fuera bloques de código, identificadores y URLs. */
function soloProsa(linea) {
  return linea
    .replace(/`[^`]*`/g, '')
    .replace(/\b[\w.-]+\.[a-z]{2,4}\b/g, '')
    .replace(/https?:\/\/\S+/g, '');
}

let fallos = 0;

/**
 * Analiza una línea y devuelve los problemas que encuentra.
 *
 * Se exporta para poder testearlo sin tocar el repo: los casos que aparecen
 * abajo son literalmente los que se colaron dos veces seguidas.
 */
export function hallazgos(texto, { soloComentarios = false } = {}) {
  const found = [];
  const paraRevisar = soloComentarios ? (texto.match(/(^|\s)#(.*)$/)?.[2] ?? '') : texto;
  if (!paraRevisar.trim()) return found;

  const limpia = soloProsa(paraRevisar);
  const minuscula = limpia.toLowerCase();

  for (const palabra of SOSPECHOSOS) {
    if (minuscula.includes(palabra)) found.push({ tipo: 'palabra', detalle: palabra.trim() });
  }
  for (const { nombre, patron } of ALFABETOS) {
    // El patrón es global, y `test()` con /g avanza el lastIndex entre
    // llamadas: sin reset, el mismo texto daría resultados distintos cada vez.
    patron.lastIndex = 0;
    if (patron.test(limpia)) found.push({ tipo: 'alfabeto', detalle: nombre });
  }
  return found;
}

for (const { ruta, soloComentarios } of RUTAS) {
  const crudo = readFileSync(ruta, 'utf8');
  const lineas = crudo.split(/\r?\n/);

  // Los bloques cercados de Markdown sí contienen inglés legítimo (comandos,
  // claves de JSON). Se saltan enteros.
  let enBloque = false;

  lineas.forEach((linea, indice) => {
    const relativa = relative(RAIZ, ruta);

    if (extname(ruta) === '.md') {
      if (/^\s*```/.test(linea)) {
        enBloque = !enBloque;
        return;
      }
      if (enBloque) return;
    }

    for (const problema of hallazgos(linea, { soloComentarios })) {
      fallos += 1;
      process.stderr.write(
        `  ✗ ${relativa}:${indice + 1}: ${problema.detalle}\n    ${linea.trim()}\n`,
      );
    }
  });
}

if (fallos) {
  process.stderr.write(`\nidioma: ${fallos} posible(s) mezcla(s) de idioma\n`);
  process.exit(1);
}
process.stdout.write(`  idioma: ${RUTAS.length} archivo(s) sin mezcla evidente\n`);