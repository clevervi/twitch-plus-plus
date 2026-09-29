#!/usr/bin/env node
/**
 * Bundler propio (0 dependencias) para Twitch++.
 *
 * Reglas del formato que soporta (ver README → "Cómo contribute"):
 *   - solo `import { a, b } from './relativo.js';` (sin default, sin `as`, sin `*`)
 *   - `export const|let|var|function|class|async function` y `export { a, b };`
 *
 * Cada módulo se compila a `(function () { ... return { exports } })()`, así los
 * nombres locales no colisionan entre archivos y el bundle sigue siendo un único
 * IIFE válido para Tampermonkey.
 */
import { spawnSync } from 'node:child_process';
import { mkdirSync, readFileSync, watch, writeFileSync } from 'node:fs';
import { dirname, relative, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const ENTRY = resolve(ROOT, 'src/index.js');
const OUT = resolve(ROOT, 'dist/twitch-plus-plus.user.js');
const LATEST = resolve(ROOT, 'dist/latest.json');

const IMPORT_RE = /^import\s*(?:\{([\s\S]*?)\}\s*from\s*)?['"](\.[^'"]+)['"];?[ \t]*$/gm;
const REEXPORT_RE = /^export\s*\{([\s\S]*?)\}\s*from\s*['"](\.[^'"]+)['"];?[ \t]*$/gm;
const EXPORT_LIST_RE = /^export\s*\{([\s\S]*?)\};?[ \t]*$/gm;
const EXPORT_DECL_RE = /^export\s+(?=(?:const|let|var|function|class|async)\b)/gm;
const DECL_NAME_RE = /^export\s+(?:const|let|var|function|class|async\s+function)\s*\*?\s*([A-Za-z_$][\w$]*)/gm;

const pkg = JSON.parse(readFileSync(resolve(ROOT, 'package.json'), 'utf8'));
const branch = process.env.TWPP_BRANCH || 'main';

function repoInfo() {
  const raw = (pkg.repository && (pkg.repository.url || pkg.repository)) || '';
  const match = String(raw).match(/github\.com[:/]+([^/]+)\/([^/]+?)(?:\.git)?$/);
  const owner = match ? `${match[1]}/${match[2]}` : 'tu-usuario/twitch-plus-plus';
  return { repo: `https://github.com/${owner}`, raw: `https://raw.githubusercontent.com/${owner}/${branch}` };
}

/** `a, b as c` → [{ local: 'a', exported: 'a' }, { local: 'b', exported: 'c' }] */
function specifiers(list) {
  return String(list)
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => {
      const [local, alias] = entry.split(/\s+as\s+/);
      return { local: local.trim(), exported: (alias || local).trim() };
    });
}

function readModule(file) {
  let code = readFileSync(file, 'utf8');
  const imports = [];
  const exports = [];
  const reexports = [];

  for (const match of code.matchAll(DECL_NAME_RE)) exports.push({ local: match[1], exported: match[1] });
  for (const match of code.matchAll(EXPORT_LIST_RE)) exports.push(...specifiers(match[1]));
  for (const match of code.matchAll(REEXPORT_RE)) {
    const target = resolve(dirname(file), match[2]);
    for (const item of specifiers(match[1])) reexports.push({ ...item, target });
  }
  for (const match of code.matchAll(IMPORT_RE)) {
    imports.push({ target: resolve(dirname(file), match[2]), items: specifiers(match[1] || '') });
  }

  code = code.replace(REEXPORT_RE, '').replace(IMPORT_RE, '').replace(EXPORT_LIST_RE, '').replace(EXPORT_DECL_RE, '');

  const leftover = code.match(/^\s*(?:import|export)\s/m);
  if (leftover) {
    throw new Error(`${relative(ROOT, file)}: import/export no soportado ("${leftover[0].trim()}")`);
  }

  return { imports, exports, reexports, body: code.trim(), file };
}

function collect() {
  const order = [];
  const index = new Map();
  const visiting = new Set();

  const visit = (file) => {
    if (index.has(file)) return;
    if (visiting.has(file)) throw new Error(`dependencia circular: ${relative(ROOT, file)}`);
    visiting.add(file);
    const mod = readModule(file);
    for (const entry of mod.imports) visit(entry.target);
    for (const entry of mod.reexports) visit(entry.target);
    visiting.delete(file);
    index.set(file, order.length);
    order.push(mod);
  };

  visit(ENTRY);
  checkBindings(order);
  return { order, index };
}

