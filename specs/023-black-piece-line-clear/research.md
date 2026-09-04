# Phase 0 Research: Ficha Negra (Limpieza de Línea)

## Decisión 1: Limpieza de línea reutiliza la semántica de ANNIHILATION, no un evento nuevo

**Decisión**: Una limpieza de línea no introduce un nuevo tipo de `ChainEvent`. Cada ficha
eliminada por la limpieza (incluida la propia ficha disparadora, FR-004) produce su propio
`ANNIHILATION` — el mismo tipo ya usado por la regla de mismo color — con `from`/`direction`
iguales a su propia posición (`from === at`, sin desplazamiento fabricado), salvo la ficha
disparadora, cuyo `from`/`direction` reflejan su impacto real. Todas comparten la misma casilla
de impacto como origen causal para el renderer (ver Decisión 3).

**Rationale**: `ANNIHILATION` ya documenta exactamente la semántica que FR-005 exige — "una
ficha eliminada... no ejecuta su propio efecto" — para el caso de dos fichas. Generalizar su
USO (muchas fichas a la vez, no solo un par) en vez de inventar un tipo nuevo mantiene el
vocabulario de eventos pequeño (Principio V) y, más importante, reutiliza integramente la
maquinaria de animación ya construida por 022-parallel-branch-animation para "varios hermanos
nacidos de la misma casilla, animados en paralelo" (`computeEventParents` agrupa por `from`
compartido) — cero código nuevo de renderer para la propia animación de desaparición.

**Alternatives considered**:
- Un tipo `LINE_CLEAR` agregado (una lista de casillas en un solo evento): más compacto en el
  log, pero exige que el renderer aprenda a animar "N desapariciones simultáneas" desde cero en
  vez de reutilizar `computeEventParents`/`ANNIHILATION` ya existentes y ya probados. Rechazado
  por duplicar maquinaria ya construida sin necesidad.
- Un `MOVE_STEP` con `piece.fragility` forzada a un valor que nunca se asienta: no encaja — la
  ficha no se mueve a ningún sitio, y `MOVE_STEP` documenta explícitamente que SIEMPRE escribe
  `to` salvo que la fragilidad sea `broken`, una semántica que no aplica aquí (una ficha `new` o
  `cracked` cualquiera puede ser barrida). Rechazado por forzar un significado que no le
  corresponde a `MOVE_STEP`.

## Decisión 2: Es un caso NUEVO, justificado explícitamente (Principio V)

**Decisión**: "Vaciar todas las casillas ocupadas de una fila o columna completa en una sola
interacción" no se puede expresar como una composición de `MOVE_STEP` + política de colisión +
repetición + ramificación — ninguna de esas primitivas modela múltiples desapariciones
simultáneas en fichas que nunca se mueven. Es una regla de interacción genuinamente nueva,
igual que lo fue la ramificación de rojo en su momento (spec.md 009). Lo que SÍ reutiliza es la
semántica de resultado ya existente (`ANNIHILATION`, Decisión 1) — el escaneo de la línea es
nuevo, la manera de reportar cada desaparición no lo es.

