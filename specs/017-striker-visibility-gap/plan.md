# Implementation Plan: La Ficha Lanzadora Recién Asentada Debe Ser Visible Para el Desplazamiento de la Ficha Que Golpeó

**Branch**: `017-striker-visibility-gap` | **Date**: 2026-09-01 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/017-striker-visibility-gap/spec.md`

## Summary

Dentro de `applyImpact` (`src/engine/pieces/push.ts`), el cálculo de hasta dónde se desplaza la ficha defensora recién golpeada (`to = PUSH_STRATEGY[site.piece.color](vacated, hitDefender, site.to, site.direction)`) recibe el tablero `vacated` -- una fotografía tomada ANTES de que la ficha lanzadora se asiente en su propia casilla de impacto -- en vez de `boardWithStriker`, el tablero que ya la incluye. Para verde/naranja (distancia fija, `stepBy`, que nunca consulta el tablero) esto es inobservable. Para marrón (`stepUntilBlocked`, que inspecciona ocupación celda a celda) es un bug real: si el paseo de la ficha golpeada vuelve a alcanzar la casilla donde la ficha lanzadora acaba de asentarse -- el caso más notorio siendo una vuelta completa al tablero (wrap-around) -- no la ve, y la atraviesa como si estuviera vacía en vez de colisionar con ella. Verificado empíricamente con el nivel 49 generado: `stepUntilBlocked` sobre `vacated` devuelve `(7,7)` (da la vuelta completa, sin chocar); el mismo cálculo sobre un tablero que sí incluye a la ficha lanzadora asentada en `(4,7)` devuelve `(4,7)` (colisión inmediata). El fix es de una línea: pasar `boardWithStriker` en vez de `vacated` a esa llamada de `PUSH_STRATEGY`. `vacated` sigue siendo necesario tal cual para el propio `settleOrVanish` de la ficha lanzadora (que necesita la casilla vacía para escribir en ella) y para el caso base (`defender === null`) -- ninguno de esos usos cambia.

Durante la implementación se descubrió que esta corrección tiene una consecuencia mucho más amplia de lo previsto (research.md, Decisión 4, verificada empíricamente antes de escribir código): con un golpeador REAL, un empuje de marrón sobre un carril por lo demás totalmente despejado ahora SIEMPRE completa una vuelta y choca con su propio golpeador, para CUALQUIER distancia -- no solo en el caso de vuelta-completa-al-borde que motivó la Historia 1. Esto hace que el "asentamiento limpio" de marrón (el mecanismo que el tope de cruces de borde, `MAX_EDGE_CROSSINGS`, estaba pensado para acotar) sea permanentemente inalcanzable con un golpeador real -- una categoría de nivel que el generador (`tools/generator/`) ya sabía construir, y que el nivel 12 del prototipo ya usaba. Se añadió una Historia 3: `tools/generator/obligations.ts` marca el golpeador marrón elegido para ese contexto (`'settle'`) con un nuevo flag `mustBeBroken`, forzando su resolución por lanzamiento directo (nunca por cadena) con fragilidad `'broken'` -- así golpea con normalidad pero nunca se asienta, dejando el carril genuinamente despejado, exactamente la física original. `generate.ts` excluye esa ficha forzada del grupo de uniformidad de `fragilityProfile` (FR-006 de 013) al asignar fragilidad a las fichas lanzadas. El nivel 12 del prototipo se ajusta de la misma forma. Los 140 niveles existentes se reverificaron contra el motor y generador corregidos: 11 dejaron de resolver a `'won'` (`40, 49, 71, 101, 107, 113, 132, 156, 165, 207, 251`) y se regeneraron con su mismo `complexityScore`.

## Technical Context

**Language/Version**: TypeScript (mismo stack, sin dependencias nuevas)

**Primary Dependencies**: Ninguna nueva.

**Storage**: N/A para el motor. `levels/` (140 ficheros JSON) se reverificó; 11 niveles afectados (`40, 49, 71, 101, 107, 113, 132, 156, 165, 207, 251`) se regeneraron -- mismo criterio de "niveles como datos declarativos" (Principio IV) que ya regía antes.

**Testing**: Vitest, igual que el resto del motor (Principio II).

**Target Platform**: Sin cambios -- `src/engine/` sigue siendo headless, sin dependencia de renderer (Principio I).

**Project Type**: Single project (monorepo existente: `src/engine/`, `src/renderer/`, `tools/generator/`).

**Performance Goals**: N/A -- el cambio es sustituir qué variable de tablero (ya calculada, sin coste adicional) se pasa a una llamada existente.

**Constraints**: El tipo público `Board`/`Piece`/`EventLog`/`ImpactSite` NO cambia. `PUSH_STRATEGY`, `stepUntilBlocked`, `stepBy`, `MAX_EDGE_CROSSINGS` (`move-step.ts`), `inverseCandidates`/`isFarEdgeOfLane`/`laneCandidatesWithClearPath` (`inverses.ts`) no cambian su propia lógica -- solo cambia qué tablero recibe la llamada existente dentro de `applyImpact`, y qué fragilidad recibe un golpeador marrón concreto en `obligations.ts`/`generate.ts`.

**Scale/Scope**: Sin cambio de escala -- mismo tablero 8×8, mismo motor. Alcance: una línea de `push.ts` (Historia 1); un flag nuevo (`mustBeBroken`) en `obligations.ts` y su consumo en `generate.ts` (Historia 3, descubierta durante la implementación); la reverificación/regeneración de `levels/` (Historia 2); el nivel 12 del prototipo y sus tests asociados ajustados para preservar su demostración original.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **Principio I (motor puro, independiente de UI)**: PASA. El cambio vive enteramente en `src/engine/pieces/push.ts` -- ningún cambio en `src/renderer/`.
- **Principio II (test-first)**: PASA. Se añade primero un test de regresión sintético que reproduce el caso del nivel 49 (marrón, fila despejada salvo por la propia ficha lanzadora, wrap-around) y se confirma que falla contra el código actual antes de aplicar el fix.
- **Principio III (determinismo)**: PASA. `applyImpact` sigue siendo una función pura de `(board, site)` -- el cambio es qué board (ya determinista, ya calculado) se le pasa a una sub-llamada interna, no una nueva fuente de estado o aleatoriedad.
- **Principio IV (niveles como datos declarativos)**: PASA -- `levels/` se reverifica y, donde haga falta, se regenera como el mismo tipo de dato declarativo de siempre.
- **Principio V (primitivas composables, no casos especiales)**: PASA. El fix se aplica de forma uniforme a las tres estrategias vía `PUSH_STRATEGY[site.piece.color](boardWithStriker, ...)` -- ningún caso especial por color, aunque el efecto observable solo se manifieste con marrón.
- **Workflow -- cambios de semántica de resolución de cadenas**: SÍ aplica, y este plan.md es su documentación exigida. El cambio: la llamada a `PUSH_STRATEGY` dentro de `applyImpact` pasa de recibir `vacated` a recibir `boardWithStriker`. Justificación: sin este cambio, una ficha desplazada dentro de una cascada puede no colisionar con la ficha lanzadora ya asentada de esa misma cascada -- exactamente el tipo de auto-colisión invisible que 016-immediate-chain-placement fijó como objetivo (FR-002 de esa feature: "una consulta al tablero DEBE devolver únicamente una casilla vacía o una ficha real ya completamente resuelta"), en un punto que esa feature no cubrió (la propia llamada a `PUSH_STRATEGY`, no una lectura vía `getPieceAt`/`resolveChain`). Principio que motiva la corrección: Principio V, ya que `boardWithStriker` es la ÚNICA fuente de verdad correcta y ya existente para "qué hay en el tablero en este punto de la resolución" -- no se introduce ningún mecanismo nuevo, solo se corrige cuál de las dos variables ya existentes se usa.

Ningún gate bloquea el avance a Phase 0. No hace falta registrar nada en Complexity Tracking.

### Re-check post-diseño (tras Phase 1, y tras descubrir la Historia 3 durante la implementación)

Con `data-model.md` ya concreto, se confirma que ningún gate se ve comprometido:

- `applyImpact` conserva su misma firma pública (`ImpactHandler`) -- ningún cambio de tipo, ningún consumidor externo afectado.
- `vacated` no desaparece: sigue siendo la variable correcta para `settleOrVanish` de la ficha lanzadora y para el caso `defender === null` -- el cambio es exclusivamente cuál variable recibe la llamada a `PUSH_STRATEGY`.
- `move-step.ts`/`board.ts`/`events.ts` quedan sin ningún cambio.
- La Historia 3 (`mustBeBroken` en `obligations.ts`/`generate.ts`) NO toca el gate de "cambio de semántica de resolución de cadenas" -- es un ajuste del GENERADOR (una heurística de construcción validada, en última instancia, contra el motor real vía `validatesForward`), no un cambio a cómo el motor resuelve una cascada. Principio V sigue cumpliéndose: `mustBeBroken` reutiliza la fragilidad `'broken'` y su semántica de `settleOrVanish` ya existentes (016), sin introducir ningún mecanismo nuevo en el motor.
- Principio III (determinismo) se re-confirma para la Historia 3: `resolveObligations`/`generateLevelWithRng` siguen siendo funciones puras de `(obligation/params, rng)`; `mustBeBroken` es una decisión determinista derivada de qué candidato de `chooseStrikerAndOrigin` se sorteó, no una fuente nueva de aleatoriedad.
- Sigue sin haber Complexity Tracking que rellenar.

## Project Structure

### Documentation (this feature)

```text
specs/017-striker-visibility-gap/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output (/speckit-plan command)
├── data-model.md         # Phase 1 output (/speckit-plan command)
├── quickstart.md         # Phase 1 output (/speckit-plan command)
└── tasks.md              # Phase 2 output (/speckit-tasks command - NOT created by /speckit-plan)
```

No se genera `contracts/`: esta feature no expone ninguna interfaz externa nueva -- `applyImpact` es una función interna de `src/engine/`, ya documentada en `data-model.md`.

### Source Code (repository root)

```text
src/engine/pieces/push.ts   # applyImpact: la llamada a PUSH_STRATEGY pasa a recibir
                               boardWithStriker en vez de vacated. Ninguna otra línea cambia.

