# Twitch++

Userscript de Tampermonkey para limpiar Twitch: tema OLED, sidebar compacta, chat con buscador y resaltados, analítica de viewers, auto-Channel Points y pausa de chat.

La diferencia con un userscript de un solo archivo: **el código vive en este repo** (módulos, tests, CI) y el script se **construye y se actualiza solo**. Además, el repo publica un *catálogo* de selectores y features experimentales que el script recoge por red: cuando Twitch cambia el DOM, se arregla desde aquí sin obligar a reinstalar nada.

```
npm run verify     # lint + build + tests (sin dependencias, sin npm install)
npm run build      # genera dist/twitch-plus-plus.user.js y dist/latest.json
npm run watch      # reconstruye al guardar
```

## Instalación

1. Publica el repo (o forkéalo) y ajusta `repository.url` en `package.json` para que apunte a tu usuario.
2. `npm run build`.
3. En Tampermonkey → *Create new script* → pega el contenido de `dist/twitch-plus-plus.user.js`.
   - O usa la URL directa: `https://raw.githubusercontent.com/<tu-usuario>/twitch-plus-plus/main/dist/twitch-plus-plus.user.js` con `@require`.
4. Desde ese momento las actualizaciones salen solas por `@updateURL`.

Atajos por defecto: `Alt+O` abre el panel, `Alt+P` pausa el chat, `Alt+Shift+X` desactiva todo (válvula de escape).

## Estructura

```
src/
  index.js              punto de entrada (solo arranca y expone TwitchPP)
  app.js                orden de arranque y tareas de red
  core/
    registry.js         defineFeature + ciclo de vida + circuit breaker
    selectors.js        registro de selectores con candidatos y fallback
    store.js            config tipada (declare/get/set + import/export)
    migrations.js       un paso por versión de config
    scheduler.js        latido único, evento + intervalo, se para en segundo plano
    router.js           navegación SPA de Twitch
    styles.js           CSS consolidado con scope por feature
    catalog.js          catálogo remoto (selectores + features del repo)
    updater.js          comprobación de versión contra dist/latest.json
    keybinds.js         atajos con validación
    twitch.js           helpers de Twitch (canal, miniaturas, viewers, chat)
    gm.js               adaptador GM_* con fallback a localStorage
    dom.js, log.js, bus.js, toast.js, version.js
  features/             una feature por archivo
  ui/panel.js           panel en shadow DOM (filas, ajustes, presets)
  ui/presets.js         minimal / balanced / agresivo
test/                   41 tests con node:test
tools/dom-stub.mjs      DOM mínimo para arrancar el bundle fuera del navegador
scripts/                build (bundler propio), lint, bump
catalog.json            lo que el script lee del repo (ver abajo)
dist/                   bundle + latest.json (se commitean: los sirve el userscript)
```

## El catálogo remoto: el repo como fuente de estabilidad

`catalog.json` se descarga desde `raw.githubusercontent.com` (TTL 6 h, cacheado en `GM_setValue`) y el script lo aplica en caliente:

- **`selectors`**: antepone candidatos nuevos a las claves del registro. Si el candidato remoto no existe en el DOM, se cae al siguiente. Es el camino rápido para arreglar un cambio de Twitch.
- **`features`**: features experimentales (solo CSS) que aparecen en el panel marcadas con `repo`.

Reglas: sube `revision` en cada cambio (el script ignora lo que no sea más nuevo), solo se aceptan selectores sin `{}`, `;`, `url(`, `javascript:`… y el CSS se limita a 20 KB sin `@import` ni `</style>`. Todo lo que no pase la validación se ignora, y si el repo no responde se sigue con lo local. Se puede desactivar entero desde *Avanzado → Catálogo remoto del repo*.

## Publicar una release

`dist/` se commitea porque es lo que sirven `@downloadURL`/`@updateURL`:

```bash
node scripts/bump.mjs minor "selectores nuevos para el chat"
node scripts/lint.mjs && node scripts/build.mjs && node --test "test/*.test.mjs"
git add package.json CHANGELOG.md dist/ && git commit -m "chore(release): v2.1.0" && git push
```

También hay un workflow *Release* en GitHub Actions que hace exactamente eso.

## Cómo contribute una feature

1. Crea `src/features/mi-feature.js` con un `defineFeature({ id, label, section, default, css, tick, onEnable, onDisable, onRoute, settings })`.
   - `css` con `%SCOPE%` se inyecta solo como `html.twpp-<id>`.
   - `interval` (ms) evita el tick en cada latido para lo caro.
   - `settings` acepta `bool`, `text`, `number` y `select`; el panel los dibuja solo.
2. Añade el `import '../features/mi-feature.js';` en `src/features/index.js`.
3. `npm run verify`.

El bundler (`scripts/build.mjs`, sin dependencias) solo entiende un subconjunto de ESM a propósito: `import { a, b as c } from './x.js'`, `export const|function|class`, `export { a }` y `export { a } from './x.js'`. Cualquier otra forma hace fallar el build, y un import que no exista en el destino también.

## Depuración

En el panel: *Avanzado → Modo depuración* pone la consola en modo verboso. *Diagnóstico* saca una tabla con el estado de cada feature, los errores acumulados y la revisión del catálogo. En la consola: `TwitchPP.diagnostics.features()`, `TwitchPP.diagnostics.errors()`, `TwitchPP.enable('chatSearch')`, `TwitchPP.disable('chatSearch')`.

## Licencia

MIT.
