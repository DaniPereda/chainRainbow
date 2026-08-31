# Quickstart: validar fragilidad como factor de dificultad del generador

## Prerrequisitos

- Node.js + dependencias del proyecto ya instaladas (`npm install`).
- Rama `013-generator-fragility-difficulty` con la implementación completada. Esta feature es puramente headless (`tools/generator/`) -- no requiere `npm run dev` en ningún punto.

## Validación de tests y tipos

```sh
npm run typecheck
npm test
```

Qué debe cumplirse:

- **Regresión completa de `tools/generator/`**: los 130 tests ya existentes en `tests/unit/tools/generator/` siguen pasando. Los que aserten `pieces`/`hand` con igualdad estricta de forma pueden necesitar añadir `fragility: 'new'` a sus fixtures (mismo patrón mecánico ya aplicado durante 012-piece-fragility, `data-model.md` "Compatibilidad") -- ninguno debería cambiar de VALOR esperado, solo de forma.
- **Regresión estadística sin perfil** (`generateLevel: statistical regression across real seeds`, ya existente): sigue en 100% sin modificar su código -- confirma que omitir `difficultyProfile` no cambia el comportamiento actual (FR-004).
- **Suite nueva de fragilidad del generador** cubre, como mínimo, cada escenario Given/When/Then de `spec.md`:
  - Historia 1: una construcción que golpea la misma ficha de tablero dos veces se descarta (reutilizar/verificar el mismo mecanismo que ya arregló `4e90191` -- no debería hacer falta código nuevo, solo un test que lo confirme deliberadamente con `difficultyProfile` activado); una ficha golpeada una vez siempre queda en `NEW`.
  - Historia 2: con `'easy'`, todos los señuelos de tablero comparten estado, todos los señuelos de mano comparten estado, y todas las fichas lanzadas comparten estado (tres grupos, posiblemente distintos entre sí); con `'hard'`, sobre un lote grande, la proporción de niveles con más de un estado dentro de un mismo grupo es notablemente mayor que con `'easy'`; ninguna ficha de tablero golpeada por la solución varía nunca de `NEW`, para ningún perfil.
  - Historia 3: sobre un lote grande con `'hard'` y señuelos de tablero, ningún señuelo de tablero aparece nunca como `'broken'` en la salida, y el número de fichas de tablero entregadas coincide siempre con lo esperado (ninguna desaparece).
- **Reproducción con el motor real** (extensión de `validatesForward`, ya existente): para cada perfil (`easy`/`medium`/`hard`) y un lote de semillas, construir el nivel vía `createLevel({ pieces, hand, goal })` con los `pieces`/`hand` reales devueltos (ahora con `fragility` genuina, no asumida) y reproducir `solution` con `resolveLaunch` -- el resultado final debe ser `'won'` en el 100% de los niveles entregados como válidos (SC-001).

## Validación manual rápida (opcional, vía CLI)

```sh
npx tsx tools/generator/cli.ts --launches 3 --colors green,orange,brown \
  --chain-origin-probability 0.6 --defender-continuation-probability 0.5 \
  --decoys 3 --board-decoy-probability 0.3 --difficulty-profile hard --seed 7
```

Inspeccionar el JSON de salida:

1. Cada entrada de `hand` y `pieces` incluye `fragility`.
2. Las fichas de `pieces` que aparecen referenciadas por `solution` (posición de origen de cada lanzamiento) están en `'new'`.
3. Repetir con `--difficulty-profile easy` y comparar: los señuelos deberían mostrar mucha menos variedad de estados entre sí que con `hard`.

## Qué NO valida este quickstart

- Ningún cambio de motor (`src/engine/`) -- esta feature no lo toca (FR-013).
- Ningún cambio visual/renderer -- el generador es una herramienta headless; la representación visual de fragilidad ya existe desde 012-piece-fragility y no cambia aquí.
- Un parámetro numérico continuo de heterogeneidad -- explícitamente fuera de alcance (`spec.md`, Assumptions).