/** Falla el build si un módulo importa algo que el destino no exporta. */
function checkBindings(order) {
  const cache = new Map();
  const exportsOf = (file) => {
    if (!cache.has(file)) cache.set(file, new Set(readModule(file).exports.map((item) => item.exported)));
    return cache.get(file);
  };
  for (const mod of order) {
    for (const entry of mod.imports) {
      const available = exportsOf(entry.target);
      for (const item of entry.items) {
        if (available.has(item.local)) continue;
        throw new Error(`${relative(ROOT, mod.file)}: "${item.local}" no se exporta desde ${relative(ROOT, entry.target)}`);
      }
    }
  }
}

function compile() {
  const { order, index } = collect();
  const id = (file) => `__m${index.get(file)}`;
  const blocks = [];

  for (const mod of order) {
    const bindings = mod.imports
      .filter((entry) => entry.items.length)
      .map((entry) => `const { ${entry.items.map((item) => `${item.local}: ${item.exported}`).join(', ')} } = ${id(entry.target)};`)
      .join('\n');
    const local = mod.exports.map((item) => `  ${item.exported}: ${item.local},`).join('\n');
    const reexported = mod.reexports.map((item) => `  ${item.exported}: ${id(item.target)}.${item.local},`).join('\n');
    const returned = [local, reexported].filter(Boolean).join('\n');
    const body = [bindings, mod.body].filter(Boolean).join('\n\n');
    const label = `/* ---- ${relative(ROOT, mod.file).replace(/\\/g, '/')} ---- */`;

    blocks.push(`${label}\nconst ${id(mod.file)} = (function () {\n${body}\nreturn {\n${returned}\n};\n})();`);
  }

  return `/* Twitch++ — bundle generado por scripts/build.mjs. No editar a mano. */\n\n${blocks.join('\n\n')}\n\n${id(ENTRY)};\n`;
}

function header() {
  const { repo, raw } = repoInfo();
  return readFileSync(resolve(ROOT, 'src/meta.header.js'), 'utf8')
    .replace(/%VERSION%/g, pkg.version)
    .replace(/%REPO%/g, repo)
    .replace(/%RAW%/g, raw)
    .trim();
}

function notes() {
  try {
    const section = readFileSync(resolve(ROOT, 'CHANGELOG.md'), 'utf8')
      .split(/^## /m)
      .find((chunk) => chunk.startsWith(pkg.version));
    if (!section) return '';
    return section
      .split('\n')
      .slice(1)
      .filter((line) => line.trim())
      .map((line) => line.replace(/^[-*]\s*/, '').trim())
      .join('\n')
      .trim();
  } catch {
    return '';
  }
}

function build() {
  const started = Date.now();
  mkdirSync(dirname(OUT), { recursive: true });

  const { repo, raw } = repoInfo();
  const body = compile()
    .replace(/__VERSION__/g, pkg.version)
    .replace(/__REPO__/g, repo)
    .replace(/__RAW__/g, raw)
    .replace(/__BRANCH__/g, branch);

  const code = `${header()}\n\n(function () {\n'use strict';\n${body}\n})();\n`;
  writeFileSync(OUT, code, 'utf8');

  writeFileSync(
    LATEST,
    `${JSON.stringify(
      {
        version: pkg.version,
        script: `${raw}/dist/twitch-plus-plus.user.js`,
        homepage: repo,
        publishedAt: new Date().toISOString(),
        notes: notes(),
      },
      null,
      2,
    )}\n`,
    'utf8',
  );

  const check = spawnSync(process.execPath, ['--check', OUT], { encoding: 'utf8' });
  if (check.status !== 0) {
    process.stderr.write(check.stderr || 'fallo de sintaxis en el bundle\n');
    process.exit(1);
  }

  const kb = (Buffer.byteLength(code, 'utf8') / 1024).toFixed(1);
  process.stdout.write(`  dist/twitch-plus-plus.user.js  v${pkg.version}  ${kb} KB  (${Date.now() - started} ms)\n`);
  return code;
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  build();
  if (process.argv.includes('--watch')) {
    let timer = null;
    process.stdout.write('  vigilando src/ …\n');
    watch(resolve(ROOT, 'src'), { recursive: true }, () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        try {
          build();
        } catch (error) {
          process.stderr.write(`  ${error.message}\n`);
        }
      }, 120);
    });
  }
}

export { build, compile, collect };
