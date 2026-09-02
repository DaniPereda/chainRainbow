# Tasks: Resolución de Colisiones Casilla a Casilla

**Input**: Design documents from `/specs/021-cellwise-collision-resolution/`
**Prerequisites**: plan.md, research.md, data-model.md, quickstart.md

**Tests**: Incluidos -- Principio II de la constitución (test-first) exige tests para toda regla
de interacción de motor, y este proyecto los ha incluido en toda feature de motor anterior.

**Organization**: Por user story (US1 = P1, US2 = P1 también -- ambas críticas, ver spec.md).

## Phase 1: Foundational (bloqueante para ambas historias)

**Purpose**: El campo nuevo (`ImpactSite.walking`) y la función compartida (`stepWalking`) son la
base de ambas historias -- ninguna puede implementarse sin esto.

- [X] T001 En `src/engine/events.ts`: añadir `walking?: { edgeCrossings: number }` a `ImpactSite`
  (data-model.md).
- [X] T002 En `src/engine/pieces/push.ts`: añadir la función interna `stepWalking(from, direction,
  edgeCrossingsSoFar)` (data-model.md, "Función compartida") -- importar `isInBounds` de
  `../move-step.js` (ya exportado, usado hoy solo dentro de `move-step.ts`).

**Checkpoint**: La infraestructura existe; nada la usa todavía.

## Phase 2: User Story 1 - Dos trayectorias se encuentran en la casilla real donde se cruzan (P1) 🎯 MVP

**Goal**: Dos fichas empujadas por marrón, avanzando una hacia la otra, se detectan y resuelven en
la casilla real donde sus caminos se cruzan -- no en un destino final precalculado que nunca
llegaron a compartir.

**Independent Test**: Reproducir el nivel 2 modificado a mano (quickstart.md, Escenario 1) y
confirmar que las dos fichas verdes desaparecen exactamente en la columna 1.

### Tests for User Story 1 ⚠️

- [X] T003 [P] [US1] REVISADA: `stepWalking` quedó como función interna, no exportada (mismo
  criterio que `resolveMutualSide`/`advance`, ya privadas) -- su comportamiento (paso normal, paso
  que cruza un borde, paso que alcanza `MAX_EDGE_CROSSINGS`) se cubre indirectamente a través de
  `applyImpact` en T004/T005, incluido un caso dedicado de tope de cruces de borde.
- [X] T004 [P] [US1] En `tests/unit/engine/push.test.ts`: test de `applyImpact` confirmando que,
  cuando el golpeador es marrón, el `nextSite` construido tiene `to` un único paso más lejos (no
  el destino final) y `walking: {edgeCrossings: 0}` (o `1` si ese primer paso ya cruza un borde).
- [X] T005 [P] [US1] En `tests/unit/engine/push.test.ts`: test de `applyImpact`, rama
  `defender === null` con `site.walking` presente -- confirmar que devuelve un `nextSite` con
  `to` un paso más lejos y el mismo `walking` actualizado, SIN evento y SIN escribir el tablero.
- [X] T006 [US1] En `tests/unit/engine/red.test.ts` (o un nuevo fichero
  `tests/unit/engine/cellwise-collision.test.ts`): test end-to-end reproduciendo el nivel 2
  modificado a mano -- confirmar un evento `ANNIHILATION` en `(5,1)`, `color: 'green'` (quickstart.md
  Escenario 1). Verificar el trace completo contra el motor real antes de fijarlo como
  expectativa (no asumir la secuencia exacta de eventos intermedios).

### Implementation for User Story 1

- [X] T007 [US1] En `src/engine/pieces/push.ts`, `applyImpact`: la rama `defender === null`
  dispensa un paso más (usando `stepWalking`) en vez de asentar, cuando `site.walking` está
  presente y no se ha alcanzado el tope -- si se alcanza, se asienta ahí (data-model.md, punto 1).
  Depende de T001, T002.
- [X] T008 [US1] En `src/engine/pieces/push.ts`, `applyImpact`: la construcción del `nextSite` para
  una ficha desplazada por un golpeador marrón usa `stepWalking` (1 casilla + `walking`) en vez de
  `PUSH_STRATEGY['brown']` (destino final) -- verde/naranja sin cambios (data-model.md, punto 2).
  Depende de T001, T002.
- [X] T009 [US1] En `src/engine/pieces/push.ts`, `applyMutualImpact`/`resolveMutualSide`: mismo
  cambio en el lado cuyo mecanismo heredado es marrón (data-model.md, sección
  `applyMutualImpact`/`resolveMutualSide`). Depende de T001, T002.

**Checkpoint**: El ejemplo del usuario (columna 1) debe pasar. `npm test` en verde.

## Phase 3: User Story 2 - El comportamiento ya corregido se mantiene exactamente igual (P1)

