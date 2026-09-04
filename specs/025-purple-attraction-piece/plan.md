# Implementation Plan: Ficha Púrpura (Atracción)

**Branch**: `025-purple-attraction-piece` | **Date**: 2026-09-04 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/025-purple-attraction-piece/spec.md`

**Note**: This template is filled in by the `/speckit-plan` command; its definition describes the execution workflow.

## Summary

Añadir 'purple' como séptimo color de ficha, solo repartible en mano y siempre `fragility:
'broken'`. Su lanzamiento no pasa por el camino genérico (`travelLaunch`/`applyImpact`): una
función de escaneo nueva (research.md, Decisión 1) avanza célula a célula comprobando, en cada
celda vacía, si hay ficha a ambos lados del eje perpendicular a su dirección de viaje -- se
asienta y desaparece (un `AnnihilationEvent` con `color: 'purple'`, Decisión 3) en la primera
celda que cumple esa condición; cualquier otro caso (bloqueada por una ficha real, o agota el
carril) es un missclick, igual que el resto de colores ya tienen. Al desencadenarse, las dos
fichas encontradas viajan hacia esa celda y colisionan entre sí -- reutilizando ÍNTEGRAMENTE la
maquinaria de colas ya existente (`walking`, `findCoincidingPair`, `applyMutualImpact`,
019/021) mediante una variante hermana (`attracting`) que rellena con pasos de espera la
trayectoria más corta para que ambas completen su avance real en el mismo ciclo de cola
(Decisión 2) -- sin ningún cambio en `resolveChain` en sí. Sonido propio disparado por
`event.color === 'purple'` en la rama `ANNIHILATION` ya existente del renderer (Decisión 4). Fuera
de alcance: integración en el generador de niveles (igual que negro/arcoíris).

## Technical Context

**Language/Version**: TypeScript (Node.js), mismo stack que el resto del motor (`src/engine/`) y
renderer (`src/renderer/`, Phaser 3).

**Primary Dependencies**: Ninguna nueva. Reutiliza `src/engine/board.ts` (`PieceColor`),
`src/engine/events.ts` (`ChainEvent`, `ImpactSite`, `resolveChain`, `findCoincidingPair`),
`src/engine/launch.ts` (`Hand`, patrón de `travelLaunch`), `src/engine/pieces/push.ts`
(`applyImpact`, `applyMutualImpact`, `stepWalking`, `PUSH_STRATEGY`),
`src/engine/resolve-launch.ts`, `src/renderer/board-view.ts`, `src/renderer/launch-animation.ts`,
`src/renderer/sound-effects.ts`.

**Storage**: N/A (sin persistencia; el estado vive en memoria durante una sesión de nivel).

**Testing**: Vitest, mismo patrón que el resto del motor (`tests/unit/engine/`) — nuevo archivo
`tests/unit/engine/purple.test.ts` cubriendo las 4 historias de usuario (asentamiento +
atracción, missclick en sus dos variantes, restricción de reparto en mano, sonido vía el evento
`ANNIHILATION` producido), más cobertura del nuevo caso `attracting` en cualquier test existente
de `events.ts`/`push.ts` que ejercite `findCoincidingPair`/`walking` si el cambio de firma
compartida lo exige (no se espera ninguno, ver Decisión 2 de research.md: cero cambios de firma).

**Target Platform**: Igual que el resto del proyecto — web (Vite dev server) como base, empaquetado
móvil (Capacitor) más adelante.

**Project Type**: Single project (motor + renderer en el mismo repo, ya establecido).

**Performance Goals**: N/A — sin requisitos de rendimiento distintos del resto del motor (cadenas
de resolución cortas, deterministas, sin bucles de red ni E/S). El escaneo de púrpura es, en el
peor caso, lineal en el tamaño del tablero (8 celdas de carril × hasta 8 celdas de comprobación
perpendicular por celda) — trivial.

**Constraints**: El motor debe seguir siendo 100% síncrono, puro y testeable headless (Principio
I/III). El mecanismo de "esperarse mutuamente" (FR-009) debe vivir en el motor, no en el
renderer (confirmado explícitamente con el usuario durante el diseño) -- resuelto reutilizando
`findCoincidingPair`/`applyMutualImpact` sin tocarlos (research.md, Decisión 2).

**Scale/Scope**: Un color de ficha nuevo, una función de escaneo de lanzamiento nueva
(`src/engine/pieces/purple.ts`), un campo opcional nuevo en `ImpactSite` (`attracting`), una
rama nueva dentro de `applyImpact`'s `defender === null` (hermana de la de marrón), un cambio
acotado en `resolveLaunch` (bifurca por color antes de `travelLaunch`), un color nuevo en
`PIECE_COLOR`/`drawPieceCircle`, un efecto de sonido nuevo, una rama nueva de despacho de sonido
en `launch-animation.ts`. Sin cambios en `tools/generator`. Sin ningún `ChainEvent` nuevo, sin
ningún cambio de firma en `resolveChain`/`applyImpact`/`applyMutualImpact`.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **Principio I (motor puro, sin dependencias de UI)** — el mecanismo de espera mutua (FR-009)
  podría tentar a resolverse en el renderer (pausar la animación hasta que ambas lleguen
  visualmente) en vez de en el motor. Rechazado explícitamente durante el diseño: el motor debe
  producir un `EventLog` en el que ambas fichas YA colisionan en el mismo evento, no dos eventos
  independientes que el renderer tenga que sincronizar por su cuenta. Resuelto en el propio motor
  (research.md, Decisión 2) reutilizando `findCoincidingPair` -- el renderer solo reproduce lo que
  el `EventLog` ya dice que pasó, sin ninguna decisión de sincronización propia. **PASA**.
- **Principio II (test-first)** — nuevo archivo `tests/unit/engine/purple.test.ts` cubre las 4
  historias de usuario y los edge cases de la spec antes/junto con la implementación, mismo
  patrón que `rainbow.test.ts`/`black.test.ts`. **PASA** (verificar en tasks.md que los tests se
  escriben en la misma tarea o justo antes que cada pieza de implementación).
- **Principio III (determinismo)** — el escaneo de asentamiento es una función pura del tablero y
  la dirección; el cálculo de `padSteps` es una función pura de las dos distancias conocidas en el
  momento de desencadenar la atracción. Ninguna fuente de aleatoriedad ni de tiempo real
  involucrada. Dos ejecuciones con el mismo tablero y lanzamiento producen la misma cadena de
  eventos. **PASA**.
- **Principio IV (niveles como datos declarativos)** — sin cambios; `'purple'` es un valor de
  color más en el mismo esquema JSON ya existente (`HandPieceInput`). **PASA**.
- **Principio V (primitivas composables sobre casos especiales)** — dos desviaciones, ambas
  justificadas explícitamente:
  1. El camino de lanzamiento de púrpura (research.md, Decisión 1) es una primitiva de
     LOCALIZACIÓN nueva -- ninguna combinación de `MOVE_STEP`/colisión/repetición/ramificación
     expresa "avanza hasta que una condición sobre el entorno perpendicular se cumpla, no hasta
     chocar con algo". Mismo precedente que la limpieza de línea de negro (023) o el cambio de
     color de arcoíris (024): cada pieza especial ya ha necesitado su propia primitiva nueva.
  2. El campo `attracting` (research.md, Decisión 2) es, en cambio, una composición deliberada
     de primitivas YA EXISTENTES (`walking` + `findCoincidingPair` + `applyMutualImpact`), no una
     primitiva nueva de verdad -- se documenta aquí precisamente para dejar constancia de que se
     evaluó y se descartó una primitiva nueva ("esperar a un compañero explícito") a favor de
     reutilizar la ya validada por 019/021. No cuenta como desviación real del Principio V; se
     lista para que quede trazable en Complexity Tracking por qué NO hizo falta una.

Todas las gates pasan, con una desviación de Principio V documentada y justificada (el camino de
lanzamiento) — permitida explícitamente por el propio principio.

## Project Structure

### Documentation (this feature)

```text
specs/025-purple-attraction-piece/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output (/speckit-plan command)
├── data-model.md        # Phase 1 output (/speckit-plan command)
├── quickstart.md         # Phase 1 output (/speckit-plan command)
├── checklists/
│   └── requirements.md  # /speckit-specify quality gate
└── tasks.md              # Phase 2 output (/speckit-tasks command - NOT created by /speckit-plan)
```

### Source Code (repository root)

```text
src/
├── engine/
│   ├── board.ts             # PieceColor gana 'purple'
│   ├── events.ts            # ImpactSite gana el campo opcional `attracting`
│   ├── resolve-launch.ts    # resolveLaunch bifurca por piece.color === 'purple' antes de
│   │                         # travelLaunch, delegando en pieces/purple.ts
│   └── pieces/
│       ├── purple.ts        # nuevo -- scanPurpleSettle (escaneo de asentamiento) y la
│       │                     # construcción de los dos ImpactSite `attracting` iniciales
│       └── push.ts          # PUSH_STRATEGY gana 'purple' al Exclude; applyImpact's
│                             # `defender === null` gana la rama `attracting` (hermana de
│                             # `walking`)
├── renderer/
│   ├── board-view.ts        # PIECE_COLOR/drawPieceCircle ganan 'purple'
│   ├── hand-panel.ts        # sin cambios propios -- ya reutiliza drawPieceCircle (025-rainbow-visual)
│   ├── launch-animation.ts  # despacho de sonido en la rama ANNIHILATION gana el caso
│   │                         # event.color === 'purple'
│   └── sound-effects.ts     # nuevo playPurpleSound()
└── (sin cambios en tools/generator)

