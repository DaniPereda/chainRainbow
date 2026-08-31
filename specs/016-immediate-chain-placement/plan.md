# Implementation Plan: Resolución de Cadenas por Cola de Fichas en Tránsito

**Branch**: `016-immediate-chain-placement` | **Date**: 2026-08-31 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/016-immediate-chain-placement/spec.md`

## Summary

`applyImpact` (`src/engine/pieces/push.ts`) deja de resolver una cascada entera con recursión interna (`resolveStrike`/`resolveBranch`/`resolveSplit`) y pasa a resolver un único impacto por invocación, delegando la continuación de la cadena en la cola de trabajo que `resolveChain` (`src/engine/events.ts`) ya implementa desde antes de esta feature -- hoy sin usar como tal, porque `applyImpact` siempre devolvía `nextSites: []`. El hallazgo central de `research.md` es que esto es mucho más quirúrgico de lo que la investigación inicial sugería: la decisión de si una ficha se asienta o no NUNCA dependió realmente de nada más profundo en la cadena (solo de si su propio golpe inmediato fue una aniquilación), así que el cambio no altera ninguna decisión de la lógica actual -- solo el mecanismo que las ejecuta. El resultado es que cualquier consulta al tablero durante una cascada encuentra siempre una casilla vacía de verdad o una ficha real y completa, nunca un estado intermedio -- lo que corrige la auto-colisión invisible que motivó esta feature (un paseo de marrón que podía atravesar fichas de su propia cascada). La terminación de cualquier cascada no es lo que esta feature demuestra: ya está garantizada, de forma independiente, porque cada ficha golpeada se retira del tablero al ser golpeada. Las dos ramas de una división de rojo se resuelven reutilizando `resolveChain` internamente, una vez por rama, preservando exactamente la resolución secuencial ya exigida (FR-005 de 009-red-piece) sin ningún mecanismo nuevo. El generador (`tools/generator/`) no necesita cambios de código. Los 140 niveles ya generados se borran y regeneran contra el motor corregido; los dos niveles del prototipo que usan rojo (14, 15) se re-verifican, no se regeneran.

## Technical Context

**Language/Version**: TypeScript (mismo stack, sin dependencias nuevas)

**Primary Dependencies**: Ninguna nueva. Reutiliza `resolveChain`, ya existente en `src/engine/events.ts`.

**Storage**: N/A para el motor. `levels/` (140 ficheros JSON) se borra y regenera como parte de esta feature -- mismo criterio de "niveles como datos declarativos" (Principio IV) que ya regía antes.

**Testing**: Vitest, igual que el resto del motor (Principio II).

**Target Platform**: Sin cambios -- `src/engine/` sigue siendo headless, sin dependencia de renderer (Principio I).

**Project Type**: Single project (monorepo existente: `src/engine/`, `src/renderer/`, `tools/generator/`).

**Performance Goals**: N/A -- el coste computacional no cambia de orden de magnitud: la cola de `resolveChain` procesa exactamente el mismo número de impactos que antes procesaba la recursión, solo con una estructura de control distinta (iterativa en vez de recursiva). Si acaso, elimina la sobrecarga de pila de la recursión anidada.

**Constraints**: El tipo público `Board`/`Piece`/`EventLog`/`ImpactSite` NO debe cambiar de forma (FR-013) -- la lista de fichas en tránsito es un detalle interno de `push.ts`, nunca expuesto. `stepUntilBlocked`/`stepBy`/`MAX_EDGE_CROSSINGS` (`move-step.ts`) no cambian (FR-006).

**Scale/Scope**: Sin cambio de escala -- mismo tablero 8×8, mismas 4 piezas de color, misma cantidad de niveles del prototipo y del generador.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **Principio I (motor puro, independiente de UI)**: PASA. Todo el cambio vive en `src/engine/pieces/push.ts`, reutilizando `src/engine/events.ts` ya existente -- ningún cambio en `src/renderer/`.
- **Principio II (test-first)**: PASA. El trabajo empieza migrando los tests existentes de `resolveStrike`/`resolveBranch` a `applyImpact` (mecánico, mismos valores) antes de añadir la suite nueva de auto-colisión y la re-verificación de los niveles 14/15 de rojo.
- **Principio III (determinismo)**: PASA. `applyImpact` sigue siendo una función pura de `(board, site)`; `resolveChain` sigue siendo una función pura de `(board, initialSite, handler)`. Ningún nuevo origen de aleatoriedad -- de hecho esta feature no toca la generación de niveles en absoluto, solo su regeneración con el motor ya corregido, con las mismas semillas de siempre.
- **Principio IV (niveles como datos declarativos)**: PASA -- `levels/` se regenera como el mismo tipo de dato declarativo de siempre, solo con contenido corregido.
- **Principio V (primitivas composables, no casos especiales)**: PASA, y es el eje central del diseño -- rojo deja de tener su propia recursión mutua (`resolveSplit`/`resolveBranch`, funciones separadas de `resolveStrike`) y pasa a reutilizar la MISMA `applyImpact` que cualquier otro color, invocada a través de la MISMA `resolveChain` genérica, dos veces en vez de una. Un único mecanismo (`applyImpact` + `resolveChain`), reutilizado, no cuatro funciones que mantener en paralelo.
- **Workflow -- cambios de semántica de resolución de cadenas**: SÍ aplica, y este plan.md es precisamente su documentación exigida. El cambio: `applyImpact` deja de recursar internamente y delega la continuación de cada cascada en la cola de `resolveChain`; las dos ramas de rojo se resuelven reutilizando esa misma función dos veces, secuencialmente. Principio que motiva la desviación de la implementación anterior: Principio V (un único mecanismo de iteración de cadena, reutilizado, en vez de recursión ad-hoc duplicada entre el caso lineal y el caso de rojo) -- ver research.md, Decisiones 3 y 4, para el razonamiento completo y las dos alternativas descartadas antes de llegar a este diseño.

Ningún gate bloquea el avance a Phase 0. No hace falta registrar nada en Complexity Tracking.

### Re-check post-diseño (tras Phase 1)

Con `data-model.md` ya concreto, se confirma que ningún gate se ve comprometido:

- `applyImpact` sigue siendo la misma firma pública (`ImpactHandler`), sin cambios de tipo -- Principio III y el contrato con `resolveChain`/`resolveLaunch` quedan intactos.
- `resolveStrike`/`resolveBranch`/`resolveSplit` se eliminan, no se dejan como código muerto -- ninguna otra parte del árbol los importa (verificado por búsqueda: cero referencias fuera de `push.ts`), así que no hay ningún consumidor que romper.
- `move-step.ts`/`board.ts` quedan sin ningún cambio -- Principio I y el alcance de esta feature (FR-006/FR-013) se confirman de nuevo tras el diseño detallado.
- Sigue sin haber Complexity Tracking que rellenar.

## Project Structure

### Documentation (this feature)

```text
specs/016-immediate-chain-placement/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output (/speckit-plan command)
├── data-model.md        # Phase 1 output (/speckit-plan command)
├── quickstart.md        # Phase 1 output (/speckit-plan command)
└── tasks.md             # Phase 2 output (/speckit-tasks command - NOT created by /speckit-plan)
```

No se genera `contracts/`: esta feature no expone ninguna interfaz externa nueva -- `applyImpact`/`resolveChain` son funciones internas de `src/engine/`, ya documentadas en `data-model.md`.

### Source Code (repository root)

```text
src/engine/
├── pieces/
│   └── push.ts           # applyImpact reescrito; resolveStrike/resolveBranch/resolveSplit
│                            eliminados; resolveRedSplit nuevo (privado); PUSH_STRATEGY,
│                            PERPENDICULAR_DIRECTIONS, advance sin cambios
├── events.ts              # sin cambios -- resolveChain pasa de estar sin usar de facto a ser
│                            el mecanismo real de iteración (externo e interno, para rojo)
├── move-step.ts            # sin cambios (FR-006)
├── board.ts                 # sin cambios (FR-013)
└── resolve-launch.ts        # sin cambios -- sigue llamando a resolveChain(level.board,
                               initialSite, applyImpact) exactamente igual

tools/generator/            # sin cambios de código (research.md, Decisión 6)

levels/                     # 140 ficheros borrados y regenerados contra el motor corregido
                               (Historia 2) -- mismo formato, mismo volumen y distribución

src/levels/prototype-levels.ts  # sin cambios -- niveles 14/15 (rojo) se re-verifican, no se
                                   tocan (Historia 3)

tests/unit/engine/pieces/     # tests de resolveStrike/resolveBranch migrados a applyImpact;
                                 suite nueva de auto-colisión; re-verificación de niveles 14/15
```

**Structure Decision**: Proyecto único ya existente. Esta feature no añade ningún directorio nuevo -- reescribe `src/engine/pieces/push.ts` en el sitio, reutilizando `src/engine/events.ts` ya existente, y regenera `levels/` con la herramienta ya existente.

## Complexity Tracking

*(vacío -- el Constitution Check no encontró ninguna violación que justificar; el gate de "cambio de semántica de resolución de cadenas" se documenta arriba, no es una violación sino el proceso exigido para este tipo de cambio)*
