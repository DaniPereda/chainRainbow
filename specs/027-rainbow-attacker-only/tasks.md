# Tasks: Arcoíris Solo Actúa Como Atacante

**Input**: Design documents from `/specs/027-rainbow-attacker-only/`
**Prerequisites**: plan.md, research.md, data-model.md, quickstart.md

**Tests**: Incluidos -- Principio II de la constitución (test-first) exige tests para toda regla de
interacción del motor, mismo patrón que el resto de `tests/unit/engine/`.

**Organization**: Por user story (US1-US3 = P1, US4 = P2 -- ver spec.md). Precedida de una fase
Foundational con la pieza de plomería de la que dependen todas: unificar `MutualImpactHandler` con
`ImpactResolution`, y extraer los dos helpers (`buildColorChoicePause`, `clearLineFrom`) que el
resto de las historias reutilizan.

## Phase 1: Foundational (bloqueante para las cuatro historias)

**Purpose**: Hoy `MutualImpactHandler` no puede pausar (research.md Decisión 2) -- sin este cambio,
ninguna colisión mutua con arcoíris puede abrir un selector de color. Las dos extracciones
(`buildColorChoicePause`, `clearLineFrom`, Decisión 3) son las piezas que US1/US3 reutilizan sin
duplicar lógica. Ninguna tarea de esta fase cambia todavía ningún comportamiento observable.

- [X] T001 En `src/engine/events.ts`: cambiar la firma de `MutualImpactHandler` de `(board, siteA,
  siteB) => { board, events, nextSites }` a `(board, siteA, siteB) => ImpactResolution`
  (data-model.md). Sin implementación todavía -- solo el tipo.
- [X] T002 En `src/engine/events.ts`, dentro de `drive`: la rama de colisión mutua pasa a comprobar
  `result.status === 'pending-color-choice'` (igual que ya hace la rama de impacto simple) y, si es
  así, devuelve `pendingFrom(events, queue, result, handleImpact, handleMutualImpact)` -- reutiliza
  `pendingFrom` sin ningún cambio en su propia firma (data-model.md). Depende de T001.
- [X] T003 En `src/engine/pieces/push.ts`: extraer `buildColorChoicePause(defender, at,
  vanishedAttacker, boardBeforePause)` de la construcción de pausa que hoy vive inline dentro de la
  rama `defender.color === 'rainbow' || site.piece.color === 'rainbow'` de `applyImpact`
  (data-model.md) -- `applyImpact` pasa a llamarla en vez de construir la pausa inline. Cero cambio
  de comportamiento (mismo `options`, mismo `resume`, misma fragilidad preservada).
- [X] T004 En `src/engine/pieces/push.ts`: extraer `clearLineFrom(board, at, direction,
  triggerEvent)` de la construcción de la limpieza de línea que hoy vive inline dentro de la rama
  `site.piece.color === 'black'` de `applyImpact` (data-model.md) -- `applyImpact` pasa a llamarla
  para obtener `clearedBoard`/`events`. Cero cambio de comportamiento (mismo `triggerEvent`, mismos
  eventos de barrido).
- [X] T005 En `src/engine/pieces/push.ts`: `applyMutualImpact`'s dos ramas ya existentes (mismo
  color se anula; colores distintos se empujan mutuamente vía `strikeMutualSide` dos veces) añaden
  `status: 'resolved'` a lo que ya devuelven -- cambio mecánico para cumplir el nuevo tipo de T001.
  Depende de T001.
- [X] T006 Ejecutar `npm run typecheck` y `npm test` -- confirmar que T001-T005 son puramente
  refactor (0 regresiones en toda la suite existente) antes de construir ningún comportamiento
  nuevo encima. Depende de T001, T002, T003, T004, T005.

**Checkpoint**: la plomería existe, compila, y no ha cambiado ningún comportamiento observable
todavía.

---

## Phase 2: User Story 1 - Una arcoíris asentada, al ser golpeada, se desplaza como cualquier otra defensora (Priority: P1) 🎯 MVP

**Goal**: Quitar la mitad `defender.color === 'rainbow'` de la condición de `applyImpact` -- una
arcoíris asentada golpeada por cualquier atacante pasa a comportarse exactamente como cualquier otra
defensora.

**Independent Test**: quickstart.md, Escenarios 1, 2 y 3.

### Tests for User Story 1 ⚠️

- [X] T007 [P] [US1] En `tests/unit/engine/rainbow.test.ts`: una arcoíris asentada golpeada por
  verde/naranja/marrón (tres casos) avanza su fragilidad y se desplaza la distancia propia de ese
  color (`PUSH_STRATEGY`), continuando como una ficha `'rainbow'` en movimiento -- sin abrir ningún
  selector de color (quickstart.md Escenario 1).
