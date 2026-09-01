# Implementation Plan: Animación de Movimientos de Ficha Durante un Lanzamiento

**Branch**: `018-piece-movement-animation` | **Date**: 2026-09-01 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/018-piece-movement-animation/spec.md`

## Summary

`BoardScene.launch()` (`src/renderer/scenes/BoardScene.ts`) hoy llama a `applySessionLaunch`, se queda solo con `session` y descarta `outcome.events` por completo, luego llama a `redraw()` -- que le pide a `drawBoard` (`board-view.ts`) que limpie un único `Phaser.GameObjects.Graphics` y vuelva a dibujar TODAS las fichas del estado final desde cero. No hay ningún `GameObject` persistente por ficha, así que hoy no hay nada que animar con `this.tweens`. Esta feature: (1) deja de descartar `outcome.events`; (2) reproduce esa lista en orden, un evento a la vez -- cada `MOVE_STEP` como una ficha temporal (un `Phaser.GameObjects.Arc`, con el mismo color/grieta que ya dibuja `drawPieceFragility`) que se interpola (tween lineal) de la casilla `from` a la `to`, y cada `ANNIHILATION` como un fundido/escala a cero antes de destruir esa ficha temporal; (3) mantiene, en paralelo, una copia mutable del tablero que se actualiza exactamente igual que el motor lo haría (reproduciendo los mismos eventos: reubicar en `MOVE_STEP` salvo que la ficha llegue `broken`, vaciar la casilla en `ANNIHILATION`) y usa esa copia para redibujar la capa estática (`drawBoard`) entre un evento y el siguiente, así el tablero de fondo nunca muestra ni una ficha duplicada ni una desaparecida antes de tiempo; (4) al terminar el último evento, la copia reproducida es -- por construcción, mismo reductor que el motor -- idéntica al `board` final real que ya devolvió `resolveLaunch`, así que el `redraw()` final (ya existente, sin cambios) simplemente confirma ese estado (FR-008/SC-003); (5) mientras la secuencia está en marcha, un flag `animating` en la escena bloquea nuevos lanzamientos y cambios de selección de mano (FR-005/FR-006), y la ventana de resultado (`showResultOverlay`, ya existente, sin cambios) se sigue mostrando exactamente igual que hoy, solo que ahora se llama DESPUÉS de que la animación completa termine, no inmediatamente tras `applySessionLaunch`. Ningún cambio en `src/engine/` -- el `EventLog` que ya se genera hoy contiene toda la información necesaria (FR-009). La constitución (Tecnología, "Rendering/UI") ya nombra explícitamente "tweened animation of chain reactions" como parte del stack previsto -- esta feature es, literalmente, implementar esa línea, que hasta ahora no se había construido.

## Technical Context

**Language/Version**: TypeScript (mismo stack, sin dependencias nuevas)

**Primary Dependencies**: Phaser 3, ya en uso (`this.tweens.add`, `this.add.circle`/`Arc` -- APIs de Phaser ya disponibles, ninguna nueva).

**Storage**: N/A.

**Testing**: Vitest para cualquier lógica pura y aislable de Phaser (el reductor que reproduce `EventLog` sobre una copia de `Board`, ver data-model.md) -- consistente con la propia constitución ("Rendering/integration testing tools MAY be added later... not required for the initial prototype"; `board-view.ts`/`BoardScene.ts` ya se validan manualmente, no con Vitest, y esta feature no cambia ese criterio para el código que sí depende de Phaser).

**Target Platform**: Sin cambios -- navegador vía Vite, mismo target que el resto de `src/renderer/`.

**Project Type**: Single project (monorepo existente: `src/engine/`, `src/renderer/`, `tools/generator/`).

**Performance Goals**: Animación fluida a la tasa de refresco del navegador (Phaser ya gestiona esto vía su propio game loop) -- sin objetivo numérico adicional; "duración corta" (spec.md, Assumptions) se resuelve como una constante configurable, no como un objetivo de rendimiento.

**Constraints**: `src/engine/` NO cambia (FR-009) -- ni el tipo `EventLog`/`ChainEvent`, ni `resolveLaunch`/`applySessionLaunch`. Principio I de la constitución sigue intacto: el renderer LEE eventos, nunca alimenta decisiones de vuelta al motor.

**Scale/Scope**: Alcance limitado a `src/renderer/` -- `BoardScene.ts` (orquesta la animación, bloquea input), `board-view.ts` (ninguna firma pública cambia; gana una función auxiliar para el reductor de reproducción), posiblemente `hand-panel.ts` si el bloqueo de selección de mano necesita tocarlo. Aplica a cualquier uso de `BoardScene` (prototipo y visor de niveles generados por igual, ya que ambos comparten la misma escena -- spec.md, Edge Cases).

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **Principio I (motor puro, independiente de UI)**: PASA, y de forma reforzada -- esta feature es la primera vez que el renderer realmente CONSUME `EventLog` más allá de leer el estado final; sigue siendo estrictamente lectura (nunca decide nada que vuelva al motor). Cero cambios en `src/engine/`.
- **Principio II (test-first)**: PASA. La única lógica no-trivial y aislable de Phaser es el reductor "reproducir eventos sobre una copia de tablero" -- se cubre con Vitest antes de integrarlo en `BoardScene`. El resto (orquestación de tweens, bloqueo de input) es código de Phaser, validado manualmente vía quickstart.md, igual que el resto de `BoardScene.ts`/`board-view.ts` ya se valida hoy.
- **Principio III (determinismo)**: PASA. El reductor de reproducción es una función pura `(Board, EventLog) → Board`; el ORDEN de la animación es exactamente el orden ya determinista de `EventLog`. La duración/easing de cada tween es una constante fija, no aleatoria.
- **Principio IV (niveles como datos declarativos)**: N/A -- esta feature no toca niveles ni su formato.
- **Principio V (primitivas composables, no casos especiales)**: PASA -- un único mecanismo de reproducción (recorrer `EventLog`, un `case` por tipo de evento ya existente: `MOVE_STEP`/`ANNIHILATION`) usado igual sin importar qué color o combinación de piezas produjo esos eventos; ningún caso especial por color.
- **Workflow -- cambios de semántica de resolución de cadenas**: NO aplica -- esta feature no toca `src/engine/pieces/push.ts` ni `events.ts`; el mecanismo de resolución de cadenas no cambia en absoluto, solo cómo se REPRESENTA visualmente una traza ya calculada.

Ningún gate bloquea el avance a Phase 0. No hace falta registrar nada en Complexity Tracking.

### Re-check post-diseño (tras Phase 1)

Con `data-model.md` ya concreto, se confirma que ningún gate se ve comprometido:

- El reductor de reproducción (`replayEvent`, ver data-model.md) tiene la misma forma que la lógica ya existente en `applyImpact`/`settleOrVanish` (`src/engine/pieces/push.ts`) para lo que respecta a "cómo un `MOVE_STEP`/`ANNIHILATION` cambia un tablero" -- pero vive en `src/renderer/`, no en `src/engine/`, y no se comparte código entre ambos (duplicación deliberada y mínima: el renderer nunca debe importar lógica de resolución del motor más allá de sus tipos, Principio I). Se documenta explícitamente en data-model.md para que quede claro que es una reproducción fiel, no una reinterpretación.
- `BoardSceneData`/`LevelSession`/`EventLog`/`ChainEvent` no cambian de forma -- ningún tipo público del motor se toca.
- Sigue sin haber Complexity Tracking que rellenar.

## Project Structure

### Documentation (this feature)

```text
specs/018-piece-movement-animation/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output (/speckit-plan command)
├── data-model.md        # Phase 1 output (/speckit-plan command)
├── quickstart.md        # Phase 1 output (/speckit-plan command)
└── tasks.md             # Phase 2 output (/speckit-tasks command - NOT created by /speckit-plan)
```

No se genera `contracts/`: esta feature no expone ninguna interfaz externa nueva -- es una escena Phaser interna, ya documentada en `data-model.md`.

### Source Code (repository root)

```text
src/renderer/
├── launch-animation.ts    # NUEVO -- función pura replayEvent(board, event): Board (el
│                             reductor, testeado con Vitest) + una función de orquestación
│                             que, dado un array de ChainEvent y callbacks de Phaser
│                             (crear/animar/destruir una ficha temporal), determina la
│                             secuencia y duración de cada paso -- sin importar Phaser
│                             directamente en la parte pura, para poder testear replayEvent
│                             en aislamiento (Principio II)
├── board-view.ts           # sin cambios en drawBoard/drawPieceFragility -- se siguen
│                             usando tal cual para redibujar la capa estática entre eventos
├── hand-panel.ts            # sin cambios de firma -- BoardScene simplemente deja de
│                             invocar sus callbacks de selección mientras `animating` es true
└── scenes/BoardScene.ts     # launch() pasa a orquestar la secuencia de animación en vez de
                              redraw() inmediato; nuevo campo privado `animating: boolean`
                              consultado por launch() y por los pointerdown de mano/reinicio

tests/unit/renderer/launch-animation.test.ts   # NUEVO -- tests de replayEvent (Vitest)
```

**Structure Decision**: Proyecto único ya existente. Esta feature añade un único fichero nuevo (`launch-animation.ts`, con su test) y modifica `BoardScene.ts` en el sitio -- `board-view.ts`/`hand-panel.ts` no cambian de firma pública.

## Complexity Tracking

*(vacío -- el Constitution Check no encontró ninguna violación que justificar)*