tools/generator/obligations.ts  # Obligation gana mustBeBroken?; RawLaunch gana
                                   forcedFragility?; el golpeador marrón de un
                                   contexto 'settle' se marca y se fuerza a
                                   lanzamiento directo (Historia 3)
tools/generator/generate.ts     # la fragilidad de fichas lanzadas excluye las
                                   forzadas del grupo de uniformidad antes de
                                   llamar a assignGroupFragility
tools/generator/inverses.ts     # SIN CAMBIOS -- los candidatos ya calculados
                                   siguen siendo correctos (research.md, Decisión 4)

src/levels/prototype-levels.ts  # nivel 12: mano ['brown'] -> [{color:'brown',
                                   fragility:'broken'}] para preservar su
                                   demostración original del tope de cruces de borde

levels/                     # 140 ficheros reverificados contra el motor y generador
                               corregidos; 11 regenerados con su mismo complexityScore
                               (40, 49, 71, 101, 107, 113, 132, 156, 165, 207, 251)

tests/unit/engine/push.test.ts        # nuevo test de regresión (nivel 49, Historia 1)
tests/unit/engine/brown.test.ts       # test foundational actualizado (golpeador
                                         broken) + nuevo test del comportamiento real
tests/unit/tools/generator/generate.test.ts   # fixture 2: hand esperado actualizado
tests/unit/tools/generator/fragility.test.ts  # uniformidad excluye fichas forzadas
```

**Structure Decision**: Proyecto único ya existente. Esta feature no añade ningún directorio nuevo -- corrige una línea de `src/engine/pieces/push.ts` en el sitio (Historia 1), añade un flag a `tools/generator/obligations.ts`/`generate.ts` (Historia 3), y reverifica/regenera `levels/` con la herramienta ya existente (Historia 2).

## Complexity Tracking

*(vacío -- el Constitution Check no encontró ninguna violación que justificar; el gate de "cambio de semántica de resolución de cadenas" se documenta arriba, no es una violación sino el proceso exigido para este tipo de cambio)*