tests/unit/
└── engine/
    └── purple.test.ts       # nuevo -- las 4 historias + edge cases de precedencia/geometría
```

**Structure Decision**: Single project ya establecido (motor headless en `src/engine/`, renderer
Phaser en `src/renderer/`, sin paquetes nuevos). Esta feature no introduce ningún directorio
nuevo salvo `src/engine/pieces/purple.ts`, siguiendo el mismo patrón por el que negro/arcoíris ya
tienen su propia rama dedicada dentro de `push.ts` en vez de un archivo propio -- aquí se separa
en archivo propio porque, a diferencia de negro/arcoíris, el camino de lanzamiento de púrpura NO
pasa por `applyImpact` en absoluto (research.md, Decisión 1), así que no encaja como "una rama
más" del mismo archivo.

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|---------------------------------------|
| Primitiva nueva: camino de lanzamiento por escaneo de entorno en vez de por colisión (Principio V) | El asentamiento de púrpura depende de una condición sobre las celdas vecinas perpendiculares, no de golpear una ficha real -- `travelLaunch`/`applyImpact` (localizar el primer obstáculo y resolver un impacto contra él) no puede expresar "sigue mirando mientras la celda esté vacía y la condición no se cumpla". Mismo precedente que negro/arcoíris. | Extender `travelLaunch` con una condición de parada arbitraria mezclaría una responsabilidad genérica (localizar el primer obstáculo de CUALQUIER color) con una regla de un solo color; darle a púrpura una `PUSH_STRATEGY` no tiene sentido porque, por FR-007, nunca resuelve un impacto contra una defensora real. |
