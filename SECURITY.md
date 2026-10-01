# Política de seguridad

## Qué cuenta como vulnerabilidad aquí

Twitch++ es un userscript: se ejecuta en tu navegador, con tu sesión, sobre el DOM de un tercero. Por eso el baremo es concreto.

**Sí son vulnerabilidades:**

- Ejecución de código remoto: cargar y evaluar JavaScript que venga de `catalog.json`, de un canal de actualización o de cualquier otra fuente.
- Robo de sesión: cualquier ruta que exponga la cookie de `twitch.tv` o el token de la API a un tercero.
- Lectura de datos que no le corresponden a la feature. Por ejemplo, que el buscador de chat envíe el historial a un servidor.
- Escape del shadow DOM por un valor no escapado, cuando ese valor procede de Twitch o de la configuración del usuario y termina ejecutándose en el contexto de la página.
- Permisos de `GM_*` más amplios que los que el script declara.

**No son vulnerabilidades:**

- Selectores que dejan de resolver porque Twitch cambió su DOM. Es el comportamiento esperado de un userscript, y para eso existe `catalog.json`.
- Un fallo que solo afecta a quien lo reporta y que se puede reproducir con su configuración modificada a mano.
- El uso de datos públicos del propio usuario para una feature que lo pide. La analítica de viewers, por ejemplo, solo lee lo que Twitch ya muestra.

## Cómo reportar

Escribe al autor por privado. **No abras un issue público hasta que se haya confirmado y corregido.**

Si prefieres usar la API de avisos de seguridad de GitHub:

```bash
gh api -X POST repos/clevervi/twitch-plus-plus/security-advisories \
  -f title="Resumen en una frase" \
  -f summary="Qué ocurre y por qué importa" \
  -f description="Pasos para reproducir, impacto y versión afectada"
```

Incluye, si puedes:

- Versión de Twitch++ y del gestor de scripts.
- Pasos para reproducir.
- Qué se ve afectado y cuál es el impacto para el usuario.
- Si ya lo reportaste en otro sitio, el enlace.

## Qué pasa después

1. Confirmamos la recepción en un plazo razonable y te decimos si lo vamos a mirar.
2. Reproducimos. Si no lo reproducimos, te lo decimos y cerramos con el motivo.
3. Corrección en rama, con test, y publicada en un release.
4. Mención en el CHANGELOG o en los créditos del reporte, como prefieras.

## Alcance

Este script no tiene servidor propio: el único origen de código remoto es `catalog.json` y el bundle publicado en `dist/`. Cualquier otro vector de ataque que incluya a un tercero (una extensión del navegador, un proxy, otro userscript) queda fuera del alcance de este repositorio, aunque el síntoma se vea aquí.
