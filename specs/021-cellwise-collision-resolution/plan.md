# Implementation Plan: Resolución de Colisiones Casilla a Casilla

**Branch**: `021-cellwise-collision-resolution` | **Date**: 2026-09-02 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/021-cellwise-collision-resolution/spec.md`

## Summary

Dos trayectorias en vuelo empujadas por marrón (`PUSH_STRATEGY['brown']` = `stepUntilBlocked`)
pueden cruzar sus caminos en una casilla intermedia sin llegar a compartir nunca un destino final
-- el modelo actual calcula ese destino final de una sola vez, ciego a cualquier otra trayectoria
todavía pendiente en la cola. La corrección, verificada a mano contra el nivel 2 modificado por el
usuario (dos fichas verdes que deberían encontrarse y aniquilarse en la columna 1), no requiere
ninguna cola ni tipo nuevo: `ImpactSite` gana un campo opcional `walking?: {edgeCrossings}` que
marca un `to` como un paso TENTATIVO de 1 casilla en vez de un destino final: cuando quien empuja
es marrón, el `nextSite` se construye con `to` un paso más lejos (no el destino final completo), y
la rama `defender === null` de `applyImpact` dispensa un paso más (en vez de asentar) mientras
`walking` esté presente y no se alcance `MAX_EDGE_CROSSINGS`. La cola FIFO y `findCoincidingPair`
ya existentes (019/020) procesan estos pasos intercalados sin ningún cambio -- ya intercalaban
`ImpactSite`s salto a salto; solo cambia lo que significa "un salto" de marrón, de "toda la
caminata" a "una casilla". Verde y naranja no cambian en absoluto.

## Technical Context

**Language/Version**: TypeScript (Node.js), mismo stack que el resto del motor (`src/engine/`).

**Primary Dependencies**: Ninguna nueva -- reutiliza `src/engine/move-step.ts` (`step`,
`isInBounds`, `wrapCoordinate`, ya usados hoy dentro de `stepUntilBlocked`) y las funciones ya
existentes de `src/engine/events.ts`/`src/engine/pieces/push.ts`.

**Storage**: N/A.

**Testing**: Vitest -- mismo patrón que 016/017/019/020 (fixtures con `rng`/tableros construidos a
mano, verificados contra trazas reales antes de escribirlas como expectativa, nunca asumidas).

**Target Platform**: Motor headless (`src/engine/`), consumido tanto por el renderer como por
`tools/generator/` -- sin superficie de UI propia.

**Project Type**: Corrección de motor existente, no un proyecto ni módulo nuevo.

**Performance Goals**: N/A -- el número total de pasos por cascada sigue acotado por las mismas
garantías de terminación ya existentes (fragilidad finita por ficha, `MAX_EDGE_CROSSINGS` finito
por caminata); trocear un salto de marrón en más pasos individuales no cambia el orden de magnitud
del trabajo total, solo cuántas veces `resolveChain` itera su propio bucle ya existente.

**Constraints**: FR-004 -- cero regresión para cualquier construcción que no involucre dos
trayectorias cruzándose en una casilla vacía compartida. FR-005 -- el resultado final de marrón y
naranja debe preservarse exactamente (esta feature no cambia SUS reglas de distancia/parada, solo
CÓMO se calcula el resultado para marrón).

**Scale/Scope**: Dos ficheros de motor (`src/engine/events.ts` para el campo nuevo en
`ImpactSite`; `src/engine/pieces/push.ts` para los dos puntos de construcción de `nextSite` y la
rama `defender === null`). Sin cambios en el renderer, en `tools/generator/`, ni en el formato de
los niveles ya generados (se reverifican, no se regeneran, per spec.md Assumptions).

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **Principio I (motor puro, independiente de UI)**: Sin impacto -- el cambio vive enteramente
  dentro de `src/engine/`, y el renderer sigue leyendo únicamente `EventLog` (sin cambios de
  forma), nunca decisiones internas del motor.
- **Principio II (test-first)**: Se añaden tests para el nuevo camino ANTES/junto con la
  implementación (mismo patrón que 011/017/019/020) -- incluido el caso exacto del usuario (dos
  verdes encontrándose en la columna 1) y una batería de no-regresión sobre los casos ya cubiertos
  por la corrección anterior de `findCoincidingPair`.
- **Principio III (determinismo)**: Sin cambios -- ningún `rng()` nuevo se introduce; el nuevo
  camino es puramente determinista dado el mismo tablero/dirección, igual que `stepUntilBlocked`
  ya lo era.
- **Principio IV (niveles como datos declarativos)**: Sin cambios -- el formato de nivel no
  cambia; los 150 niveles ya generados se reverifican, no se regeneran (spec.md Assumptions).
- **Principio V (primitivas composables, no casos especiales)**: Cumplido explícitamente -- la
  solución elegida (Decisión 2 de research.md) fue preferida sobre la alternativa inicial (un tipo
  `BrownWalk` y una fase nueva en `resolveChain`) precisamente porque reutiliza la cola FIFO y
  `findCoincidingPair` ya existentes sin ningún cambio, añadiendo solo un campo opcional a
  `ImpactSite` y una rama condicional en el único lugar (`applyImpact`, `defender === null`) que
  necesita saber la diferencia entre "destino final" y "paso tentativo". `resolveRedSplit`,
  `applyMutualImpact`'s propia estructura, y `resolveChain` en sí no cambian de forma.

**Resultado**: PASA. Ninguna violación requiere la tabla de Complexity Tracking.

## Project Structure

### Documentation (this feature)

```text
specs/021-cellwise-collision-resolution/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
└── tasks.md             # Phase 2 output (/speckit-tasks)
```

### Source Code (repository root)

```text
src/engine/
├── events.ts              # ImpactSite gana `walking?: { edgeCrossings: number }`
└── pieces/
    └── push.ts             # nueva función interna stepWalking; applyImpact (dos puntos: la
                             # rama defender===null, y la construcción del nextSite marrón);
                             # applyMutualImpact/resolveMutualSide (mismo cambio, lado heredado)

tests/unit/engine/
├── events.test.ts          # sin cambios esperados (findCoincidingPair ya cubierto)
├── push.test.ts            # nuevos casos: stepWalking/paso a paso, no-regresión de marrón
│                            # asentando en su destino final de siempre
└── brown.test.ts           # reverificación de los casos ya existentes (full-lap self-collision,
                             # wrap-around) contra el nuevo camino paso a paso

tests/unit/levels/          # reverificación de prototipos 14/15 -- sin cambios de código aquí
levels/                     # reverificación de los 150 niveles ya generados -- sin regenerar
```

**Structure Decision**: Extensión in-place de `src/engine/events.ts` y
`src/engine/pieces/push.ts` -- ningún fichero, módulo, ni directorio nuevo. Sigue el mismo patrón
que 016/017/019/020, todas ellas extendiendo estos mismos dos ficheros del motor sin reestructurar
el árbol.

## Complexity Tracking

> No violations to justify -- table intentionally omitted.