**Rationale**: Cumple explícitamente con el Principio V ("una primitiva genuinamente nueva
requiere justificación explícita en el plan.md correspondiente") documentando por qué las
primitivas existentes no bastan, en vez de forzar el nuevo comportamiento dentro de
`MOVE_STEP`/`PUSH_STRATEGY` de forma artificial.

**Alternatives considered**:
- Modelar la limpieza como 8 `MOVE_STEP`s con `collision=true` disparados en cadena a lo largo
  de la línea: no corresponde — ninguna ficha real viaja de una casilla a la siguiente, y
  forzaría 8 eventos con una `direction`/`from` inventados sin relación con lo que realmente
  ocurre. Rechazado por no reflejar honestamente el estado.

## Decisión 3: Precedencia — negro como defensora gana sobre CUALQUIER mecánica del atacante, incluida la de rojo

**Decisión**: Cuando cualquier ficha golpea a una negra ya asentada (FR-003), la limpieza de
línea se dispara SIEMPRE, sin excepción por el color de quien golpea — incluido rojo. Es decir,
si rojo golpea a una negra, NO se produce la ramificación habitual de rojo (spec.md 009,
FR-002): en su lugar se limpia la línea correspondiente. La comprobación de "la defensora es
negra" se sitúa en `applyImpact` (`push.ts`) en el MISMO punto de prioridad que la regla de
mismo color ya existente — antes de cualquier rama específica de color del atacante (incluida
`if (site.piece.color === 'red')`).

**Rationale**: Esta pregunta no estaba resuelta explícitamente en spec.md — surgió durante esta
fase de investigación al revisar cómo `applyImpact` decide qué hacer con un defensor, y merece
quedar documentada aquí en vez de dejarse implícita en el código. El precedente ya existente en
el propio motor es exactamente este: la regla de mismo color YA tiene prioridad sobre la
ramificación de rojo (red.test.ts, spec.md 009 FR-006: "cuando una ficha roja golpea a una
ficha del MISMO color... sin ninguna división") — es decir, una regla universal ligada al color
de la DEFENSORA ya gana sobre el comportamiento específico del atacante en este motor. Extender
esa misma prioridad a negro (otra regla universal ligada al color de la defensora) es la opción
consistente con el patrón ya establecido, no una decisión arbitraria nueva.

**Alternatives considered**:
- Rojo conserva su ramificación incluso contra una negra (produciría dos fichas negras que,
  cada una en su propio camino, podrían a su vez disparar sus propias limpiezas si encuentran
  algo): más "combo", pero contradice la lectura más directa de FR-003 ("cuando sea golpeada por
  OTRA ficha... limpia") y no tiene ningún precedente ya establecido en el motor que lo respalde.
  Queda descartada como comportamiento por defecto; si el usuario prefiere esta alternativa tras
  ver el resultado, es un cambio de una sola condición en `applyImpact`, no un rediseño.

## Decisión 4: Negro nunca es una trayectoria en vuelo — no participa en colisiones mutuas

**Decisión**: A diferencia de verde/naranja/marrón (que SÍ pueden convertirse en el `nextSite`
de una defensora empujada, y por tanto SÍ pueden acabar como uno de los dos lados de una
colisión mutua vía `applyMutualImpact`/`strikeMutualSide`, 019/022), negro nunca produce un
`nextSite` — su propia interacción (limpiar la línea) es siempre terminal, tanto si negro es
quien golpea como si es la defensora golpeada. No se necesita ningún cambio en
`applyMutualImpact`/`strikeMutualSide` para esta feature.

**Rationale**: Confirmado por FR-004 (la ficha disparadora también desaparece, nunca continúa)
— negro no tiene mecanismo de empuje propio (no hay entrada en `PUSH_STRATEGY` para negro, igual
que no la hay para rojo) NI dispensa un `nextSite` para su propia defensora (esa defensora, junto
con todo lo demás en la línea, desaparece en vez de continuar). No hay ningún camino por el que
una ficha negra entre en la cola FIFO como trayectoria en curso.

**Alternatives considered**: N/A — se confirma la ausencia de un caso a resolver, no se elige
entre alternativas.

## Decisión 5 (encontrada en verificación visual, no prevista en el plan original): dos bugs de renderer expuestos por primera vez por `from === at`

**Contexto**: T019 (verificación visual manual) reprodujo un lanzamiento real de negra por una
fila con tres fichas repartidas y encontró dos problemas reales que ningún test unitario había
cubierto, porque NINGÚN evento `ANNIHILATION` anterior a esta feature tenía nunca `from === at`
(Decisión 1) — todo `ANNIHILATION` previo venía de una ficha que sí había viajado antes de
colisionar.

**Bug 1 -- `cellPath`/`walkPath` no sabían animar una distancia cero**: `cellPath(from, to, ...)`
siempre da al menos un paso ALEJÁNDOSE de `to` antes de comprobar si ha llegado -- si `from` y
`to` son la MISMA casilla, nunca puede volver a coincidir con `to` hasta completar una vuelta
entera al tablero (o, en el peor caso, el tope de `size*3` pasos). Cada ficha barrida por la
limpieza recorría visiblemente toda su fila o columna antes de desvanecerse, en vez de
desaparecer donde ya estaba. Arreglado en `launch-animation.ts`: la rama `ANNIHILATION` de
`runEvent` ahora comprueba `from === at` primero y, si es así, se desvanece directamente, sin
llamar a `cellPath`/`walkPath` en absoluto.

**Bug 2 -- las fichas barridas se animaban una detrás de otra, no juntas**: como ninguna ficha
barrida comparte `from` con otra (cada una es `from === at`, su propia casilla, distinta de las
demás), el agrupamiento por `from` compartido de `computeEventParents` (022-parallel-branch-
animation) no las reconoce como hermanas. La caída de respaldo existente (`parents[j] = j - 1`,
pensada para el caso de una colisión mutua con un único origen invisible) encadenaba cada ficha
barrida a la anterior, así que se animaban en serie -- una fila de tres fichas tardaba tres veces
más de lo esperado, y ninguna transmitía la sensación de "barrido" simultáneo.

**Decisión**: en vez de fabricar un `from` compartido falso (que reintroduciría exactamente el
desplazamiento inventado que la Decisión 1 rechaza), se generalizó `computeEventParents` para
que la caída de respaldo se propague: si el evento inmediatamente anterior TAMBIÉN cayó por
respaldo (no encontró una coincidencia real), el nuevo evento adopta el MISMO padre que él, en
vez de encadenarse a él -- colapsando toda una tanda consecutiva de eventos sin causa real
conocida en un único grupo de hermanas, en lugar de una cadena. Verificado que el caso ya
existente (022, colisión mutua) da exactamente el mismo resultado que antes -- el evento previo a
esa tanda SÍ tenía una coincidencia real, así que la cadena original queda intacta; el nuevo
comportamiento solo se activa cuando NINGÚN evento de la tanda tiene una causa real registrada,
como en una limpieza de línea.

**Rationale**: Ambos arreglos son generales (no específicos de negro) y quedan documentados como
descubrimientos legítimos de esta feature, no como deuda pendiente -- exactamente el patrón ya
seguido por 022 (bugs de animación encontrados jugando, arreglados y testeados en el mismo ciclo).
Verificado en vivo tras el arreglo: las cuatro fichas (tres barridas + la propia negra)
desaparecen juntas, sin dar ninguna vuelta al tablero.

## Decisión 6 (encontrada por el usuario tras la PR, editando `levels/2.json` a mano): la propia negra podía spawnear fuera del tablero

**Contexto**: usando un nivel donde `orange` está sentada exactamente en la primera casilla de un
carril, lanzar negro por ese carril produce un "impacto inmediato" -- cero casillas recorridas
antes de chocar. En ese caso, `resolve-launch.ts` (código preexistente, sin cambios de esta
feature) calcula el `from` del evento como `step(hitAt, opuesto(direction))`, y como `step` nunca
envuelve, el resultado cae literalmente fuera del tablero (p.ej. `{row:0, col:-1}` para un impacto
en `(0,0)` lanzado hacia el Este) -- la misma clase de bug que el "green lanzado al oeste" arreglado
en una ronda anterior (`isOnBoard`, launch-animation.ts).

`applyImpact`'s black branch devolvía `events: [...sweepEvents, triggerEvent]` -- las fichas
barridas primero, la propia negra al final. Eso significa que, en el escenario de impacto
inmediato, la propia negra NUNCA era `events[0]`, así que nunca se beneficiaba de la protección ya
existente en `playEventLog`/`playNode` (`isFirstEvent`, que sustituye el `from` real por
`entryCoordinate` para el primer evento de cualquier lanzamiento). Sin `visualOrigin` tampoco
(nunca hubo colisión mutua), `leadIn` era `falsy`, así que `spawnAt = event.from` directamente --
el círculo de la ficha negra aparecía dibujado una casilla fuera del borde izquierdo del tablero
en vez de sobre `orange`. Confirmado visualmente (captura con zoom) antes del arreglo.

**Arreglo**: reordenar el return de la rama negra a `events: [triggerEvent, ...sweepEvents]` --
la propia negra primero. No hizo falta ningún cambio en `launch-animation.ts`: en cuanto la propia
negra vuelve a ser `events[0]`, hereda la protección `isFirstEvent` ya existente (spawnea en
`entryCoordinate`, que para un impacto inmediato coincide exactamente con la casilla de destino) y
la guarda `isOnBoard(event.from, ...)` que ya existía (línea ~588) evita intentar el glide de
entrada usando un `from` inválido, cayendo directamente en `runEvent`. Ahí, `cellPath` resuelve el
paso desde el `from` fuera de tablero en un solo paso gracias a que su aritmética (`wrapIndex`) ya
es modular -- el desplazamiento de "una casilla fuera, en la dirección opuesta al lanzamiento" se
deshace exactamente con el primer paso en la dirección del lanzamiento, sin necesidad de tratarlo
como un caso especial adicional.

Verificado: reordenar no rompe `computeEventParents`/`wasOrphan` (los eventos `ANNIHILATION` nunca
son candidatos a "match" real -- `if (candidate.type !== 'MOVE_STEP') continue` --, así que el
agrupamiento de hermanas es el mismo sea cual sea el orden), test de regresión añadido en
`black.test.ts` fijando `events[0]` como la propia negra para este escenario exacto, y verificado
en vivo de nuevo sobre `levels/2.json` (el mismo nivel que el usuario editó a mano para reportarlo):
la fila entera desaparece junta, sin ningún círculo fuera del tablero.

## Technical Context resuelto

- **Language/Version**: TypeScript (Node.js), mismo stack que el resto del motor (`src/engine/`)
  y renderer (`src/renderer/`, Phaser 3).
- **Primary Dependencies**: Ninguna nueva. Reutiliza `src/engine/board.ts`
  (`getPieceAt`/`setPieceAt`/`isInBounds`), `src/engine/events.ts` (`ChainEvent`, en concreto
  `AnnihilationEvent`, sin cambios de forma), y la maquinaria de animación de siblings ya
  construida en `src/renderer/launch-animation.ts` (`computeEventParents`,
  022-parallel-branch-animation).
- **Storage**: N/A.
- **Testing**: Vitest, mismo patrón que `red.test.ts` — un fichero dedicado nuevo
  `tests/unit/engine/black.test.ts`, más los casos de precedencia (Decisión 3) añadidos donde ya
  se testea la interacción rojo-defensora (`red.test.ts` o `push.test.ts`, el que ya cubra ese
  punto exacto de `applyImpact`).
- **Target Platform**: Motor headless (`src/engine/`) + integración mínima de renderer
  (`src/renderer/`) para que la pieza sea jugable/observable desde `dev-levels.html`, siguiendo
  el orden ya establecido por la constitución (spec → motor con tests → integración en el
  renderer). El soporte en `tools/generator/` (que el generador de niveles pueda construir y
  invertir niveles usando negro) queda explícitamente fuera de alcance — mismo patrón que
  009-red-piece (motor) seguido, más tarde, por 020-generator-red-support (generador) como
  feature separada.
- **Performance Goals**: N/A — escanear una línea de 8 casillas es trabajo constante y
  despreciable frente al resto de la resolución de una cadena.
- **Constraints**: FR-008 — ninguna regla ya existente (verde/naranja/marrón/rojo, mismo color,
  wrap-around) cambia de comportamiento, salvo la única excepción documentada y justificada en
  la Decisión 3 (rojo cede su ramificación cuando la defensora es negra, exactamente como ya
  cede ante la regla de mismo color).
- **Scale/Scope**: Motor (`board.ts` para el color nuevo; `push.ts`/`events.ts` para la regla de
  limpieza) + renderer (`board-view.ts` para el color visual; `sound-effects.ts` para un sonido
  propio, opcional) + tests dedicados. Sin cambios de esquema de niveles ni en
  `tools/generator/`.

## Decisión 7 (revoca la Decisión 3 -- reportada por el usuario durante la sesión de 024-rainbow-color-change): negro NUNCA tiene prioridad como defensora; solo se activa cuando ELLA MISMA impacta

**Contexto**: la Decisión 3 (arriba) estableció que negro, como defensora, gana SIEMPRE sobre
cualquier mecánica del atacante -- incluida la de rojo. Probando en vivo (nivel 2 modificado a
mano, con una negra añadida al tablero), el usuario reportó dos problemas reales con esa regla:
(1) la limpieza se disparaba ANTES de que la ficha lanzada llegara siquiera a tocar la negra
(un problema de TIMING de animación, ya arreglado por separado -- 024, Decisión 12 de ese mismo
research.md); y (2), más fundamental, la limpieza se disparaba SIEMPRE al golpear a una negra
asentada, incluso cuando eso no tenía sentido -- p. ej. verde golpeando a una negra en una
columna vacía, donde la negra simplemente debería desplazarse una casilla y avanzar su
fragilidad, sin limpiar nada, exactamente como pasaría con cualquier otro color.

**Decisión (nueva, revoca la Decisión 3)**: negro deja de tener CUALQUIER prioridad como
defensora. La única comprobación que queda en `applyImpact` es `site.piece.color === 'black'`
(negro es la ATACANTE de este impacto concreto) -- exactamente el mismo nivel/patrón que ya
ocupa la ramificación de rojo (`site.piece.color === 'red'`), nunca `defender.color === 'black'`.
Cuando negro es la DEFENSORA, cae directamente en el camino genérico ya existente para
cualquier otro color:

- Atacante verde/naranja/marrón → negro se desplaza usando el `PUSH_STRATEGY` de ESE atacante
  (misma dirección, 1/2/N casillas) -- FR-002 corregido: "la dirección que tomará la ficha negra
  vendrá determinada por la ficha que la ha golpeado."
- Atacante rojo → negro se divide en dos ramas perpendiculares vía `resolveRedSplit`, exactamente
  como cualquier otra defensora golpeada por rojo.
- Atacante arcoíris (024) → negro cambia de color como cualquier otra defensora (arcoíris ya no
  cede ante negro -- ver 024, Decisión 3, actualizada junto con este cambio).

Ese desplazamiento (o cada rama de la división de rojo) se reencola como un `ImpactSite` normal
con `piece.color: 'black'` -- si esa nueva casilla está VACÍA, negro simplemente se asienta ahí
(fragilidad ya avanzada por el camino genérico, sin ningún evento de limpieza). Si esa nueva
casilla está OCUPADA, negro pasa a ser la ATACANTE de ESE impacto siguiente -- y AHORA SÍ, su
propio efecto se dispara, en la dirección en la que negro estaba viajando en ese momento
(heredada del atacante original, o de la rama de rojo que la desplazó). Esto reutiliza
literalmente la infraestructura de cola ya existente (`resolveChain`/`nextSites`) sin ningún
código nuevo -- una vez estrechada la condición a `site.piece.color === 'black'`, todo lo demás
(el que negro solo se active al impactar, con la dirección heredada correcta) sale gratis del
mecanismo genérico que YA procesa cualquier otro color desplazado.

**Verificado contra el motor real** (no asumido) antes de fijarlo como expectativa en los tests:
un caso incluso reveló un efecto emergente correcto -- verde empuja a negra hacia una fila con
más fichas; negra golpea a una roja ya asentada ahí, se convierte en atacante, y limpia TODA la
fila en su propia dirección (oeste) -- incluida la propia verde, que ya se había asentado en esa
misma fila un paso antes. No es un bug: es la composición natural de "verde empuja" +
"negro-atacante limpia su línea", exactamente el espíritu del Principio V (primitivas
composables).

**Impacto en 024 (arcoíris)**: FR-009/Decisión 3 de 024-rainbow-color-change quedan corregidas en
el mismo cambio -- arcoíris ya no cede ante una negra asentada (negro no tiene prioridad de
defensora que ceder), así que arcoíris gana normalmente contra una negra defensora. Negro-como-
ATACANTE sigue ganando siempre sobre arcoíris, sin cambios (igual que ya ganaba sobre rojo).

## Decisión 8 (reportada por el usuario, un efecto colateral real de la Decisión 7): el salto de naranja no se veía cuando el desplazamiento terminaba en ANNIHILATION, no en MOVE_STEP

**Contexto**: al probar la Decisión 7 (negro ahora SÍ puede ser empujada por naranja, algo antes
imposible -- negro estaba intercept ada antes de llegar nunca al camino genérico de empuje), el
usuario reportó que naranja empujando a una negra "impacta bien en la segunda casilla saltando la
primera, pero no se ve saltar" -- el desplazamiento de 2 casillas era correcto, pero la animación
no mostraba el arco/burbuja característico de naranja. Reproducido headlessly: cuando el
desplazamiento de 2 casillas termina en OTRA ficha del MISMO color (aniquilación) -- o, desde la
Decisión 7, en negro disparando su propia limpieza tras ser empujada -- el evento resultante es un
`ANNIHILATION`, no un `MOVE_STEP`. `AnnihilationEvent` nunca tuvo un campo `pushedByColor`
(a diferencia de `MoveStepEvent`, que sí lo tiene desde 018), así que `orangeJumpMidpoint`
siempre devolvía `null` para él, sin importar la distancia real recorrida -- el renderer caía
siempre al camino de `cellPath`/`walkPath` genérico (línea recta, sin arco).

**Importante**: este bug NO es exclusivo de negro -- es general, y ya existía antes de esta
sesión (verificado: naranja empujando un verde hacia OTRO verde, 2 casillas, tenía el mismo
problema). Simplemente nunca se había notado porque, hasta ahora, ningún playtest había producido
una combinación tan directa "empuje de naranja termina justo en una aniquilación" -- la
combinación de dos negras separadas exactamente 2 casillas del nivel 2 (modificado a mano por el
usuario) lo hizo evidente por primera vez.

**Arreglo**:
1. `AnnihilationEvent` gana un campo `pushedByColor?: PieceColor` (`events.ts`), igual que ya
   tiene `MoveStepEvent`.
2. Cada punto de `push.ts` que construye un `ANNIHILATION` (mismo color en `applyImpact`, mismo
   color en `applyMutualImpact`, el evento disparador de negro, y el evento de desaparición de la
   atacante en el cambio de color de arcoíris) pasa `pushedByColor: site.pushedByColor` /
   `siteA.pushedByColor` -- el dato YA estaba disponible en el `ImpactSite`, solo faltaba
   propagarlo al evento.
3. `orangeJumpMidpoint` (`launch-animation.ts`) pasa a aceptar `MoveStepEvent | AnnihilationEvent`
   (antes solo el primero), usando `.to` o `.at` según corresponda para la geometría.
4. La animación de salto (marcador + arco de dos tramos) se extrajo a una función compartida
   (`playOrangeJump`) para que la rama `ANNIHILATION` de `runEvent` pueda usarla también, en vez
   de duplicar ese código -- termina en un `fade` (la ficha se desvanece) en vez de en `finish`
   directamente (la ficha se asienta), la única diferencia real entre los dos casos.

**Verificado**: nuevo test dedicado en `launch-animation.test.ts` (`orangeJumpMidpoint` sobre un
evento `ANNIHILATION` real, verificado contra el motor) más las 4 correcciones mecánicas a tests
ya existentes que ahora ven el campo `pushedByColor` nuevo en sus propias aserciones. `npm test`
en verde (258/258).

