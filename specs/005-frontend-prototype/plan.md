# Implementation Plan: Prototipo Frontend de Niveles

**Branch**: `005-frontend-prototype` | **Date**: 2026-08-23 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/005-frontend-prototype/spec.md`

**Note**: This template is filled in by the `/speckit-plan` command; its definition describes the execution workflow.

## Summary

Un prototipo jugable de Fase 2 (constitución v1.1.0): pantalla de inicio → selector de 10
niveles hardcodeados → tablero renderizado con Phaser 3 → el jugador lanza una ficha (elige un
punto de entrada en el borde del tablero, que codifica dirección+carril) → el motor de
simulación ya existente resuelve la cadena → el tablero se actualiza al estado final (sin
animación paso a paso) → ventana de éxito/fallo con opciones de reiniciar o volver al selector.
Enfoque técnico: todo lo que es lógica/estado (las 10 definiciones de nivel y el seguimiento de
una partida en curso) se implementa como código puro dentro de `src/engine/`, headless y
testeable con Vitest; Phaser solo consume ese estado y traduce input táctil/de ratón a
llamadas — nunca decide reglas de juego (Principio I).

## Technical Context

**Language/Version**: TypeScript (^7.0.2 ya instalado), Node.js 20+ LTS — mismo que el motor.

**Primary Dependencies**: Phaser 3 (renderer, nuevo), Vite (dev server/build, nuevo). El motor
sigue sin dependencias de runtime.

**Storage**: N/A — sin persistencia entre sesiones ni entre niveles (spec.md, Assumptions).

**Testing**: Vitest, igual que el motor. La lógica pura nueva (las 10 definiciones de nivel y el
seguimiento de una partida en curso) SÍ se testea con Vitest. Las escenas de Phaser en sí
(visuales, input táctil) NO requieren tests automatizados para este prototipo — la constitución
lo permite explícitamente ("Rendering/integration testing tools MAY be added later... but are
not required for the initial prototype"); se validan manualmente vía quickstart.md.

**Target Platform**: Navegador (build web servido por Vite). El empaquetado móvil con Capacitor
que la constitución define como stack de destino para release queda fuera de esta feature — la
propia constitución permite que "the web build... MUST remain runnable directly in a browser to
keep iteration fast during prototyping", que es exactamente el modo de esta Fase 2.

**Project Type**: Aplicación web de un único proyecto (juego de tablero en Canvas vía Phaser 3),
sin backend.

**Performance Goals**: Sin objetivos numéricos específicos — un tablero estático 8×8 sin
animación continua no tiene riesgo de rendimiento apreciable en ningún navegador moderno.

**Constraints**: Ninguna ficha/regla nueva del motor (marrón, rojo quedan en Fase 3, ver
constitución); sin animación paso a paso de la cadena (spec.md, Assumptions); sin persistencia.

**Scale/Scope**: 10 niveles fijos, un único jugador, sin cuentas ni concurrencia.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principio / Requisito | Evaluación |
|---|---|
| I. Pure, UI-Independent Simulation Core | PASS. Toda la lógica nueva de estado (10 niveles, seguimiento de partida) vive en `src/engine/`, headless, sin importar Phaser/DOM. `src/renderer/` (Phaser) solo lee ese estado y traduce input a llamadas — nunca decide un resultado. |
| II. Test-First Engine Logic | PASS con alcance ajustado: esta feature no añade piezas/reglas nuevas al motor de colisión, así que no hay reglas nuevas que testear ahí. La lógica nueva que SÍ es "engine logic" en sentido amplio (niveles, sesión de partida) lleva tests Vitest antes/junto a su implementación. Las escenas Phaser quedan cubiertas por la validación manual de quickstart.md, tal como la constitución permite para el prototipo inicial. |
| III. Determinism & Reproducibility | PASS. Los 10 niveles son datos estáticos; ningún elemento de la sesión de partida introduce aleatoriedad. |
| IV. Levels as Declarative Data | PASS — y motiva una revisión de nombres: el builder existente se llama `createTestLevel`, pensado originalmente solo para fixtures de test. Los 10 niveles de este prototipo son contenido real del juego, no fixtures — se renombra a `createLevel` (ver data-model.md) para que el nombre no mienta sobre su uso; el comportamiento no cambia. |
| V. Composable Primitives Over Special-Casing | N/A — no se introduce ningún comportamiento de ficha nuevo. |
| Tech Stack: Simulation core sin deps de runtime | PASS, sin cambios. |
| Tech Stack: Phaser 3 solo como capa de presentación | PASS por diseño (ver Principio I). |
| Tech Stack: Capacitor para empaquetado móvil | Deferred, no violación — ver Target Platform arriba. |
| Tech Stack: Vite | PASS — se introduce en esta feature, como manda la constitución. |
| Tech Stack: Vitest | PASS, sin cambios de herramienta. |

Sin violaciones — Complexity Tracking queda vacío.

*Re-chequeado tras el diseño de Fase 1 (research.md, data-model.md, contracts/): las decisiones
tomadas ahí (renombrado `createLevel`, `session.ts` dentro de `engine/`, el contrato explícito
de límite engine↔renderer) no introducen ninguna violación nueva — la tabla de arriba ya las
refleja.*

## Project Structure

### Documentation (this feature)

```text
specs/005-frontend-prototype/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output (/speckit-plan command)
├── data-model.md        # Phase 1 output (/speckit-plan command)
├── quickstart.md        # Phase 1 output (/speckit-plan command)
├── contracts/           # Phase 1 output (/speckit-plan command)
└── tasks.md             # Phase 2 output (/speckit-tasks command - NOT created by /speckit-plan)
```

### Source Code (repository root)

```text
src/
├── engine/
│   ├── ...                    # sin cambios de comportamiento
│   ├── level.ts                 # RENOMBRA createTestLevel -> createLevel (ver data-model.md)
│   ├── index.ts                  # re-exporta createLevel y el nuevo session.ts
│   └── session.ts                 # NUEVO — LevelSession: startSession/applySessionLaunch/
│                                    restartSession. Puro, headless, sin Phaser.
├── levels/
│   └── prototype-levels.ts         # NUEVO — los 10 niveles hardcodeados de esta feature,
│                                    construidos con createLevel
└── renderer/
    ├── main.ts                      # NUEVO — bootstrap de Phaser (entry point de Vite)
    ├── scenes/
    │   ├── StartScene.ts             # NUEVO — pantalla de inicio
    │   ├── LevelSelectScene.ts       # NUEVO — selector 1-10
    │   ├── BoardScene.ts             # NUEVO — tablero + lanzamiento + ventana éxito/fallo
    │   └── ...
    └── board-view.ts                  # NUEVO — traduce Board/Piece (motor) a gráficos Phaser

tests/
└── unit/
    ├── engine/
    │   └── session.test.ts        # NUEVO — cubre US2/US3 (lanzar, ganar, perder, reiniciar)
    └── levels/
        └── prototype-levels.test.ts   # NUEVO — valida que los 10 niveles son datos correctos

index.html                # NUEVO — entry HTML de Vite
vite.config.ts             # NUEVO — dev server/build
```

**Structure Decision**: Proyecto único ya existente, sin separar frontend/backend (no hay
backend). Se añaden dos paquetes nuevos junto a `engine/`: `levels/` (datos declarativos de los
10 niveles del prototipo) y `renderer/` (Phaser 3, presentación pura). `session.ts` vive DENTRO
de `engine/` — pese a ser código nuevo de esta feature, es lógica pura y headless (secuencia
lanzamientos sobre un nivel y rastrea si terminó en éxito/fallo), por lo que pertenece al mismo
lado del límite que `resolveLaunch` (Principio I), no al lado de Phaser.

## Complexity Tracking

*Sin violaciones — el Constitution Check no encontró ninguna, así que esta sección queda vacía.*