- [X] T008 [P] [US1] En `tests/unit/engine/rainbow.test.ts`: una arcoíris asentada golpeada por
  rojo se divide en dos ramas perpendiculares, ambas `'rainbow'`, sin abrir ningún selector --
  confirma la inversión deliberada de FR-010 de 024 (quickstart.md Escenario 2).
- [X] T009 [P] [US1] En `tests/unit/engine/rainbow.test.ts`: una arcoíris asentada golpeada por
  negro sigue eliminando su línea completa, exactamente igual que antes de esta feature -- test de
  NO regresión (quickstart.md Escenario 3).
- [X] T010 [P] [US1] En `tests/unit/engine/rainbow.test.ts`: una arcoíris desplazada que no
  encuentra nada más se asienta como una ficha `'rainbow'` corriente con la fragilidad ya avanzada;
  si esa fragilidad ya era `'broken'`, desaparece sin llegar a aplicar ningún efecto (spec.md User
  Story 1, escenarios 4-5).

### Implementation for User Story 1

- [X] T011 [US1] En `src/engine/pieces/push.ts`, `applyImpact`: la condición de la línea 556 pasa
  de `defender.color === 'rainbow' || site.piece.color === 'rainbow'` a solo `site.piece.color ===
  'rainbow'` (research.md Decisión 1). Depende de T003 (la rama sigue llamando a
  `buildColorChoicePause`, ahora solo alcanzable cuando la ATACANTE es arcoíris).
- [X] T012 [US1] Ejecutar `npm run typecheck` y `npm test` -- T007-T010 en verde; confirmar
  quickstart.md Escenarios 1-3 manualmente.

**Checkpoint**: User Story 1 completamente funcional -- una arcoíris asentada nunca vuelve a
recolorearse a sí misma, sin importar qué la golpee.

---

## Phase 3: User Story 2 - Una arcoíris ya en vuelo, si golpea a una defensora real, actúa como atacante igual que siempre (Priority: P1)

**Goal**: Confirmar explícitamente que una arcoíris desplazada (User Story 1), al golpear una
defensora real más adelante en la misma cadena, sigue el camino de siempre (`site.piece.color ===
'rainbow'`, sin cambios) -- sin ningún código nuevo.

**Independent Test**: quickstart.md, Escenario 4.

### Tests for User Story 2 ⚠️

- [X] T013 [P] [US2] En `tests/unit/engine/rainbow.test.ts`: una arcoíris empujada por una ficha
  verde que a continuación golpea una TERCERA ficha real asentada abre el selector de color de
  siempre, señalando a esa tercera ficha (no a la propia arcoíris); al elegir un color, esa ficha lo
  adopta y la arcoíris desaparece, consumida -- mismo resultado que una arcoíris lanzada
  directamente desde la mano contra esa misma ficha (quickstart.md Escenario 4).

### Implementation for User Story 2

- [X] T014 [US2] Ninguna -- este camino (`site.piece.color === 'rainbow'` en `applyImpact`) no
  cambia por esta feature (spec.md FR-004); esta historia es de verificación explícita de que User
  Story 1 no lo rompe, no de implementación nueva.
- [X] T015 [US2] Ejecutar T013, confirmar verde.

**Checkpoint**: una arcoíris desplazada puede ejercer su propio efecto sobre una ficha real más
adelante en la cadena, exactamente igual que si hubiera sido lanzada directamente.

---

## Phase 4: User Story 3 - Colisión mutua entre arcoíris y otro color: secuencia de dos pasos (Priority: P1)

**Goal**: Cuando exactamente un lado de una colisión mutua es arcoíris, resolverla en dos pasos:
arcoíris recolorea primero a la otra ficha (que se asienta ahí mismo, fragilidad intacta), y el
color recién elegido actúa después sobre arcoíris con su propio mecanismo (empuje, división, o
limpieza de línea si es negro).

**Independent Test**: quickstart.md, Escenarios 5, 6 y 7.

### Tests for User Story 3 ⚠️

- [X] T016 [P] [US3] En `tests/unit/engine/push.test.ts`: colisión mutua arcoíris+verde -- el
  selector señala a la ficha verde; al elegir naranja, la ficha verde se asienta con naranja y
  fragilidad SIN cambios, e inmediatamente después arcoíris queda empujada la distancia propia de
  naranja con su fragilidad YA avanzada, sin ningún selector adicional (quickstart.md Escenario 5).
