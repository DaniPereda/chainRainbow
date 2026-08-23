# Implementation Plan: La Ficha Lanzada Nunca Permanece en el Tablero

**Branch**: `006-launched-piece-consumed` | **Date**: 2026-08-23 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/006-launched-piece-consumed/spec.md`

**Note**: This template is filled in by the `/speckit-plan` command; its definition describes the execution workflow.

## Summary

Corrección de un error de concepto detectado al jugar el prototipo de Fase 2: `applyImpact`
(`src/engine/pieces/push.ts`) coloca hoy la ficha originalmente lanzada en `site.to` siempre que
su propio primer impacto no fue una aniquilación — aunque esa ficha desencadenara una cascada
que termina en una aniquilación un eslabón más adelante. El axioma del diseño ("el jugador
introduce un agente que provoca una interacción") implica que esa ficha nunca debe persistir en
el tablero, sea cual sea el resultado. El arreglo es quirúrgico: `applyImpact` deja de colocar
`site.piece`; el resto de la resolución de cadena (qué distancia empuja cada ficha, wrap-around,
mismo color, cascadas entre fichas ya colocadas) no cambia una sola línea. El resultado es
además una simplificación — `applyImpact` ya no necesita ramificar sobre `result.annihilated`.

## Technical Context

**Language/Version**: TypeScript, sin cambios respecto al resto del motor.

**Primary Dependencies**: Ninguna nueva.

**Storage**: N/A.

**Testing**: Vitest. Se actualizan (no se añaden reglas nuevas) las suites existentes que
asumían la colocación de la ficha lanzada: `orange.test.ts`, `same-color.test.ts`,
`wrap-around.test.ts`, y el fixture `testLevelSameColorCascade01`
(`src/engine/level.ts`) que ese último test consume. `chain.test.ts`, `launch.test.ts`,
`determinism.test.ts`, `objective.test.ts`, `move-step.test.ts` y `session.test.ts` no dependen
de dónde se asienta la ficha lanzada — se verifican para confirmar que siguen en verde sin
tocarlos.

**Target Platform**: N/A — cambio interno del motor headless; el renderer de Fase 2 ya lee el
tablero final tal cual sin ninguna suposición propia, así que no necesita ningún cambio.

**Project Type**: Proyecto único ya existente.

**Performance Goals**: N/A.

**Constraints**: FR-005 — ninguna otra regla de resolución de cadena puede cambiar como
consecuencia de este arreglo (distancias, wrap-around, orden, regla de mismo color).

**Scale/Scope**: Un cambio quirúrgico en una función (`applyImpact`), más la actualización de 3
suites de test existentes, 1 fixture del motor, y 2 de los 10 niveles del prototipo de Fase 2
(`src/levels/prototype-levels.ts`, niveles 3 y 7) cuyo objetivo dependía del comportamiento
incorrecto.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principio / Requisito | Evaluación |
|---|---|
| I. Pure, UI-Independent Simulation Core | PASS — el cambio vive enteramente dentro de `src/engine/pieces/push.ts`; el renderer no necesita ningún cambio porque ya consume el tablero final sin suposiciones propias. |
| II. Test-First Engine Logic | PASS — esto es exactamente una "regla de interacción" (colisión) en el sentido del Principio II. Las suites existentes se actualizan ANTES de tocar `push.ts` (rojo), y deben pasar después (verde), siguiendo el mismo orden que toda feature anterior. |
| III. Determinism & Reproducibility | PASS, sin cambios — el resultado sigue siendo una función pura del nivel y el lanzamiento. |
| IV. Levels as Declarative Data | PASS — los niveles que se rediseñan (el fixture del motor y los niveles 3/7 del prototipo) se siguen expresando con el mismo builder declarativo (`createLevel`), sin lógica imperativa nueva. |
| V. Composable Primitives Over Special-Casing | PASS, y este cambio en concreto MEJORA la adherencia al principio: `applyImpact` pierde una ramificación especial (`if (result.annihilated) ... else ...`) que ya no hace falta — colocar o no colocar la ficha lanzada deja de depender de ese flag en absoluto. |
| Development Workflow (constitución): cambios de semántica de resolución de cadena deben documentarse en plan.md | Esto es precisamente lo que hace este documento. |

Sin violaciones — Complexity Tracking queda vacío.

## Project Structure

### Documentation (this feature)

```text
specs/006-launched-piece-consumed/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output (/speckit-plan command)
├── data-model.md         # Phase 1 output -- no hay entidades nuevas, documenta el porqué
├── quickstart.md         # Phase 1 output (/speckit-plan command)
└── tasks.md              # Phase 2 output (/speckit-tasks command - NOT created by /speckit-plan)
```

No hay `contracts/`: esta feature no expone ninguna interfaz nueva ni cambia la firma pública de
`resolveLaunch`/`LaunchOutcome` — solo corrige qué contenido devuelven para el mismo input.

### Source Code (repository root)

```text
src/
├── engine/
│   ├── pieces/
│   │   └── push.ts              # MODIFICA applyImpact: deja de colocar site.piece; ya no
│   │                              necesita ramificar sobre result.annihilated
│   └── level.ts                   # REDISEÑA testLevelSameColorCascade01 -- su objetivo
│                                    dependía de que la ficha lanzada se asentara
└── levels/
    └── prototype-levels.ts          # REDISEÑA los niveles 3 y 7 (mismo motivo)

tests/
└── unit/
    └── engine/
        ├── orange.test.ts            # ACTUALIZA 2 aserciones sobre dónde se asienta el
        │                               lanzador (ya no se asienta)
        ├── same-color.test.ts         # ACTUALIZA el test de cascada -- nuevo resultado
        │                               esperado tras rediseñar testLevelSameColorCascade01
        └── wrap-around.test.ts        # ACTUALIZA 1 aserción (revierte a null, pero ahora por
                                         el motivo correcto, no el error de mi sesión anterior)
```

**Structure Decision**: Proyecto único ya existente, sin cambios estructurales. Un único fichero
de producción cambia de comportamiento (`push.ts`); el resto son actualizaciones de tests y
niveles para reflejar la regla corregida, no cambios de arquitectura.

## Complexity Tracking

*Sin violaciones — el Constitution Check no encontró ninguna, así que esta sección queda vacía.*
