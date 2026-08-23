# Phase 0 Research: Lanzamiento y Cadena de Ficha Verde

No quedan `NEEDS CLARIFICATION` en el Technical Context del plan — el lenguaje, testing y
alcance ya estaban fijados por la constitución y por las respuestas de `/speckit-clarify`. La
investigación de esta fase se centra en tres decisiones de diseño técnico que el propio
documento de diseño del juego deja abiertas ("Decisiones de diseño pendientes", sección 13) y
que esta historia necesita resolver para poder implementarse.

## Decisión 1: Estructura de la cola de eventos

**Decision**: Cola FIFO (array/lista simple), procesada de forma iterativa (bucle `while queue
not empty`), no recursiva.

**Rationale**: En esta historia, cada interacción genera como máximo un evento nuevo (la ficha
verde compone un único MOVE_STEP adicional por impacto — no hay ramificación todavía, eso llega
con la ficha roja en una historia posterior). Con un único evento en vuelo en todo momento, FIFO
y LIFO son equivalentes en comportamiento observable, así que no hay razón para no elegir ya la
estructura que escalará sin cambios cuando se introduzca la ramificación (rojo): una cola FIFO
procesa las ramas en el orden en que se generan, que es el comportamiento más predecible y fácil
de razonar cuando aparezcan varios eventos pendientes a la vez. Procesar iterativamente (no por
recursión) evita cualquier riesgo de profundidad de pila cuando las cadenas se alarguen.

**Alternatives considered**:
- *Pila (LIFO)*: descartada — no aporta nada en esta historia (un solo evento en vuelo) y, cuando
  haya ramificación, procesar en orden "depth-first" es más difícil de razonar/testear que
  "breadth-first" (FIFO) para alguien diseñando niveles.
- *Resolución recursiva sin cola explícita*: descartada — funciona igual de bien para cadenas
  cortas, pero no deja un "log" natural de eventos ordenado y no se alinea con el modelo
  conceptual del propio documento de diseño ("Sistema de eventos... Stack/Queue").

## Decisión 2: Registro de eventos aplicados (event log)

**Decision**: `resolveLaunch` devuelve, además del estado final, la lista ordenada de eventos
`MOVE_STEP` efectivamente aplicados durante la resolución.

**Rationale**: No añade complejidad relevante ahora (es simplemente acumular lo que ya se genera
internamente) y evita un cambio de forma en la API pública más adelante: el documento de diseño
anticipa explícitamente una futura historia de "animación/reproducción de una cadena de eventos
sin alterar la semántica determinista del motor" (sección 13). Decidir el log ahora, aunque no se
consuma todavía, evita romper contratos ya usados por otras historias cuando llegue esa historia.

**Alternatives considered**:
- *No registrar nada, añadirlo cuando haga falta*: descartada — cambiaría la forma del tipo de
  retorno público (`LaunchOutcome`) después de que otras historias ya dependan de él, generando
  trabajo de migración evitable.

## Decisión 3: Representación del nivel de prueba

**Decision**: El nivel de prueba de esta historia se define como un objeto TypeScript literal que
implementa el tipo `Level` (ver data-model.md), vivo en `src/engine/level.ts`, no como un fichero
`.json` externo.

**Rationale**: El Principio IV de la constitución exige niveles como "datos declarativos
JSON/TS", y un objeto TS literal cumple esa exigencia con el beneficio añadido de chequeo de
tipos en tiempo de compilación — sin necesitar todavía ninguna infraestructura de carga de
ficheros (parseo, validación de esquema) que esta historia no necesita.

**Alternatives considered**:
- *Fichero `.json` externo*: descartada por ahora — añade E/S y parseo/validación sin ningún
  beneficio para una única historia con un único nivel; el tipo `Level` es el mismo tanto si el
  dato vive en TS como en JSON, así que migrar más adelante (cuando exista un generador/validador
  de niveles, historia P3 del roadmap) no rompe el contrato.
