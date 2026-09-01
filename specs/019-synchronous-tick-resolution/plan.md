# Implementation Plan: Resolución Síncrona de Trayectorias Simultáneas (Tick a Tick)

**Branch**: `019-synchronous-tick-resolution` | **Date**: 2026-09-01 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/019-synchronous-tick-resolution/spec.md`

## Summary

`resolveChain` (`src/engine/events.ts`) ya es una cola FIFO -- el hallazgo central de `research.md`/`data-model.md` es que sembrarla con DOS sitios iniciales a la vez (en vez de las dos llamadas secuenciales que hace hoy `resolveRedSplit`) ya la hace alternar sus saltos hop a hop de forma естест natural (A,B,A,B,...), exactamente la semántica de "tick" que pide esta feature -- no hace falta ninguna estructura de "rondas" nueva. Lo único que se añade es: (1) `resolveChain` pasa a aceptar un array de sitios iniciales (`ImpactSite[]`, antes un único `initialSite`) y, antes de cada `shift()`, comprueba si dos entradas de la cola comparten el mismo destino (`to`) -- si las hay, se resuelven con una nueva función, `applyMutualImpact`, en vez de con el `applyImpact` normal; (2) `applyMutualImpact` implementa la regla simétrica que decidió el usuario (cada trayectoria es golpeadora y defensora de la otra a la vez: mismo color aniquila mutuamente; distinto color hace que cada una avance su propia fragilidad y continúe con el mecanismo de empuje Y LA DIRECCIÓN de la otra -- confirmado explícitamente con el usuario que esto significa un intercambio de dirección, no un rebote); (3) `resolveRedSplit` deja de llamar a `resolveChain` dos veces y siembra ambas ramas en una única llamada. Para el caso de hoy (ningún lanzamiento produce más de un sitio activo a la vez, salvo la propia división de rojo) la cola nunca supera 1 entrada pendiente, así que la comprobación de coincidencia siempre es `null` de inmediato y el comportamiento es idéntico al actual (FR-006) -- no por un caso especial que lo garantice, sino porque el mecanismo nuevo colapsa exactamente al de hoy cuando N≤1.

## Technical Context

**Language/Version**: TypeScript (mismo stack, sin dependencias nuevas)

**Primary Dependencies**: Ninguna nueva.

**Storage**: N/A para el motor. `levels/` se reverifica (no se espera ninguna regeneración -- ningún nivel generado usa rojo, `tools/generator/` sigue excluyéndolo).

**Testing**: Vitest, igual que el resto del motor (Principio II). Tests sintéticos nuevos para `resolveChain`/`applyMutualImpact` con múltiples sitios activos, más un caso real de cruce vía wrap-around entre las dos ramas de una división de rojo.

**Target Platform**: Sin cambios -- `src/engine/` sigue siendo headless (Principio I).

**Project Type**: Single project (monorepo existente).

**Performance Goals**: N/A -- la comprobación de coincidencia añadida es O(tamaño de la cola) antes de cada `shift()`; la cola nunca supera un puñado de entradas (como mucho, el número de ramas concurrentes de una división), sin impacto medible.

**Constraints**: El tipo público `Board`/`Piece`/`ChainEvent` NO cambia. `ImpactHandler`/`ImpactSite` NO cambian de forma. `resolveChain` SÍ cambia de firma (un array en vez de un único sitio, más un nuevo parámetro `handleMutualImpact`) -- sus dos únicos consumidores (`resolve-launch.ts`, `resolveRedSplit` en `push.ts`) se actualizan en el mismo cambio.

**Scale/Scope**: `src/engine/events.ts` (firma de `resolveChain`, nueva función `findCoincidingPair`), `src/engine/pieces/push.ts` (`applyMutualImpact` nueva, `resolveRedSplit` simplificado), `src/engine/resolve-launch.ts` (una línea, `initialSite` → `[initialSite]`). Ningún cambio a `tools/generator/` (sigue sin construir con rojo) ni a `src/renderer/`.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **Principio I (motor puro, independiente de UI)**: PASA. Todo el cambio vive en `src/engine/` -- ningún cambio en `src/renderer/`/`tools/generator/`.
- **Principio II (test-first)**: PASA. `applyMutualImpact` y la nueva comprobación de coincidencia en `resolveChain` se cubren con tests sintéticos ANTES de tocar `resolveRedSplit` -- y el caso real de cruce (US1) se verifica con un test de integración construido a mano, comparado explícitamente contra el comportamiento anterior.
- **Principio III (determinismo)**: PASA. `resolveChain`/`applyMutualImpact` siguen siendo funciones puras. `findCoincidingPair` es determinista (siempre el mismo par, mismo orden, para la misma cola -- research.md, Decisión 4). Ninguna fuente nueva de aleatoriedad.
- **Principio IV (niveles como datos declarativos)**: PASA -- sin cambios a `levels/` esperados (ningún nivel generado usa rojo); se reverifica para confirmarlo, no se asume.
- **Principio V (primitivas composables, no casos especiales)**: PASA, y es el eje del diseño -- `resolveChain` sigue siendo la ÚNICA cola de resolución, ahora genuinamente genérica en N sitios iniciales (no dos casos: "un sitio" vs "dos ramas de rojo resueltas aparte"). `resolveRedSplit` dejar de tener su propia lógica de secuenciación -- se convierte en "sembrar dos sitios en la cola genérica", igual que `resolve-launch.ts` siembra uno.
- **Workflow -- cambios de semántica de resolución de cadenas**: SÍ aplica, y este plan.md es su documentación exigida. El cambio: `resolveChain` pasa de una cola con un único sitio activo a soportar N sitios activos con detección de coincidencia entre ellos; se añade `applyMutualImpact` como nueva primitiva de colisión simétrica. Justificación: retoma explícitamente el ítem ya aplazado por 009-red-piece (FR-005/Assumptions, "una resolución genuinamente simultánea/entrelazada... solo si se demuestra necesaria") -- el usuario ha decidido ahora que sí es necesaria, como parte del roadmap acordado (animación → **este cambio** → rojo en generador → fichas nuevas). Principio que motiva el diseño: Principio V (reutilizar `resolveChain` como único mecanismo, generalizado, en vez de mantener el caso especial de dos llamadas secuenciales que `resolveRedSplit` tenía desde 016).

Ningún gate bloquea el avance a Phase 0. No hace falta registrar nada en Complexity Tracking.

### Re-check post-diseño (tras Phase 1)

Con `data-model.md` ya concreto, se confirma que ningún gate se ve comprometido:

- El hallazgo de que `resolveChain` ya es una cola FIFO -- y que sembrar N sitios a la vez ya produce la alternancia hop-a-hop deseada sin ninguna estructura nueva -- confirma que esto es una generalización mínima, no una reescritura (Principio V, otra vez).
- `ImpactHandler`/`ImpactSite`/`ChainEvent`/`EventLog` no cambian de forma -- solo la FIRMA de `resolveChain` (array de sitios + nuevo parámetro), con sus dos consumidores actualizados en el mismo cambio, sin dejar ningún call site roto.
- El caso `N≤1` (todo lo que no sea una división de rojo) se comporta de forma IDÉNTICA por construcción (la comprobación de coincidencia sobre una cola de 0-1 elementos siempre es `null`), no por un test que lo confirme después -- el test lo confirma, no lo garantiza.
- Sigue sin haber Complexity Tracking que rellenar.

## Project Structure

### Documentation (this feature)

```text
specs/019-synchronous-tick-resolution/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output (/speckit-plan command)
├── data-model.md         # Phase 1 output (/speckit-plan command)
├── quickstart.md         # Phase 1 output (/speckit-plan command)
└── tasks.md              # Phase 2 output (/speckit-tasks command - NOT created by /speckit-plan)
```

No se genera `contracts/`: esta feature no expone ninguna interfaz externa nueva -- `resolveChain`/`applyMutualImpact` son funciones internas de `src/engine/`, ya documentadas en `data-model.md`.

### Source Code (repository root)

```text
src/engine/events.ts         # resolveChain: initialSite -> initialSites (array); nuevo parámetro
                                handleMutualImpact; nueva función privada findCoincidingPair
