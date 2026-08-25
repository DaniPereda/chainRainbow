# Implementation Plan: Fragilidad de fichas (NEW/CRACKED/BROKEN)

**Branch**: `012-piece-fragility` | **Date**: 2026-08-25 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/012-piece-fragility/spec.md`

## Summary

Cada `Piece` gana un tercer campo, `fragility: 'new' | 'cracked' | 'broken'`, junto a su `color` ya existente. Una ficha avanza un escalón de fragilidad cada vez que actúa como *defensora* de una colisión (golpeada por otra de distinto color); cuando le toca asentarse en algún punto de la cadena y su fragilidad es `'broken'`, no se coloca — desaparece ahí mismo. El enfoque técnico central es una generalización de `resolveStrike` (ya existente en `src/engine/pieces/push.ts`, corregida en la rama `012-fix-brown-cascade-loop` para vaciar orígenes de forma anticipada): en vez de recibir solo el color del golpeador, recibe la ficha completa, y la decisión de "¿se coloca aquí o no?" pasa a depender de su fragilidad además de si hubo aniquilación por mismo color. La misma generalización, aplicada un nivel más arriba en `applyImpact`, elimina por completo el caso especial histórico "la ficha lanzada nunca persiste" (spec.md 006 de la feature 008): la ficha lanzada se trata exactamente como cualquier otro eslabón de la cadena, sin código nuevo dedicado a ella. `evaluateGoal` no necesita ningún cambio: como las fichas rotas nunca llegan a colocarse, el tablero que se le pasa ya refleja todas las eliminaciones (FR-006 se cumple por construcción, no por un paso adicional).

## Technical Context

**Language/Version**: TypeScript (mismo stack que el resto del motor, sin dependencias nuevas)

**Primary Dependencies**: Ninguna nueva. Motor: cero dependencias de runtime (constitución). Renderer: Phaser 3, ya en uso.

**Storage**: N/A — los niveles siguen siendo datos declarativos en memoria/JSON (Principio IV), sin persistencia nueva.

**Testing**: Vitest, igual que el resto del motor (Principio II) — toda la lógica de fragilidad debe ser cubierta headless antes/junto con su implementación.

**Target Platform**: Sin cambios — mismo motor puro + Phaser/Capacitor.

**Project Type**: Single project (monorepo existente: `src/engine/`, `src/renderer/`, `tools/generator/`).

**Performance Goals**: N/A — la fragilidad añade, como mucho, una comparación de string y un `setPieceAt` extra por eslabón de cadena ya recorrido; no cambia la complejidad de `resolveStrike` (sigue acotado a ≤64 llamadas recursivas por lanzamiento, cota ya demostrada en `012-fix-brown-cascade-loop`).

**Constraints**: Ninguna nueva más allá de las ya vigentes (Principios I-V).

**Scale/Scope**: Sin cambio de escala — mismo tablero 8×8, mismo volumen de niveles.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **Principio I (motor puro, independiente de UI)**: PASA. Toda la lógica de fragilidad (avance de estado, eliminación al asentarse) vive en `src/engine/`; el renderer (Historia 3, FR-014) solo lee `piece.fragility` para decidir cómo dibujar, igual que ya lee `piece.color` — no decide ninguna regla.
- **Principio II (test-first)**: PASA, con una nota: esta feature modifica una primitiva ya existente (`resolveStrike`) en vez de añadir una totalmente nueva, así que el trabajo empieza por *actualizar* la suite existente (`brown.test.ts`, `red.test.ts`, `same-color.test.ts`, `chain.test.ts`, etc. — todas construyen niveles con `createLevel`, que pasará a aceptar fragilidad opcional) antes de añadir los tests nuevos específicos de fragilidad.
- **Principio III (determinismo)**: PASA. El avance de fragilidad es una función pura del historial de colisiones de ESE lanzamiento (sin aleatoriedad); dado el mismo estado inicial y la misma acción, el resultado es idéntico.
- **Principio IV (niveles como datos declarativos)**: PASA — de hecho esta feature es la razón directa por la que `PiecePlacement`/`hand` necesitan poder declarar fragilidad inicial (FR-011), sin introducir ninguna lógica imperativa nueva en la definición de niveles.
- **Principio V (primitivas composables, no casos especiales)**: PASA, y de hecho MEJORA la alineación existente: el diseño elegido generaliza el patrón ya presente en `resolveStrike` ("quien golpea se asienta donde golpeó, salvo que se aniquile") para que también cubra a la ficha lanzada desde la mano — eliminando el caso especial histórico "la ficha lanzada nunca persiste" en vez de añadir uno nuevo paralelo.
- **Workflow — cambios de semántica de resolución de cadenas**: la constitución exige documentar explícitamente, en el plan.md de la feature, cualquier cambio a la semántica de resolución de cadenas. Ver la sección "Cambio de semántica de resolución de cadenas" en `research.md` — resume qué cambia exactamente en `resolveStrike`/`applyImpact`/`resolveSplit` y por qué.

Ningún gate bloquea el avance a Phase 0. No hace falta registrar nada en Complexity Tracking.

### Re-check post-diseño (tras Phase 1)

Con `data-model.md` ya concreto, se confirma que ningún gate se ve comprometido por las decisiones de diseño reales:

- El cambio de firma de `resolveStrike`/`resolveSplit`/`resolveBranch` (recibir `Piece` en vez de `PieceColor`) es interno a `src/engine/pieces/push.ts` — no cruza el límite motor/renderer (Principio I intacto).
- `createLevel` mantiene compatibilidad hacia atrás total (ver "Compatibilidad" en `data-model.md`) — los niveles/tests existentes que no mencionan fragilidad no cambian de comportamiento, así que no hay coste de migración oculto que reabra el Principio II con trabajo no anticipado.
- Ninguna decisión introduce aleatoriedad ni estado externo — Principio III sigue intacto.
- Sigue sin haber Complexity Tracking que rellenar.

## Project Structure

### Documentation (this feature)

```text
specs/012-piece-fragility/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output (/speckit-plan command)
├── data-model.md         # Phase 1 output (/speckit-plan command)
├── quickstart.md        # Phase 1 output (/speckit-plan command)
└── tasks.md             # Phase 2 output (/speckit-tasks command - NOT created by /speckit-plan)
```

No se genera `contracts/`: esta feature no expone ninguna interfaz externa nueva (ni API, ni CLI, ni formato de archivo nuevo) — solo extiende tipos y funciones ya internas al motor, ya documentadas en `data-model.md`.

### Source Code (repository root)

```text
src/
├── engine/
│   ├── board.ts              # Piece gana el campo `fragility`
│   ├── level.ts               # createLevel: PiecePlacement y hand aceptan fragilidad inicial opcional; normaliza a "casilla vacía" las fichas de tablero declaradas BROKEN (FR-016)
│   ├── events.ts              # sin cambios de forma (ImpactSite.piece ya es un Piece completo)
│   ├── goal.ts                 # sin cambios (evaluateGoal ya es agnóstico a cualquier campo más allá de color)
│   ├── resolve-launch.ts      # sin cambios de forma (ya opera sobre Piece completos)
│   └── pieces/
│       └── push.ts            # el núcleo del cambio: resolveStrike, resolveSplit, resolveBranch, applyImpact
│
├── renderer/
│   ├── board-view.ts          # drawBoard: nueva variación visual por fragilidad, además de color (FR-014, Historia 3)
│   └── scenes/
│       └── BoardScene.ts      # sin cambios de reglas -- solo consume el board ya resuelto por el motor
│
└── (tools/generator/ y niveles ya guardados quedan fuera de alcance de esta feature -- ver spec.md, Assumptions)

tests/unit/engine/
├── brown.test.ts, red.test.ts, same-color.test.ts, chain.test.ts, ...  # se actualizan para construir niveles con fragilidad explícita donde el escenario lo requiera
├── level.test.ts (si existe) o similar                                # nuevos casos para FR-011/FR-012/FR-016
└── fragility.test.ts (nuevo)                                          # suite dedicada a FR-001..FR-010, FR-013, FR-015 -- el ciclo completo de avance/eliminación
```

**Structure Decision**: Proyecto único ya existente (motor `src/engine/` + renderer `src/renderer/` + herramienta de generación `tools/generator/`, todos en el mismo repo). Esta feature no introduce ningún directorio nuevo de primer nivel — extiende archivos ya existentes del motor y añade, como mucho, un fichero de test nuevo dedicado a fragilidad. `tools/generator/` no se toca (fuera de alcance, ver spec.md).

## Complexity Tracking

*(vacío — el Constitution Check no encontró ninguna violación que justificar)*
