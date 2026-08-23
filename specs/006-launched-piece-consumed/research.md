# Phase 0 Research: La Ficha Lanzada Nunca Permanece en el Tablero

## Decisión: `resolveStrike` no necesita ningún cambio — el arreglo vive solo en `applyImpact`

- **Decisión**: `resolveStrike` (la función recursiva que resuelve toda la cadena) ya deja
  `site.to` vacío en TODOS los casos antes de que `applyImpact` decida qué hacer con la ficha
  lanzada:
  - Empuje simple a casilla vacía: `setPieceAt(setPieceAt(board, position, null), to, defender)`
    — `position` (=`site.to` en la llamada de nivel superior) queda `null`.
  - Cascada (empuje que golpea otra ficha): `clearedPosition = setPieceAt(next.board, position,
    null)` — `position` queda `null` sea cual sea el resultado de `next`.
  - Aniquilación en el primer impacto: `setPieceAt(board, position, null)` — `position` queda
    `null`.
  - Aniquilación en un eslabón posterior: idéntico al caso de cascada — `position` (el impacto
    original) queda `null` igualmente, porque `next.annihilated` solo decide si SE COLOCA
    `defender` en `to`, no si se limpia `position`.
- **Rationale**: dado que `site.to` siempre queda vacío tras `resolveStrike`, la única razón por
  la que la ficha lanzada aparecía en el tablero era el propio `applyImpact`
  re-rellenándolo con `setPieceAt(result.board, site.to, site.piece)`. Quitar esa línea es el
  arreglo completo — no hace falta tocar `resolveStrike` en absoluto.
- **Alternatives considered**: modificar `resolveStrike` para que "recuerde" de algún modo que
  el striker original era la ficha de la mano — descartado por innecesario: `applyImpact` ya
  sabe perfectamente qué pieza lanzó (`site.piece`) y ya no necesita hacer nada con ella salvo
  no colocarla.

## Decisión: se elimina también el evento de "llegada" de la ficha lanzada

- **Decisión**: el `arrivalEvent` (`MOVE_STEP` de `site.piece` desde `site.from` hasta
  `site.to`) que `applyImpact` emitía junto con la colocación desaparece por completo, no solo
  la colocación.
- **Rationale**: un `MoveStepEvent` afirma que una ficha se movió A una casilla — mantener ese
  evento sin la colocación real dejaría el registro de eventos afirmando algo que el tablero
  final contradice. Ahora mismo nada consume `EventLog` para animación (el renderer de Fase 2
  lee directamente el tablero final, sin reproducir eventos — decisión ya tomada en 005), así
  que no hay ningún consumidor real al que esto rompa. `chain.test.ts` solo exige
  `events.length >= 1` y que todos sean `MOVE_STEP` — ambas cosas se siguen cumpliendo con los
  eventos que ya genera `resolveStrike` internamente (los de las fichas que sí se mueven de
  verdad).
- **Alternatives considered**: mantener el evento pero añadir un campo/tipo nuevo que marque
  "esta ficha no persiste" — descartado por prematuro: el propio documento de diseño del juego
  deja la animación de la cadena de eventos como "decisión de diseño pendiente" explícita; no
  hay necesidad real todavía de resolver esa semántica.

## Decisión: `applyImpact` deja de ramificar sobre `result.annihilated`

- **Decisión**: con la ficha lanzada nunca colocada, `applyImpact` no necesita distinguir entre
  "el impacto aniquiló" y "el impacto empujó" — en ambos casos devuelve directamente
  `{ board: result.board, events: result.events, nextSites: [] }`.
- **Rationale**: simplificación directa, no una decisión de diseño nueva — el `if
  (result.annihilated)` solo existía para decidir si colocar `site.piece`; al desaparecer esa
  colocación, la rama entera queda muerta.

## Alcance de la investigación: qué fixtures/tests dependían del comportamiento incorrecto

Se revisaron los 8 ficheros de test del motor (`launch`, `chain`, `objective`, `determinism`,
`orange`, `same-color`, `wrap-around`, `move-step`) más `session.test.ts` (feature 005), y los
10 niveles de `prototype-levels.ts`. Solo dependen de que la ficha lanzada se asentara:

- `orange.test.ts` — 2 aserciones (`cells[3][4]` en el test de salto simple; `cells[5][4]` en el
  de cascada mixta, ya comentado "launcher settled here" en el propio test).
- `same-color.test.ts` — el test de cascada sobre `testLevelSameColorCascade01`, cuyo *objetivo
  mismo* (`green@(7,4)`) era la posición de la ficha lanzada.
- `wrap-around.test.ts` — 1 aserción (`cells[2][7]`), la misma que en la sesión de 004 se
  "corrigió" de `null` a `{color:'green'}` bajo el supuesto (incorrecto, según se determina
  ahora) de que ese era el comportamiento deseado. Vuelve a `null`, esta vez por el motivo
  correcto.
- `prototype-levels.ts` (feature 005) — niveles 3 y 7, ambos diseñados deliberadamente para
  ejercitar "empuje que cascada hasta una aniquilación en el segundo eslabón", con el objetivo
  puesto en la ficha lanzada.

Todo lo demás (missclick, distancias por color, wrap-around en sí, aniquilación en el primer
impacto, cascadas entre fichas ya colocadas, determinismo) es independiente de este cambio y no
necesita tocarse.

## Decisión: cómo rediseñar los niveles/fixture afectados

- **Decisión**: en vez de intentar que la ficha lanzada "llegue" a alguna parte (ya no puede,
  por definición), cada nivel afectado se redefine como una demostración de la MISMA regla
  (aniquilación por mismo color) pero situándola como el PRIMER impacto de un lanzamiento,
  seguida (para los niveles del prototipo, que necesitan ser ganables) de un segundo lanzamiento
  que empuja una ficha real hasta el objetivo. `testLevelSameColorCascade01` (fixture interna,
  no necesita ser "ganable" por un jugador) se redefine para verificar que la aniquilación en un
  eslabón posterior también deja a la ficha lanzada fuera del tablero, aceptando `'lost'` como
  resultado correcto ya que nada sobrevive en esa fila.
- **Rationale**: mantiene el valor de test/demostración original de cada uno (mismo color,
  cascada) sin inventar una mecánica nueva no soportada por el motor.
- **Alternatives considered**: intentar diseñar un tercer nivel/fixture con una pieza adicional
  para que ALGO termine en la celda del impacto original — descartado porque esa celda queda
  estructuralmente vacía siempre que la aniquilación ocurra ahí; no hay forma de que otra ficha
  la ocupe en el mismo lanzamiento sin cambiar la regla misma.
