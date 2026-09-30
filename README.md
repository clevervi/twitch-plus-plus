# Twitch++

Userscript de Tampermonkey para limpiar Twitch: tema OLED, sidebar compacta, chat con buscador y resaltados, analítica de viewers, auto-Channel Points y pausa de chat.

La diferencia con un userscript de un solo archivo: **el código vive en este repo** (módulos, tests, CI) y el script se **construye y se actualiza solo**. Además, el repo publica un *catálogo* de selectores y features experimentales que el script recoge por red: cuando Twitch cambia el DOM, se arregla desde aquí sin obligar a reinstalar nada.

```
npm run verify     # lint + build + tests (sin dependencias, sin npm install)
npm run build      # genera dist/twitch-plus-plus.user.js y dist/latest.json
npm run watch      # reconstruye al guardar
```

## Instalación

1. **Instalación directa con un clic (Tampermonkey)**:
   - Abre este enlace en tu navegador (con Tampermonkey instalado):
     **[Instalar Twitch++](https://raw.githubusercontent.com/clevervi/twitch-plus-plus/main/dist/twitch-plus-plus.user.js)**
   - Tampermonkey detectará automáticamente el script y te mostrará el botón **Instalar** (o **Actualizar**).

2. **O instalación manual**:
   - En Tampermonkey → *Crear nuevo script* (+).
   - Borra la plantilla y pega el contenido completo de [`dist/twitch-plus-plus.user.js`](https://raw.githubusercontent.com/clevervi/twitch-plus-plus/main/dist/twitch-plus-plus.user.js).
   - Guarda con `Ctrl+S`.

3. Las futuras actualizaciones se descargarán automáticamente gracias a `@updateURL`.

Atajos por defecto: `Alt+O` abre el panel, `Alt+P` pausa el chat, `Alt+Shift+X` desactiva todo (válvula de escape).

## Cuando Twitch cambia el DOM: la sonda

`probe.html` es la herramienta para eso. Ábrelo (doble clic, o sírvelo con cualquier servidor estático) y:

1. En twitch.tv, consola → `copy(document.documentElement.outerHTML)`.
2. Pega el volcado en la sonda y pulsa **Cargar snapshot y analizar**.
3. El script se ejecuta dentro de un iframe aislado contra ese HTML y te dice, sin tocar tu navegador:
   - qué features lanzan errores,
   - qué claves de selector **dejan de resolver** y cuál de sus candidatos es el que aún funciona,
   - un informe de texto para pegar en un issue.

Con esa lista el arreglo es mecánico: se corrige (o se añade) el selector en `catalog.json` subiendo `revision`, y los usuarios lo recogen sin reinstalar.

Lo mismo, en vivo, desde la consola de Twitch:

```js
TwitchPP.diagnostics.report()      // texto para un issue
TwitchPP.diagnostics.broken()      // selectores que no resuelven ahora mismo
TwitchPP.diagnostics.probe()       // fuerza todas las features y restaura la config
TwitchPP.diagnostics.selectors()   // tabla completa: clave → selector que funciona
```

## Estructura

```
src/
  index.js              punto de entrada (solo arranca y expone TwitchPP)
  app.js                orden de arranque y tareas de red
  core/
    registry.js         defineFeature + ciclo de vida + circuit breaker + when()
    selectors.js        registro de selectores con candidatos, fallback y salud
    store.js            config tipada (declare/get/set + import/export)
    migrations.js       un paso por versión de config
    probe.js            fuerza todas las features y devuelve qué funciona
    report.js           informe de texto para issues
    scheduler.js        latido único, evento + intervalo, se para en segundo plano
    router.js           navegación SPA de Twitch
    styles.js           CSS consolidado con scope por feature
    catalog.js          catálogo remoto (selectores + features del repo)
    updater.js          comprobación de versión contra dist/latest.json
    keybinds.js         atajos con validación
    twitch.js           helpers de Twitch (canal, tema, miniaturas, viewers, chat)
    gm.js               adaptador GM_* con fallback a localStorage
    dom.js, log.js, bus.js, toast.js, version.js
  features/             una feature por archivo
  ui/panel.js           panel en shadow DOM (filas, ajustes, presets)
  ui/presets.js         minimal / balanced / agresivo
test/                   52 tests con node:test
tools/dom-stub.mjs      DOM mínimo para arrancar el bundle fuera del navegador
scripts/                build (bundler propio), lint, bump
catalog.json            lo que el script lee del repo (ver abajo)
probe.html              sonda: pega un volcado del DOM y comprueba qué funciona
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

1. Crea `src/features/mi-feature.js` con un `defineFeature({ id, label, section, default, css, tick, onEnable, onDisable, onRoute, settings, when })`.
   - `css` con `%SCOPE%` se inyecta solo como `html.twpp-<id>`.
   - `interval` (ms) evita el tick en cada latido para lo caro.
   - `when()` la deja inactiva bajo una condición (p.ej. OLED solo con el tema oscuro) sin tocar la config del usuario; si la condición cambia, se reaplica sola.
   - `settings` acepta `bool`, `text`, `number` y `select`; el panel los dibuja solo.
2. Añade el `import '../features/mi-feature.js';` en `src/features/index.js`.
3. `npm run verify`.

Si tu feature depende del DOM, añade su clave al registro de `src/core/selectors.js`: así `probe.html` te avisa cuando Twitch la rompa.

El bundler (`scripts/build.mjs`, sin dependencias) solo entiende un subconjunto de ESM a propósito: `import { a, b as c } from './x.js'`, `export const|function|class`, `export { a }` y `export { a } from './x.js'`. Cualquier otra forma hace fallar el build, y un import que no exista en el destino también.

## Depuración

En el panel: *Avanzado → Modo depuración* pone la consola en modo verboso. *Diagnóstico* saca una tabla con el estado de cada feature, los errores acumulados y la revisión del catálogo. En la consola: `TwitchPP.diagnostics.features()`, `TwitchPP.diagnostics.errors()`, `TwitchPP.enable('chatSearch')`, `TwitchPP.disable('chatSearch')`.

## Licencia

MIT.
