# Cómo contribuir en Twitch++

Este proyecto es un userscript: su superficie de ataque es el DOM de Twitch, que cambia sin avisar. El proceso está pensado para que un arreglo sea fácil de revisar, fácil de revertir y llegue rápido a quien lo necesita.

## Antes de escribir nada

1. **Busca issues abiertos.** Puede que alguien ya lo haya reportado, o esté a punto de hacerlo.
2. **Abre un issue antes de un PR.** El PR va colgado de un issue aprobado. Eso garantiza que el arreglo responde a un problema real y no a una preferencia personal.
3. **Si es un selector roto, usa la sonda antes de reportar.** La mayoría de los reportes son cambios de Twitch. Con la salida de `probe.html` el arreglo es casi mecánico.

```bash
npm run verify   # lint + build + tests. No hace falta npm install: el proyecto no tiene dependencias.
```

## El ciclo completo

```bash
git checkout main
git pull
git checkout -b fix/store-validate    # el patrón de rama lo exige pr-checks

# ... escribir código ...

npm run verify
git add -A
git commit -m "fix(store): validar la forma de los valores"
git push -u origin fix/store-validate
```

El cuerpo del PR tiene que incluir `Closes #N` y referenciar un issue con la etiqueta `estado:aprobado`. El workflow `pr-checks` lo comprueba. También puedes ejecutarlo en local:

```bash
PR_HEAD_REF=fix/store-validate \
PR_TITLE="fix(store): validar la forma de los valores" \
PR_BODY="$(cat cuerpo.md)" \
PR_LABELS='["tipo:bug"]' \
node scripts/validate-pr.mjs
```

## Convenciones

| Elemento | Regla |
|---|---|
| Rama | `fix/…`, `feat/…`, `chore/…`, `docs/…`, `refactor/…`, `perf/…`, `test/…`, `ci/…`, `build/…`, `revert/…` |
| Commit | Formato convencional: `fix(area): descripción en imperativo y en minúsculas` |
| Título del PR | Idéntico a la línea de commit |
| Etiquetas del PR | Exactamente una `tipo:*` |
| Mezcla | Squash. El título del PR es el mensaje del commit en `main` |
| `dist/` | Se commitea siempre: es lo que sirven `@downloadURL` y `@updateURL` |

Si tocas `src/`, tienes que reconstruir y commitear `dist/`. Si no, la comprobación *el bundle no debe haber derivado* falla en CI.

`main` exige pull request, y no hay excepción: ni siquiera para las releases.

## Dónde va cada cosa

```text
src/core/       el motor: store, bus, registro, planificador, selectores, log
src/features/   una feature por archivo, sin acceso directo al DOM de Twitch
src/ui/         panel, estilos, avisos, presets
scripts/        build, bump, lint y las utilidades del proceso
test/           pruebas unitarias con el runner de Node, sin dependencias
catalog.json    el catálogo remoto de selectores que el script recoge por red
```

Regla de oro: **las features no saben cómo es el DOM de Twitch**. Si necesitas un selector nuevo, va en `src/core/selectors.js` y en `catalog.json`, no dentro de la feature. Cuando Twitch cambie ese DOM se arregla en un sitio y no en quince.

## Cuando tocas `catalog.json`

`catalog.json` es lo que permite arreglar selectores sin obligar a reinstalar el script. Merece un cuidado extra:

1. Sube `revision` en la entrada modificada. Si no lo haces, los usuarios con la versión anterior no recogen el cambio.
2. Prueba el selector contra un volcado real del DOM. `probe.html` existe justo para eso. No lo escribas de memoria.
3. No te apoyes en clases con hash generado: cambian sin previo aviso.
4. No borres candidatos antiguos sin justificar. A veces el nuevo solo funciona en Firefox y el viejo cubre Chrome.

## Etiquetas

| Prefijo | Para qué |
|---|---|
| `tipo:` | Naturaleza del cambio. Un PR lleva exactamente una. |
| `estado:` | `revision` → `aprobado` → `en-curso` → `resuelto`. |
| `P0` a `P3` | Prioridad. `P0:critico` es lo que rompe la instalación o hace perder la configuración. |
| `area:` | Dónde vive el cambio. |
| `mod:` | Módulo concreto, para poder seguir la salud de uno. |
| `nav:` | Entorno: gestor de scripts, navegador, o cambio de Twitch. |

## Antes de pedir revisión

- [ ] `npm run verify` pasa
- [ ] Probado en `twitch.tv` **navegando entre canales**, no solo recargando. La mayoría de los errores aparecen al cambiar de canal, no al cargar.
- [ ] `TwitchPP.diagnostics.report()` no enseña selectores rotos nuevos
- [ ] Si tocaste selectores: `catalog.json` subido de `revision` y probado con la sonda
- [ ] `dist/` commiteado
- [ ] El PR explica **por qué**, no solo qué

## Dudas

Las dudas de uso y configuración no son issues. Van a [Discussions](https://github.com/clevervi/twitch-plus-plus/discussions).
