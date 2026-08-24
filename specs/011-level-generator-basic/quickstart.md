# Quickstart: Generador de Niveles por Construcción Inversa (verde/naranja/marrón)

## Validación headless — automatizada

```bash
npm test
npm run typecheck
npm run build
```

**Resultado esperado**: `tests/unit/tools/generator/*.test.ts` (nuevos) pasan junto al resto de
la suite, sin tocar ningún test existente. `npm run typecheck` cubre `tools/` (tras añadirlo al
`include` de `tsconfig.json`). `npm run build` sigue construyendo únicamente el cliente Vite —
confirma que `tools/` no se coló en el bundle (ver comprobación de frontera más abajo).

## Ejecutar el generador manualmente

```bash
npx tsx tools/generator/cli.ts \
  --launches 1 \
  --colors green,orange \
  --seed 12345 \
  --chain-origin-probability 0.5 \
  --decoys 0
```

**Resultado esperado**: imprime en `stdout` un JSON con la forma de `GeneratedLevel`
(data-model.md) — `pieces`, `hand`, `goal`, `solution`, `params`. Ejecutarlo dos veces con la
misma semilla y los mismos parámetros produce exactamente el mismo JSON (FR-009).

## Verificar un nivel generado con el visor ya existente

El JSON de salida usa la misma forma que ya consume `createLevel()` y que ya carga la "Consola de
Cadenas" (artefacto de la sesión de diseño) — pegar `pieces`/`hand`/`goal`/`solution` ahí permite
ver la traza paso a paso exactamente igual que con los niveles del prototipo, sin ningún cambio
en el propio visor todavía (carga por ID queda para trabajo futuro, ver
`documentation/level-generator-design.md` sección 10).

## Criterio de "hecho" para esta feature

- [ ] Las 3 fixtures de data-model.md pasan en `tests/unit/tools/generator/`.
- [ ] `rng.test.ts` confirma que la misma semilla produce siempre la misma secuencia.
- [ ] Un nivel generado con `launches:1` y cualquier subconjunto de verde/naranja/marrón, al
      reproducir su `solution` con `resolveLaunch` del motor real, siempre resulta en
      `result:'won'` — probado con al menos 50 semillas distintas generadas aleatoriamente
      (regresión estadística, no solo las 3 fixtures fijas).
- [ ] Pedir `launches:0` es rechazado como entrada inválida (edge case de spec.md), no tratado
      como un nivel trivial.
- [ ] Agotar `maxGenerationAttempts` sin éxito devuelve `{ok:false, attemptsUsed}` en vez de
      lanzar una excepción o devolver un nivel a medio construir.
- [ ] `npm run build` sigue sin incluir nada de `tools/` en el bundle — comprobado con un `grep`
      de `src/renderer/` buscando cualquier import hacia `tools/` (debe devolver cero
      resultados), igual que el chequeo motor↔renderer ya establecido.