src/engine/pieces/push.ts    # applyMutualImpact nueva (exportada, para tests); resolveRedSplit
                                simplificado -- una sola llamada a resolveChain con ambas ramas
src/engine/resolve-launch.ts # una línea: resolveChain(level.board, [initialSite], applyImpact,
                                applyMutualImpact)

tests/unit/engine/events.test.ts   # (nuevo, o ampliar el existente) resolveChain con múltiples
                                      sitios iniciales sintéticos, con y sin coincidencia
tests/unit/engine/push.test.ts     # applyMutualImpact: mismo color, distinto color (intercambio
                                      de dirección), caso ya-broken
tests/unit/engine/red.test.ts      # nuevo test de integración: cruce real de las dos ramas vía
                                      wrap-around (US1), comparado contra el comportamiento
                                      secuencial anterior

levels/                      # reverificado (no se espera ningún cambio -- el generador no usa
                                rojo); confirmado, no asumido
```

**Structure Decision**: Proyecto único ya existente. Esta feature no añade ningún directorio nuevo -- generaliza `src/engine/events.ts`/`pieces/push.ts` en el sitio.

## Complexity Tracking

*(vacío -- el Constitution Check no encontró ninguna violación que justificar; el gate de "cambio de semántica de resolución de cadenas" se documenta arriba, no es una violación sino el proceso exigido para este tipo de cambio)*
