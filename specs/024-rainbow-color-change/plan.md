# Implementation Plan: Ficha Arcoíris (Cambio de Color)

**Branch**: `024-rainbow-color-change` | **Date**: 2026-09-03 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/024-rainbow-color-change/spec.md`

**Note**: This template is filled in by the `/speckit-plan` command; its definition describes the execution workflow.

## Summary

Añadir 'rainbow' como sexto color de ficha. Su impacto (en cualquiera de los dos roles) no genera
ningún movimiento: en vez de eso, pausa la resolución de la cadena y devuelve al llamador
(renderer) una elección pendiente -- qué color debe adoptar la ficha defensora del impacto -- que
se resuelve llamando a una función `resume(color)` devuelta junto al resultado parcial. Es la
primera feature que necesita este mecanismo (research.md, Decisión 1): un tipo de retorno
resumible ("continuación" expresada como datos + closures, no un generador ni async) que mantiene
`resolveChain`/`resolveLaunch` 100% síncronos y puros (Principio I), sin obligar a ninguno de sus
~17 llamadores existentes a cambiar mientras no encuentren arcoíris. La prioridad frente a negro y
rojo (research.md, Decisión 3) reutiliza el patrón ya establecido en 023 sin modificarlo. Fuera de
alcance: integración en el generador de niveles (igual que negro).

## Technical Context

**Language/Version**: TypeScript (Node.js), mismo stack que el resto del motor (`src/engine/`) y
renderer (`src/renderer/`, Phaser 3).

**Primary Dependencies**: Ninguna nueva. Reutiliza `src/engine/board.ts` (`PieceColor`),
`src/engine/events.ts` (`ChainEvent`, `resolveChain`), `src/engine/pieces/push.ts` (`applyImpact`),
`src/engine/resolve-launch.ts`, `src/engine/session.ts`, `src/renderer/board-view.ts`,
`src/renderer/launch-animation.ts`, `src/renderer/sound-effects.ts`, `src/renderer/scenes/BoardScene.ts`.

**Storage**: N/A (sin persistencia; el estado vive en memoria durante una sesión de nivel).

**Testing**: Vitest, mismo patrón que el resto del motor (`tests/unit/engine/`) — nuevo archivo
`tests/unit/engine/rainbow.test.ts`, más actualizaciones mecánicas a `black.test.ts`,
`push.test.ts` y `events.test.ts` por el cambio de firma de `applyImpact`/`resolveChain`
(research.md, Decisión 1).

**Target Platform**: Igual que el resto del proyecto — web (Vite dev server) como base, empaquetado
móvil (Capacitor) más adelante.

**Project Type**: Single project (motor + renderer en el mismo repo, ya establecido).

**Performance Goals**: N/A — sin requisitos de rendimiento distintos del resto del motor (cadenas
de resolución cortas, deterministas, sin bucles de red ni E/S).

**Constraints**: El motor debe seguir siendo 100% síncrono, puro y testeable headless (Principio
I/III) incluso con esta pausa a mitad de cadena — resuelto mediante el patrón "resultado resumible"
de research.md, Decisión 1, no mediante generadores ni async/await.

**Scale/Scope**: Un color de ficha nuevo, un tipo de evento nuevo (`COLOR_CHOICE`), un cambio de
firma acotado en 3 funciones del motor (`applyImpact`, `resolveChain`, `resolveRedSplit`), un
campo opcional nuevo en `LaunchOutcome`, una función nueva en `session.ts`
(`commitLaunchOutcome`), un componente de UI nuevo en el renderer (diálogo flotante de color), un
efecto de sonido nuevo. Sin cambios en `tools/generator`.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **Principio I (motor puro, sin dependencias de UI)** — riesgo principal de esta feature: pausar
  la resolución a mitad de cadena para esperar una decisión del jugador podría tentar a acoplar el
  motor a la UI (p. ej. que el motor mismo invoque una función de renderer para pedir el color).
  Mitigado por diseño (research.md, Decisión 1): el motor nunca llama a nada de renderer: solo
  devuelve datos (`at`, `options`) más una función `resume(color)` que el LLAMADOR invoca cuando
  quiera, con el valor que decida. El motor sigue siendo 100% síncrono y headless-testeable — de
  hecho, todos los escenarios de quickstart.md se ejercitan sin ningún renderer, llamando a
  `resume(...)` directamente con un color literal. **PASA**.
- **Principio II (test-first)** — nuevo archivo `tests/unit/engine/rainbow.test.ts` cubre las 4
  historias de usuario y los edge cases de precedencia antes/junto con la implementación, mismo
  patrón que `black.test.ts`. **PASA** (verificar en tasks.md que los tests se escriben en la
  misma tarea o justo antes que cada pieza de implementación).
- **Principio III (determinismo)** — el mecanismo de pausa no introduce ninguna fuente de
  no-determinismo: `options` es una lista fija, `resume(color)` es una función pura respecto a su
  argumento y al estado capturado por clausura (el mismo tablero/cola que ya existían de forma
  determinista en el momento de la pausa). Dos ejecuciones con la misma secuencia de elecciones de
  color producen la misma cadena de eventos. **PASA**.
- **Principio IV (niveles como datos declarativos)** — sin cambios; `'rainbow'` es un valor de
  color más en el mismo esquema JSON ya existente. **PASA**.
- **Principio V (primitivas composables sobre casos especiales)** — el cambio de color NO puede
  expresarse como una composición de `MOVE_STEP`/colisión/repetición/ramificación (no hay ningún
  desplazamiento que componer): es, como negro, una primitiva nueva y deliberada, justificada aquí
  explícitamente. Adicionalmente, el propio MECANISMO de pausa/reanudación (`ImpactResolution`
  resumible) es una primitiva de CONTROL nueva, sin precedente en el motor — también justificada
  en research.md, Decisión 1: ninguna combinación de las primitivas existentes puede expresar "un
  paso de la cadena requiere una entrada externa antes de continuar". **Desviación documentada y
  justificada** — ver Complexity Tracking.

Todas las gates pasan, con una desviación de Principio V documentada y justificada (permitida
explícitamente por el propio principio: "Una primitiva genuinamente novedosa requiere
justificación explícita en el plan.md relevante").

## Project Structure

### Documentation (this feature)

```text
specs/024-rainbow-color-change/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output (/speckit-plan command)
├── data-model.md        # Phase 1 output (/speckit-plan command)
├── quickstart.md        # Phase 1 output (/speckit-plan command)
├── checklists/
│   └── requirements.md  # /speckit-specify quality gate
└── tasks.md             # Phase 2 output (/speckit-tasks command - NOT created by /speckit-plan)
```

### Source Code (repository root)

```text
src/
├── engine/
│   ├── board.ts             # PieceColor gana 'rainbow'
│   ├── events.ts            # ChainEvent gana ColorChoiceEvent; ImpactHandler/resolveChain
│   │                         # ganan el tipo resumible ImpactResolution
│   ├── resolve-launch.ts    # LaunchOutcome gana pendingColorChoice (campo opcional)
│   ├── session.ts           # nueva commitLaunchOutcome; applySessionLaunch la usa
│   └── pieces/
│       └── push.ts          # nueva rama de arcoíris en applyImpact; resolveRedSplit reenvía
│                             # el status resumible sin envolverlo
├── renderer/
│   ├── board-view.ts        # PIECE_COLOR gana 'rainbow'
│   ├── launch-animation.ts  # runEvent gana la rama COLOR_CHOICE
│   ├── sound-effects.ts     # nuevo playRainbowSound()
│   └── scenes/
│       └── BoardScene.ts    # launch() pasa a un bucle que puede pausarse; nuevo diálogo de color
└── (sin cambios en tools/generator salvo el guard defensivo de obligations.ts)

