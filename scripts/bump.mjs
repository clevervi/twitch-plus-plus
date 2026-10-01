#!/usr/bin/env node
/**
 * Sube la versión de package.json y escribe el apartado del CHANGELOG.
 *
 *   node scripts/bump.mjs patch "notas en una línea"
 *   node scripts/bump.mjs patch @notas.md
 *
 * La forma con `@archivo` existe por un motivo concreto: en Windows, pasar
 * texto con acentos como argumento de la línea de comandos llega al proceso
 * con el UTF-8 estropeado. Un archivo se lee como UTF-8 sin intermediarios, y
 * las notas de una release son justo el texto donde más molestan los acentos.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { argv, cwd } from 'node:process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const pkgPath = resolve(ROOT, 'package.json');
const changelogPath = resolve(ROOT, 'CHANGELOG.md');

const NIVELES = ['major', 'minor', 'patch'];

/** Lee las notas de un archivo, de stdin, o de los argumentos. */
export function leerNotas(args) {
  const [level, ...rest] = args;
  const unido = rest.join(' ').trim();
  if (unido.startsWith('@')) {
    const ruta = resolve(cwd(), unido.slice(1));
    if (!existsSync(ruta)) throw new Error(`no encuentro el archivo de notas: ${ruta}`);
    return readFileSync(ruta, 'utf8').trim();
  }
  return unido;
}

export function subirVersion(version, level) {
  // Los valores por defecto en la desestructuración son necesarios: con
  // version "1", split('.') devuelve un solo elemento y map() no inventa los
  // otros dos, así que minorPatch saldrían undefined y la suma daría NaN.
  const [major = 0, minor = 0, patch = 0] = String(version)
    .split('.')
    .map((n) => {
      const valor = parseInt(n, 10);
      return Number.isFinite(valor) ? valor : 0;
    });
  if (level === 'major') return `${major + 1}.0.0`;
  if (level === 'minor') return `${major}.${minor + 1}.0`;
  if (level === 'patch') return `${major}.${minor}.${patch + 1}`;
  throw new Error(`nivel desconocido: "${level}". Usa ${NIVELES.join(' | ')}`);
}

/** Apartado del CHANGELOG para una versión, con cada línea como viñeta. */
export function apartado(version, fecha, notes) {
  const cuerpo = (notes || '').trim() || '- pendiente de describir';
  const viñetas = cuerpo
    .split('\n')
    .map((linea) => linea.trim())
    .filter(Boolean)
    .map((linea) => (linea.startsWith('- ') ? linea : `- ${linea}`))
    .join('\n');
  return `\n## ${version} — ${fecha}\n\n${viñetas}\n`;
}

/**
 * Avisa si las notas parecen haber llegado sin acentos ni signos de apertura.
 * No bloquea: es una señal de que el texto pasó por `argv` y se estropeó, que
 * es justo lo que pasó con las notas de 2.2.10.
 */
export function avisarDeAcentos(notes) {
  if (!notes) return null;
  const tieneAcentos = /[áéíóúÁÉÍÓÚüñÑ¿¡]/.test(notes);
  if (tieneAcentos) return null;
  const pareceCastellano = /\b(el|la|los|las|de|del|que|y|en|para|con|se|al|por)\b/i.test(notes);
  if (!pareceCastellano) return null;
  return 'las notas no tienen ni un acento: si están en castellano, el texto ha llegado estropeado por la línea de comandos. Usa la forma @archivo.';
}

/**
 * Añade un apartado al final del CHANGELOG.
 *
 * El salto de línea va aquí y no dentro de `apartado()`, que ya empieza por
 * `\n`: hacen falta los dos para que quede una línea en blanco entre
 * secciones. Si se quita este, las secciones quedan pegadas.
 */
export function encadenar(changelog, seccion) {
  return `${String(changelog).replace(/\s*$/, '')}\n${seccion}`;
}

function ejecutar() {
  const args = process.argv.slice(2);
  const [level] = args;
  if (!NIVELES.includes(level)) {
    process.stderr.write('  uso: node scripts/bump.mjs <major|minor|patch> ["notas" | @archivo]\n');
    process.exit(2);
  }

  const notes = leerNotas(args);
  const aviso = avisarDeAcentos(notes);
  if (aviso) process.stderr.write(`  ⚠ ${aviso}\n`);

  const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
  const next = subirVersion(pkg.version, level);
  pkg.version = next;
  writeFileSync(pkgPath, `${JSON.stringify(pkg, null, 2)}\n`, 'utf8');

  let changelog = '# Changelog\n';
  try {
    changelog = readFileSync(changelogPath, 'utf8');
  } catch {
    /* se crea */
  }
  const hoy = new Date().toISOString().slice(0, 10);
  writeFileSync(changelogPath, encadenar(changelog, apartado(next, hoy, notes)), 'utf8');

  process.stdout.write(`  ${next}  (package.json + CHANGELOG.md)\n`);
}

if (argv[1] && import.meta.url === pathToFileURL(argv[1]).href) ejecutar();
