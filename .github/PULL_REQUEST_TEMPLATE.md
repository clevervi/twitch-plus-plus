## Qué cambia

<!-- Una o tres frases. Si el PR toca varias features, una línea por feature. -->

Closes #

## Tipo

<!-- Marca exactamente una. La etiqueta `tipo:*` del PR debe coincidir. -->

- [ ] Corrección de error (`tipo:bug`)
- [ ] Funcionalidad nueva (`tipo:mejora`)
- [ ] Solo documentación (`tipo:docs`)
- [ ] Reestructuración interna (`tipo:refactor`)
- [ ] Rendimiento (`tipo:rendimiento`)
- [ ] Mantenimiento, CI o tooling (`tipo:chore`)
- [ ] Seguridad (`tipo:seguridad`)
- [ ] Cambio incompatible (`tipo:ruptura`)

## Archivos

| Archivo | Cambio |
|---|---|
| `src/...` | |

## Por qué

<!-- La razón, no el síntoma. Si el issue ya la explicaba, no la repitas: enlázalo. -->

## Plan de pruebas

- [ ] `npm run lint` pasa
- [ ] `npm run build` pasa y `dist/` está commiteado
- [ ] `npm test` pasa
- [ ] Probado a mano en `twitch.tv` (navegando entre canales, no solo recargando)
- [ ] `TwitchPP.diagnostics.report()` no muestra selectores rotos nuevos

## Si toca `catalog.json`

<!-- Obligatorio cuando el PR cambia selectores. -->

- [ ] He subido `revision` en la entrada modificada
- [ ] He probado el selector nuevo contra un volcado real del DOM, no de memoria
- [ ] Los selectores que dejo atrás siguen siendo necesarios (no los borro sin motivo)
- [ ] El cambio no depende de una clase con hash generado

## Notas para quien revisa

- [ ] Zonas delicadas tocadas: ciclo de vida de features, bus, almacén, listeners globales
- [ ] Conflictos con otras pestañas esperables al actualizar: no

## Lista de verificación

- [ ] El issue enlazado tiene `estado:aprobado`
- [ ] El PR tiene exactamente una etiqueta `tipo:*`
- [ ] La rama sigue el patrón `tipo/descripcion`
- [ ] Los commits usan formato convencional (`fix(area): descripción`)
- [ ] No he incluido secretos, tokens ni datos personales en el código ni en los ejemplos
