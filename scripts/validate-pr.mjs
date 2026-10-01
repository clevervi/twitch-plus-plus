#!/usr/bin/env node
/**
 * Validación de pull requests.
 *
 * Lo invoca el workflow `pr-checks.yml` y también se puede ejecutar en local
 * exportando las mismas variables. Las reglas puras viven en funciones
 * exportadas para poder cubrirlas desde `test/`.
 *
 * Reglas:
 *   1. la rama sigue `tipo/descripcion`
 *   2. el título usa formato convencional
 *   3. el cuerpo enlaza al menos un issue con Closes/Fixes/Resolves
 *   4. el PR tiene exactamente una etiqueta `tipo:*`
 *   5. cada issue enlazado tiene la etiqueta `estado:aprobado`
 */
import { spawnSync } from 'node:child_process';
import { argv } from 'node:process';
import { pathToFileURL } from 'node:url';

const TIPOS = [
  'build',
  'chore',
  'ci',
  'docs',
  'feat',
  'fix',
  'perf',
  'refactor',
  'revert',
  'style',
  'test',
];

export const RAMA_RE = new RegExp(`^(?:${TIPOS.join('|')})/[a-z0-9._-]+$`);
export const TITULO_RE = new RegExp(`^(?:${TIPOS.join('|')})(?:\\([a-z0-9._-]+\\))?!?: .+$`);
export const ENLACE_RE = /\b(?:closes?|closed|fix(?:e[sd])?|resolve[sd]?)\s+#(\d+)/gi;
export const PREFIJO_TIPO = 'tipo:';
export const ETIQUETA_APROBACION = 'estado:aprobado';

export function validarRama(ref) {
  return RAMA_RE.test(String(ref || ''))
    ? null
    : `La rama "${ref}" no sigue el patrón tipo/descripcion, por ejemplo fix/store-validate.`;
}

export function validarTitulo(title) {
  return TITULO_RE.test(String(title || ''))
    ? null
    : `El título "${title}" no sigue el formato convencional, por ejemplo fix(store): validar la forma de los valores.`;
}

/**
 * GitHub no crea referencias a issues dentro de bloques de código ni de
 * fragmentos en línea, así que el validador tampoco las busca ahí. Sin esto,
 * documentar un ejemplo con `Closes #N` en el propio PR lo hace fallar.
 */
export function sinCodigo(body) {
  return String(body || '')
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`[^`\n]*`/g, ' ');
}

export function issuesEnlazados(body) {
  const numeros = new Set();
  for (const coincidencia of sinCodigo(body).matchAll(ENLACE_RE)) {
    const numero = Number(coincidencia[1]);
    if (Number.isInteger(numero) && numero > 0) numeros.add(numero);
  }
  return [...numeros];
}

export function validarCuerpo(body) {
  const numeros = issuesEnlazados(body);
  if (numeros.length) return null;
  return 'El cuerpo no enlaza ningún issue. Añade una línea "Closes #N".';
}

export function validarEtiquetas(labels) {
  const lista = (labels || []).map((etiqueta) => (typeof etiqueta === 'string' ? etiqueta : etiqueta?.name)).filter(Boolean);
  const tipos = lista.filter((etiqueta) => etiqueta.startsWith(PREFIJO_TIPO));
  if (tipos.length === 1) return null;
  if (!tipos.length) return `El PR no tiene ninguna etiqueta ${PREFIJO_TIPO}*.`;
  return `El PR tiene ${tipos.length} etiquetas ${PREFIJO_TIPO}* (${tipos.join(', ')}). Debe tener exactamente una.`;
}

export function issueAprobado(numero) {
  const consulta = spawnSync('gh', ['issue', 'view', String(numero), '--json', 'labels', '--jq', '.labels[].name'], {
    encoding: 'utf8',
    env: process.env,
  });
  if (consulta.status !== 0) return `No se ha podido leer el issue #${numero}: ${(consulta.stderr || '').trim()}`;
  const etiquetas = consulta.stdout.split('\n').map((line) => line.trim()).filter(Boolean);
  if (etiquetas.includes(ETIQUETA_APROBACION)) return null;
  return `El issue #${numero} no tiene la etiqueta ${ETIQUETA_APROBACION}. Solicítasela al mantenedor antes de continuar.`;
}

/** Devuelve la lista de fallos; vacía significa que el PR es válido. */
export function validarPullRequest({ rama, titulo, cuerpo, etiquetas, comprobarIssues = true }) {
  const fallos = [
    validarRama(rama),
    validarTitulo(titulo),
    validarCuerpo(cuerpo),
    validarEtiquetas(etiquetas),
  ].filter(Boolean);

  if (comprobarIssues) {
    for (const numero of issuesEnlazados(cuerpo)) {
      const fallo = issueAprobado(numero);
      if (fallo) fallos.push(fallo);
    }
  }

  return fallos;
}

function ejecutar() {
  const { PR_HEAD_REF: rama, PR_TITLE: titulo, PR_BODY: cuerpo, PR_LABELS: etiquetas } = process.env;
  if (!process.env.PR_NUMBER) {
    process.stderr.write('  validate-pr: define PR_HEAD_REF, PR_TITLE, PR_BODY y PR_LABELS para ejecutarlo en local.\n');
    process.exit(2);
  }

  let lista;
  try {
    lista = JSON.parse(etiquetas || '[]');
  } catch {
    lista = [];
  }

  const fallos = validarPullRequest({ rama, titulo, cuerpo, etiquetas: lista });
  if (fallos.length) {
    process.stderr.write(`  ✗ validate-pr: ${fallos.length} problema(s)\n`);
    for (const fallo of fallos) process.stderr.write(`    - ${fallo}\n`);
    process.exit(1);
  }

  process.stdout.write('  validate-pr: PR conforme\n');
}

if (argv[1] && import.meta.url === pathToFileURL(argv[1]).href) ejecutar();