**Goal**: Una trayectoria en vuelo que alcanza una ficha real y quieta sigue resolviéndose como un
golpe normal y asimétrico, nunca como colisión mutua -- sin reintroducir el bug que la corrección
anterior (`findCoincidingPair` exigiendo casilla vacía) ya resolvió.

**Independent Test**: Los tests ya existentes que cubren esa corrección (incluido el caso "red
north through column 6" y el nivel de ejemplo re-derivado de 019) deben seguir pasando sin cambiar
su expectativa tras esta feature.

### Tests for User Story 2 ⚠️

- [X] T010 [P] [US2] Ejecutar `tests/unit/engine/red.test.ts`, `tests/unit/engine/events.test.ts`,
  `tests/unit/engine/push.test.ts`, `tests/unit/engine/brown.test.ts` ANTES de implementar T007-T009
  (deben pasar con el código actual) y de nuevo DESPUÉS (deben seguir pasando sin cambios de
  expectativa) -- confirma que Phase 2 no regresiona nada ya cubierto.
- [X] T011 [US2] Añadir (si no existe ya un caso equivalente) un test directo confirmando que
  cuando SOLO una trayectoria marrón está en vuelo (sin ninguna otra con la que cruzarse), el
  resultado final es idéntico al de antes de esta feature -- mismo tablero, mismo número de
  eventos, mismas casillas -- para al menos un caso de vuelta completa (full-lap self-collision,
  ya cubierto en `brown.test.ts`) y uno de tope de cruces de borde (ya cubierto en
  `tests/unit/tools/generator/generate.test.ts`, fixture 2).

### Implementation for User Story 2

- [X] T012 [US2] Si T010/T011 revelan cualquier discrepancia, corregir en
  `src/engine/pieces/push.ts`. Si ya pasan con el código de Phase 2 sin cambios, marcar como
  verificación-only (sin diff) -- research.md ya argumenta por qué no debería hacer falta ningún
  cambio adicional aquí (la cola FIFO y `findCoincidingPair` no cambian).

**Checkpoint**: Ambas historias completas. `npm test` en verde, sin ningún test existente
modificado salvo que la verificación encuentre una razón concreta.

## Phase 4: Polish & Cross-Cutting Concerns

- [X] T013 [P] Ejecutar `npm run typecheck` -- confirmar que `walking?` no rompe ninguna
  inferencia existente (en particular, los `toEqual`/`toMatchObject` de tests ya existentes que
  construyen `ImpactSite` a mano sin `walking`, que debe seguir siendo válido por ser opcional).
- [X] T014 [P] Ejecutar `npm test -- tests/unit/levels/` (prototipos 14/15) -- cero regresión.
- [X] T015 Escribir y ejecutar un script puntual (no comprometido) que reverifique los 150 niveles
  ya generados (`levels/*.json`) contra el motor corregido -- confirmar 100% `'won'` (SC-003). Si
  se encuentra alguna discrepancia, documentarla y decidir con el usuario si hace falta regenerar
  algo (spec.md Assumptions: no se regenera nada salvo que la reverificación lo exija).
- [X] T016 Ejecutar `npm run build` -- confirmar que el renderer sigue compilando sin cambios
  (ningún import roto, ninguna forma de evento distinta).
- [X] T017 Revisar los comentarios añadidos en `push.ts`/`events.ts` contra el estilo ya existente
  (explican el PORQUÉ, referencian 021-cellwise-collision-resolution, no repiten el qué).

## Dependencies & Execution Order

- **Foundational (T001-T002)**: sin dependencias -- bloquea Phase 2 y Phase 3.
- **US1 (T003-T009)**: depende de Foundational. Tests (T003-T006) antes que implementación
  (T007-T009) -- deben fallar primero (T006 en particular debe fallar con el código actual, ya
  que reproduce el bug tal cual).
- **US2 (T010-T012)**: depende de US1 completa (reutiliza el mismo camino de código). No bloquea
  nada más.
- **Polish (T013-T017)**: depende de US1 y US2 completas.

### Parallel Opportunities

- T003, T004, T005 son bloques de test independientes -- paralelizables entre sí.
- T007, T008 tocan el mismo bloque de código (`applyImpact`) -- secuenciales, no paralelos.
- T009 toca un bloque distinto (`applyMutualImpact`) -- paralelizable con T007/T008 si se
  implementan por separado, aunque en la práctica es un cambio pequeño mejor hecho junto a T008
  por comprartir `stepWalking`.
- T013, T014 son paralelizables entre sí.

## Implementation Strategy

**MVP = US1 (Phases 1-2)**: con eso el bug concreto reportado por el usuario (dos verdes que
deberían encontrarse en la columna 1) queda resuelto. US2 (Phase 3) es principalmente
verificación de no-regresión sobre la corrección más reciente -- research.md ya predice que no
debería hacer falta ningún cambio adicional de código para satisfacerla, dado que la cola FIFO y
`findCoincidingPair` no cambian.
