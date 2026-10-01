# Twitch++

Userscript de Tampermonkey para limpiar Twitch: tema OLED, sidebar compacta, chat con buscador y resaltados, analítica de viewers, auto-Channel Points y pausa de chat.

La diferencia con un userscript de un solo archivo: **el código vive en este repo** (módulos, tests, CI) y el script se **construye y se actualiza solo**. Además, el repo publica un *catálogo* de selectores y features experimentales que el script recoge por red: cuando Twitch cambia el DOM, se arregla desde aquí sin obligar a reinstalar nada.

```
npm run verify     # lint + idioma + build + tests (sin dependencias, sin npm install)
npm run build      # genera dist/twitch-plus-plus.user.js y dist/latest.json
npm run watch      # reconstruye al guardar
npm test           # 143 tests unitarios
npm run test:browser   # 15 tests en Chromium real (necesita npm install)
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

Atajos por defecto: `Alt+Shift+T` abre el panel, `Alt+Shift+P` pausa el chat, `Alt+Shift+X` desactiva todo (válvula de escape).

## Compatibilidad

Solo hay un punto de contacto con las APIs de gestor de scripts: `src/core/gm.js`. Ningún otro módulo las toca directamente.

| Gestor | `@grant` síncronos | `GM_xmlhttpRequest` | Estado |
|---|---|---|---|
| Tampermonkey | sí | sí | probado a diario |
| Violentmonkey | sí | sí | debería funcionar; sin verificar |
| Greasemonkey | sí | sí | debería funcionar; sin verificar |
| ScriptCat | sí | sí | debería funcionar; sin verificar |
| Sin gestor (abrir el `.user.js` en la página) | no, usa `localStorage` | no, usa `fetch` | funciona; la configuración no se comparte entre navegadores |

Las APIs que el script declara son `GM_getValue`, `GM_setValue`, `GM_deleteValue`, `GM_addValueChangeListener`, `GM_xmlhttpRequest`, `GM_openInTab` y `GM_info`.

Para saber qué falta en tu caso, el panel lo dice:

```js
TwitchPP.diagnostics.apis()
// { gestor: 'Tampermonkey', ausentes: [] }

TwitchPP.diagnostics.report()   // incluye la línea "APIs ausentes: ..."
```

Una API ausente no rompe el script: `gm.js` cae a `localStorage` o a `fetch`. Pero si `GM_deleteValue` falta, **restablecer la configuración no hace nada**, porque el valor sigue guardado en el gestor y `localStorage` no lo ve. Si te pasa eso, es un `@grant` que no llegó.

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
test/                   93 tests con node:test
tools/check-language.mjs vigila que la documentación no mezcla idiomas
tools/dom-stub.mjs      DOM mínimo para arrancar el bundle fuera del navegador
scripts/                build (bundler propio), lint, bump, validate-pr, release-notes
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
# Las notas van en un archivo, no en la línea de comandos. En Windows, el texto
# con acentos que pasa por los argumentos llega estropeado al proceso.
cat > notas.md <<'EOF'
- **Botón flotante**: la regla base era `opacity: 0` y `pointer-events: none`.
- **La sonda**: ahora restaura la configuración en un `finally`.
EOF

npm run verify                  # antes de nada
node scripts/bump.mjs patch @notas.md
node scripts/build.mjs

git checkout -b chore/release-2.3.0
git add package.json CHANGELOG.md dist/
git commit -m "chore(release): v2.3.0"
git push -u origin chore/release-2.3.0
gh pr create --fill
```

Las notas también se pueden pasar en la línea de comandos (`node scripts/bump.mjs patch "texto"`), y en Linux o macOS no hay problema. En Windows, usa el archivo: es la diferencia entre `«¿Sí?»` y `Â¿Si?`. Si el texto es castellano y no tiene ni un acento, `bump.mjs` avisa por si acaso.

El release entra por pull request como cualquier otro cambio, y lo hace a propósito: `main` exige la comprobación `verify`, que GitHub no ejecuta en eventos disparados por `GITHUB_TOKEN`. Un workflow que abriera su propio PR se quedaría bloqueado para siempre.

Cuando el PR está mergeado, `dist/` en `main` es la versión que descarga `@updateURL`. Para crear la etiqueta y la release de GitHub, lanza el workflow *Publish Release* desde la pestaña de Actions (con *dry-run* para ver las notas sin publicar). Lee el apartado del `CHANGELOG.md` de esa versión, así que no hay que escribir las notas dos veces:

```bash
node scripts/release-notes.mjs          # revisa en local lo que se publicaría
```

### Instalar una versión concreta

Cada release lleva el bundle como archivo adjunto. Para quedarte en una versión fija, usa la ruta de la release en lugar de la de `main`:

```
https://github.com/clevervi/twitch-plus-plus/releases/download/v2.2.10/twitch-plus-plus.user.js
```

El nombre del archivo es el mismo en todas las releases; lo que cambia es la versión de la ruta.

### Volver a una versión anterior

Copia la anterior sobre la instalada y guarda. La configuración no se toca al instalar: `src/core/store.js` migra el esquema por versión, así que **bajar de versión puede dejar claves huérfanas**, que se ignoran sin más. Si quieres el punto de partida limpio, usa *Avanzado → Restablecer configuración* después de instalar la versión antigua.

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

## Tests en un navegador de verdad

`tools/dom-stub.mjs` es un DOM de mentira: sabe clases, atributos e `id`, pero **no sabe estilos, ni medidas, ni `pointer-events`, ni nada de layout**. Por eso hay una suite aparte con Chromium.

```bash
npm install && npx playwright install chromium
npm run test:browser
```

Qué comprueba y por qué no lo hace `npm run test`:

- Que el botón flotante tiene tamaño real, no está en `display: none` ni `visibility: hidden`, tiene opacidad suficiente y **acepta el clic**. Se lee el estilo **computado**, no la cadena CSS.
- Que un clic en el botón abre el panel.
- Que los selectores clave resuelven contra una página con la estructura de Twitch.

Es exactamente el agujero por el que se coló el bug del botón invisible durante semanas: la cadena CSS era correcta y aun así no se veía. Un DOM de mentira no lo detecta; un navegador sí.

**La suite no prueba Twitch real.** Es una SPA detrás de login que cambia sin avisar. La fixture `test/browser/fixtures/twitch.html` imita la estructura mínima, y el navegador navega a `twitch.tv` con todo el tráfico servido desde la fixture, para que la comprobación de dominio del script (`app.js`) pase **sin relajarla**.

Va en un job de CI aparte porque descargar Chromium pesa. `npm run verify` sigue funcionando sin `npm install`, que es lo que hace que trabajar en el repo sea rápido.

## Depuración

En el panel: *Avanzado → Modo depuración* pone la consola en modo verboso. *Diagnóstico* saca una tabla con el estado de cada feature, los errores acumulados y la revisión del catálogo. En la consola: `TwitchPP.diagnostics.features()`, `TwitchPP.diagnostics.errors()`, `TwitchPP.enable('chatSearch')`, `TwitchPP.disable('chatSearch')`.

## Licencia

MIT.
