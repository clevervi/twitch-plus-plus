#!/usr/bin/env node
/**
 * Lint sin dependencias: parsea cada módulo ESM (copiándolo a .mjs porque
 * `node --check` no resuelve el `type: module` de package.json) y comprueba
 * un par de reglas que importan en este repo.
 */
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = resolve(ROOT, 'src');

const FORBIDDEN_IMPORT = /^\s*import\s+(\w+)\s+from\b/m;

function unusedImports(file, code) {
  const body = code.replace(/^import[\s\S]*?;$/gm, '');
  const unused = [];
  for (const statement of code.matchAll(/^import\s*\{([\s\S]*?)\}\s*from/gm)) {
    for (const raw of statement[1].split(',')) {
      const parts = raw.trim().split(/\s+as\s+/);
      const name = (parts[1] || parts[0] || '').trim();
      if (!name) continue;
      if (!new RegExp(`\\b${name.replace(/\$/g, '\\$')}\\b`).test(body)) unused.push(name);
    }
  }
  return unused;
}

function walk(dir) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...walk(full));
    else if (entry.endsWith('.js')) out.push(full);
  }
  return out;
}

const files = walk(SRC);
const tmp = mkdtempSync(join(tmpdir(), 'twpp-lint-'));
let failures = 0;

for (const file of files) {
  const code = readFileSync(file, 'utf8');
  const label = relative(ROOT, file);

  const copy = join(tmp, 'check.mjs');
  mkdirSync(dirname(copy), { recursive: true });
  writeFileSync(copy, code, 'utf8');

  const parsed = spawnSync(process.execPath, ['--check', copy], { encoding: 'utf8' });
  if (parsed.status !== 0) {
    failures += 1;
    process.stderr.write(`  ✗ ${label}\n${(parsed.stderr || '').split('\n').slice(0, 4).join('\n')}\n`);
    continue;
  }

  if (FORBIDDEN_IMPORT.test(code)) {
    failures += 1;
    process.stderr.write(`  ✗ ${label}: import por defecto no soportado por el bundler\n`);
    continue;
  }

  const long = code.split('\n').findIndex((line) => line.length > 400);
  if (long > -1) {
    failures += 1;
    process.stderr.write(`  ✗ ${label}:${long + 1}: línea demasiado larga (${code.split('\n')[long].length})\n`);
  }

  const unused = unusedImports(file, code);
  if (unused.length) {
    failures += 1;
    process.stderr.write(`  ✗ ${label}: import sin usar: ${unused.join(', ')}\n`);
  }
}

rmSync(tmp, { recursive: true, force: true });

if (failures) {
  process.stderr.write(`\nlint: ${failures} problema(s) en ${files.length} archivo(s)\n`);
  process.exit(1);
}

process.stdout.write(`  lint: ${files.length} módulos OK\n`);