- [X] T017 [P] [US3] En `tests/unit/engine/push.test.ts`: colisión mutua arcoíris+rojo -- tras
  elegir un color en el selector (señalando al lado rojo), ese lado se asienta con el color elegido,
  e inmediatamente después es ARCOÍRIS (no el otro lado) quien queda dividida en dos ramas
  perpendiculares (quickstart.md Escenario 6).
- [X] T018 [P] [US3] En `tests/unit/engine/push.test.ts`: colisión mutua arcoíris+color-real donde
  el color elegido en el selector es negro -- tras el paso 1, el lado no-arcoíris se asienta
  recoloreado a negro; inmediatamente después, la línea completa de arcoíris se elimina (trigger +
  barrido), y la colisión termina sin `nextSite` para ningún lado (quickstart.md Escenario 7,
  FR-007).
- [X] T019 [P] [US3] En `tests/unit/engine/push.test.ts`: si el lado NO-arcoíris de la colisión ya
  tiene fragilidad `'broken'` antes de que arcoíris intente recolorearlo, desaparece sin recibir
  ningún efecto de arcoíris -- reutiliza la regla ya existente de `strikeMutualSide` para cualquier
  lado `'broken'` (spec.md Edge Cases).

### Implementation for User Story 3

- [X] T020 [US3] En `src/engine/pieces/push.ts`, `applyMutualImpact`: añadir la rama `siteA.piece.
  color === 'rainbow' || siteB.piece.color === 'rainbow'` (solo alcanzable cuando NO son del mismo
  color, ya interceptado antes) -- identifica `rainbowSite`/`otherSite`, construye el evento de
  desaparición de arcoíris, y llama a `buildColorChoicePause(otherSite.piece, otherSite.to,
  vanishedRainbow, board)` (data-model.md). Depende de T003, T005.
- [X] T021 [US3] En `src/engine/pieces/push.ts`: nueva función `applyChosenColorToRainbow(board,
  rainbowSite, chosen, eventsSoFar)` -- si `chosen.color === 'black'`, construye el evento
  disparador y llama a `clearLineFrom` (data-model.md); si no, llama a
  `strikeMutualSide(board, rainbowSite, {...rainbowSite, piece: chosen})` y traduce su
  `{board, events, nextSite}` a un `ImpactResolution` `'resolved'`. El `resume` de la pausa de T020
  llama primero a `pause.resume(color)` (siempre `'resolved'`, nunca anida) y después a esta
  función con su `board`/`events`. Depende de T004, T020.
- [X] T022 [US3] En `src/engine/pieces/push.ts`, `strikeMutualSide`: sustituir el `throw
  new Error('invariant violated: black cannot be one side of a mutual collision')` por una rama
  real que construye el evento disparador y llama a `clearLineFrom(board, hitSite.to,
  strikerSite.direction, triggerEvent)`, devolviendo `nextSite: null` (data-model.md). Actualizar el
  comentario existente para aclarar que la invariante original (negro real como uno de los dos
  lados YA en vuelo) sigue vigente -- esta rama solo se alcanza desde el camino sintético de T021.
  Depende de T004.
- [X] T023 [US3] En `src/engine/pieces/push.ts`, `strikeMutualSide`: eliminar el `throw new
  Error('invariant violated: rainbow cannot be one side of a mutual collision')` -- ya no es
  cierto que sea imposible, pero con T020 interceptando el caso "un lado es arcoíris" ANTES de
  llamar a `strikeMutualSide`, esta rama queda inalcanzable de nuevo por una razón distinta
  (interceptada antes, no imposible) y ya no hace falta que lance ninguna excepción (data-model.md,
  sección "Sin cambios"). Depende de T020.
- [X] T024 [US3] Ejecutar `npm run typecheck` y `npm test` -- T016-T019 en verde; confirmar
  quickstart.md Escenarios 5-7 manualmente.

**Checkpoint**: User Stories 1, 2 y 3 funcionan juntas -- una colisión mutua con arcoíris en un
lado se resuelve siempre con la secuencia de dos pasos, para cualquiera de los cinco colores
posibles como resultado del primer paso.

---

## Phase 5: User Story 4 - Colisión mutua entre dos arcoíris sigue siendo una aniquilación por mismo color (Priority: P2)

**Goal**: Confirmar explícitamente que dos arcoíris en colisión mutua no necesitan ningún código
nuevo -- ya cubierto por la comprobación de mismo color existente al principio de
`applyMutualImpact`.

**Independent Test**: quickstart.md, Escenario 8.