tests/unit/
├── engine/
│   ├── rainbow.test.ts      # nuevo -- las 4 historias + edge cases de precedencia
│   ├── black.test.ts        # migración mecánica: status 'resolved' en llamadas a applyImpact
│   ├── push.test.ts         # migración mecánica: status 'resolved' en applyImpact/resolveChain
│   └── events.test.ts       # migración mecánica: status 'resolved' en resolveChain
└── renderer/
    └── launch-animation.test.ts  # opcional: cobertura de la rama COLOR_CHOICE si aplica
```

**Structure Decision**: Single project ya establecido (motor headless en `src/engine/`, renderer
Phaser en `src/renderer/`, sin paquetes nuevos). Esta feature no introduce ningún directorio
nuevo, solo amplía tipos y funciones ya existentes en los archivos listados arriba, siguiendo el
mismo patrón que 023-black-piece-line-clear.

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|---------------------------------------|
| Primitiva nueva: cambio de color en vez de movimiento (Principio V) | El impacto de arcoíris no desplaza ninguna ficha -- no hay ningún `MOVE_STEP`/colisión/repetición/ramificación que componer para expresar "esta ficha pasa a tener otro color". Mismo precedente que negro (023) para su limpieza de línea. | Intentarlo como una repetición o rama de `MOVE_STEP` no tiene sentido: no existe ningún desplazamiento real que fabricar sin violar FR-007 (el impacto explícitamente no genera movimiento). |
| Primitiva de control nueva: `ImpactResolution`/`LaunchOutcome` resumibles (Principio V, y roza el Principio I) | Es la primera vez que un paso de la cadena depende de una entrada que solo el jugador puede dar, en mitad de una resolución hoy síncrona de un tirón. Ninguna primitiva existente (todas transforman el tablero de una vez, sin pausas) puede expresar "espera aquí hasta que llegue un valor externo". | Un callback síncrono no es viable (el disparo real -- un clic -- es asíncrono). Un generador es viable pero cambia la firma de `resolveLaunch` para sus ~17 llamadores existentes aunque nunca toquen arcoíris. La solución elegida (un campo `resume` opcional, ver research.md Decisión 1) logra el mismo resultado sin ese coste, y sin que el motor llame jamás a código de renderer -- el Principio I se mantiene intacto. |
