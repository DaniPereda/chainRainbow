# Implementation Plan: Ficha Negra (Limpieza de Línea)

**Branch**: `023-black-piece-line-clear` | **Date**: 2026-09-03 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/023-black-piece-line-clear/spec.md`

## Summary

Negro es un quinto color de ficha cuya interacción, tanto si es ella quien golpea (lanzada desde
la mano) como si es ella la defensora golpeada por otra ficha, nunca empuja ni divide: en su
lugar vacía toda la fila (impacto E/O) o toda la columna (impacto N/S) a la que pertenece la
casilla del impacto, incluida la propia ficha disparadora (FR-004), sin que ninguna ficha
eliminada ejecute su propio efecto (FR-005). Negro contra negro sigue siendo la aniquilación por
mismo color ya existente (FR-006), comprobada con la misma prioridad que ya tenía. Esa misma
prioridad — confirmada durante Phase 0 (research.md, Decisión 3) por ser el patrón ya
establecido en el motor — hace que negro como defensora gane también sobre la ramificación de
rojo: rojo nunca llega a dividir a una negra golpeada, la limpieza la sustituye por completo. La
solución no introduce ningún tipo de evento nuevo: cada ficha barrida produce su propio
`ANNIHILATION` (ya existente), reutilizando íntegra la maquinaria de animación en paralelo que
022-parallel-branch-animation ya construyó para "varios hermanos nacidos de la misma casilla".

## Technical Context

**Language/Version**: TypeScript (Node.js), mismo stack que el resto del motor (`src/engine/`) y
renderer (`src/renderer/`, Phaser 3).

**Primary Dependencies**: Ninguna nueva. Reutiliza `src/engine/board.ts`
(`getPieceAt`/`setPieceAt`/`isInBounds`), `src/engine/events.ts` (`AnnihilationEvent`, sin
cambios de forma), y `src/renderer/launch-animation.ts` (`computeEventParents`/`playEventLog`,
sin cambios de forma).

**Storage**: N/A.

**Testing**: Vitest — fichero nuevo dedicado `tests/unit/engine/black.test.ts` (mismo patrón que
`red.test.ts`), más los casos de precedencia rojo-contra-negro añadidos donde ya se testea esa
rama de `applyImpact` (`push.test.ts` o `red.test.ts`).

**Target Platform**: Motor headless (`src/engine/`) + integración mínima de renderer
(`src/renderer/`) para que la pieza sea observable/jugable desde `dev-levels.html`, siguiendo el
orden ya establecido por la constitución (spec → motor con tests → integración en el renderer).
El soporte en `tools/generator/` queda explícitamente fuera de alcance de esta feature — mismo
patrón secuencial que 009-red-piece (motor) → 020-generator-red-support (generador) como
features separadas.

**Performance Goals**: N/A — escanear una línea de 8 casillas es trabajo constante y
despreciable.

**Constraints**: FR-008 — ninguna regla ya existente (verde/naranja/marrón/rojo, mismo color,
wrap-around) cambia de comportamiento, salvo la única excepción documentada y justificada en
research.md Decisión 3 (rojo cede su ramificación cuando la defensora es negra, exactamente como
ya cede ante la regla de mismo color).

**Scale/Scope**: Motor (`src/engine/board.ts` para el color nuevo; `src/engine/pieces/push.ts`
para la regla de limpieza, dos puntos de comprobación) + renderer (`src/renderer/board-view.ts`
para el color visual; `src/renderer/sound-effects.ts` para un sonido propio opcional) + tests
dedicados. Sin cambios de esquema de niveles ni en `tools/generator/`.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **Principio I (motor puro, independiente de UI)**: Cumplido — la regla de limpieza vive
  enteramente dentro de `src/engine/pieces/push.ts` (`clearLine`, nueva función interna pura); el
  renderer solo consume `EventLog` (sin forma nueva, Decisión 1 de research.md) y una entrada de
  color nueva en `PIECE_COLOR`. Ninguna decisión de negocio nueva vive en `src/renderer/`.
- **Principio II (test-first)**: Cumplido — `tests/unit/engine/black.test.ts` (y los casos de
  precedencia en `push.test.ts`/`red.test.ts`) se escriben junto con la implementación, mismo
  patrón que `red.test.ts`, `brown.test.ts`, etc. Cada escenario de quickstart.md tiene su
  contraparte como test automatizado.
- **Principio III (determinismo)**: Cumplido — `clearLine` es una función pura sin `rng()`;
  recorre la línea en orden creciente de índice para que el orden de los `ANNIHILATION`
  resultantes sea siempre el mismo dado el mismo tablero/impacto (data-model.md).
- **Principio IV (niveles como datos declarativos)**: Sin impacto — el formato de nivel
  (`pieces`/`hand`/`goal`) no cambia; negro es simplemente un nuevo valor válido de `PieceColor`
  en esos mismos campos declarativos.
- **Principio V (primitivas composables, no casos especiales)**: Desviación explícita y
  justificada (research.md, Decisión 2) — "vaciar todas las casillas ocupadas de una línea
  completa" no es expresable como composición de `MOVE_STEP` + colisión + repetición +
  ramificación, igual que la ramificación de rojo tampoco lo era en su momento. La desviación se
  minimiza reutilizando la semántica de resultado YA existente (`ANNIHILATION`, Decisión 1) en
  vez de inventar un tipo de evento nuevo — lo único genuinamente nuevo es CUÁNDO se dispara y
  QUÉ casillas alcanza, no CÓMO se reporta cada desaparición individual.

**Resultado**: PASA, con una desviación justificada del Principio V (documentada arriba y en
research.md Decisión 2) — no requiere Complexity Tracking porque la propia constitución prevé
este caso explícitamente ("Una primitiva genuinamente nueva requiere justificación explícita en
el plan.md correspondiente", no que quede prohibida).

*Re-chequeo tras Phase 1*: Sin cambios — el diseño de datos (data-model.md) no introdujo ninguna
dependencia nueva ni tocó ningún principio adicional; sigue pasando por los mismos motivos.

## Project Structure

### Documentation (this feature)

```text
specs/023-black-piece-line-clear/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md         # Phase 1 output
├── quickstart.md         # Phase 1 output
└── tasks.md              # Phase 2 output (/speckit-tasks)
```

### Source Code (repository root)

```text
src/engine/
├── board.ts                # PieceColor gana 'black'
└── pieces/
    └── push.ts              # nueva función interna clearLine; applyImpact (dos puntos: rama
                              # "site.piece.color === 'black'" como atacante, y rama
                              # "defender.color === 'black'" como defensora, comprobada antes de
                              # la rama roja ya existente)