### Tests for User Story 4 ⚠️

- [X] T025 [P] [US4] En `tests/unit/engine/push.test.ts`: colisión mutua entre dos trayectorias
  arcoíris produce dos eventos `ANNIHILATION` (uno por lado) sin abrir ningún selector de color
  (quickstart.md Escenario 8).

### Implementation for User Story 4

- [X] T026 [US4] Ninguna -- ya cubierto por `if (siteA.piece.color === siteB.piece.color)` al
  principio de `applyMutualImpact`, sin cambios (research.md Decisión 7); esta historia es de
  verificación explícita, no de implementación nueva.
- [X] T027 [US4] Ejecutar T025, confirmar verde.

**Checkpoint**: las cuatro historias de usuario están completas -- solo la identidad de la
atacante decide el mecanismo de cualquier impacto, en cualquier contexto (simple o mutuo).

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Cierre de la feature, consistencia con el resto del código, sin comportamiento nuevo.

- [X] T028 [P] Revisar comentarios de `push.ts`/`events.ts` en los puntos tocados (T001-T005,
  T011, T020-T023) -- documentar el porqué (research.md Decisión N referenciada donde aplique),
  mismo nivel de detalle que el resto del motor.
- [X] T029 Ejecutar `npm run typecheck` y `npm test` completos -- confirmar 0 regresiones en toda
  la suite existente (spec.md FR-009/SC-006).
- [X] T030 Ejecutar manualmente los 9 escenarios de quickstart.md contra el motor real, confirmando
  que las Success Criteria (SC-001 a SC-006) de spec.md se cumplen.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Foundational (Phase 1)**: sin dependencias -- puede empezar inmediatamente. BLOQUEA las cuatro
  historias.
- **User Story 1 (Phase 2)**: depende de Foundational (T003). Es el MVP -- sin ella, arcoíris nunca
  llega a estar "en vuelo" y ninguna otra historia tiene nada que probar.
- **User Story 2 (Phase 3)**: depende de Foundational y de User Story 1 (necesita que una arcoíris
  pueda quedar en vuelo para tener algo que verificar) -- pero no añade código nuevo, así que podría
  ejecutarse en paralelo con la fase 4 una vez la 2 esté lista.
- **User Story 3 (Phase 4)**: depende de Foundational (T001-T005) -- independiente de User Story
  1/2 en el código que toca (`applyMutualImpact`/`strikeMutualSide`, no `applyImpact`), pero
  comparte el mismo checkpoint de "toda la suite en verde" antes de darla por cerrada.
- **User Story 4 (Phase 5)**: depende de Foundational (T005) -- no añade código nuevo, es
  puramente confirmatoria.
- **Polish (Phase 6)**: depende de que las cuatro historias estén completas.

### Parallel Opportunities

- T003/T004 (las dos extracciones) pueden escribirse en paralelo -- funciones independientes
  dentro del mismo archivo, sin dependencia mutua.
- T007-T010 (tests de User Story 1) pueden escribirse en paralelo entre sí.
- T016-T019 (tests de User Story 3) pueden escribirse en paralelo entre sí, y en paralelo con
  T007-T010 (archivos de test distintos: `rainbow.test.ts` vs `push.test.ts`).
- Una vez completada la Phase 1, las Phases 2 y 4 pueden avanzar en paralelo (tocan partes
  distintas de `push.ts`: `applyImpact` vs `applyMutualImpact`/`strikeMutualSide`) -- Phase 3
  depende de que la 2 termine primero.
- T028 (Polish, documentación) es independiente de T029/T030.

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Completar Phase 1: Foundational.
2. Completar Phase 2: User Story 1 -- una arcoíris asentada deja de recolorearse a sí misma.
3. **PARAR Y VALIDAR**: quickstart.md Escenarios 1-3, `npm test` en verde.
4. Ya hay un cambio de comportamiento completo y probado, aunque las colisiones mutuas con
   arcoíris todavía lancen la excepción de siempre -- una arcoíris asentada nunca vuelve a
   recolorearse a sí misma en ningún impacto simple.

### Incremental Delivery

1. Foundational → Phase 2 (US1, MVP) → validar independientemente.
2. Phase 3 (US2) → confirma que arcoíris desplazada sigue actuando como atacante sin cambios.
3. Phase 4 (US3) → cubre las colisiones mutuas, el caso genuinamente nuevo de esta feature.
4. Phase 5 (US4) → confirma explícitamente que dos arcoíris en colisión mutua no necesitan nada
   más.
5. Phase 6 (Polish) → cierre.