src/renderer/
├── board-view.ts            # PIECE_COLOR gana 'black'
└── sound-effects.ts         # playLineClearSound() nuevo, opcional

tests/unit/engine/
├── black.test.ts            # nuevo -- lanzamiento limpia fila/columna, negra asentada limpia al
│                             # ser golpeada, negro-contra-negro sigue siendo mismo color,
│                             # missclick
├── push.test.ts / red.test.ts  # nuevos casos: rojo golpea a una negra -- limpieza, no
│                             # ramificación (research.md Decisión 3)
└── events.test.ts           # sin cambios esperados (AnnihilationEvent no cambia de forma)
```

**Structure Decision**: Extensión in-place de `src/engine/board.ts` y
`src/engine/pieces/push.ts` (motor), más una integración mínima ya localizada en
`src/renderer/board-view.ts`/`sound-effects.ts` -- ningún fichero, módulo, ni directorio nuevo
más allá del test dedicado `black.test.ts` (mismo patrón que `red.test.ts`). Sigue el mismo
patrón que 009/016/017/019/020/021, todas ellas extendiendo estos mismos ficheros del motor sin
reestructurar el árbol.

## Complexity Tracking

> No violations requiring the table below -- la única desviación del Principio V (limpieza de
> línea como primitiva nueva) está explícitamente prevista y justificada por la propia
> constitución, no es una violación no justificada.
