# Phase 0 Research: Fragilidad de fichas

## Cambio de semántica de resolución de cadenas (requerido por la constitución)

> "Las features que introducen nuevas primitivas de motor o cambian la semántica de resolución de cadenas DEBEN documentar el cambio y su razón en el plan.md de esa feature" — Development Workflow, constitución v1.1.0.

**Qué cambia exactamente**: `resolveStrike` (y sus vecinas `resolveSplit`/`resolveBranch`/`applyImpact` en `src/engine/pieces/push.ts`) dejan de recibir el color del golpeador como un `PieceColor` suelto y pasan a recibir la ficha completa (`Piece`, con su `fragility`). Dos consecuencias de comportamiento observable:

1. Cada vez que una ficha actúa como defensora de una colisión de distinto color, su fragilidad avanza un escalón antes de continuar la cadena (FR-002).
2. Cuando a una ficha (defensora en tránsito, O el propio golpeador) le toca asentarse en una casilla, esa colocación ahora se salta si su fragilidad es `'broken'` (FR-004) — incluida, por primera vez, la ficha originalmente lanzada desde la mano, que hasta ahora nunca se colocaba en ningún caso (spec.md 006, feature 008, queda derogada por FR-007/FR-008 de esta feature).

**Por qué**: es la generalización mínima del patrón ya existente ("quien golpea se asienta donde golpeó, salvo aniquilación") necesaria para soportar FR-002/FR-004 de forma uniforme en cada eslabón, y resulta que esa MISMA generalización, aplicada un nivel más arriba (en `applyImpact`, el llamador de primer nivel de `resolveStrike`), es exactamente lo que hace falta para FR-007/FR-008 sin ningún código dedicado a "la ficha lanzada" — se convierte en un eslabón más de la misma cadena, no en un caso especial.

## Decision: hilo de datos — `Piece` completo en vez de `PieceColor` suelto

**Decision**: `resolveStrike(board, striker: Piece, position, direction)` en vez de `resolveStrike(board, strikerColor: PieceColor, position, direction)`. Análogamente `resolveSplit`/`resolveBranch` reciben la ficha completa del defensor golpeado por rojo, no solo su color.

**Rationale**: la fragilidad de la ficha que golpea determina si ELLA se asienta al terminar su propio golpe (FR-004 aplicado a sí misma); la fragilidad de la ficha golpeada determina si ELLA avanza y, más adelante en la recursión, si se asienta en SU destino. Ambas piezas de información ya existían por separado en el código (`defender` se leía del tablero; `strikerColor` era un valor suelto) — la única extensión real es dejar de descartar la fragilidad del golpeador al pasarlo como parámetro.

**Alternatives considered**:
- *Mantener `PieceColor` y consultar la fragilidad por separado, indexando por posición*: descartado — obligaría a re-leer el tablero en varios puntos para recuperar información que ya se tiene en la mano en el momento en que se pasa el color, y es más frágil ante refactors futuros (literalmente, un lugar más donde desincronizar color y fragilidad).
- *Añadir un segundo canal de retorno separado ("¿se rompió?") en vez de comprobar `fragility==='broken'` antes de cada `setPieceAt`*: descartado — la comprobación "broken → no se coloca" es idéntica en los 3 puntos de asentamiento (golpeador consigo mismo en `applyImpact`, defensor en tránsito en `resolveStrike`, cada rama de `resolveBranch`), así que un canal de retorno extra sería una abstracción sin necesidad real, más código para el mismo resultado.

## Decision: dónde vive el avance de fragilidad y la comprobación de `'broken'`

**Decision**: el avance de fragilidad (`NEW→CRACKED→BROKEN`) ocurre en el único punto donde el código ya identifica "esta ficha acaba de ser golpeada por otra de distinto color" (justo después del chequeo de aniquilación por mismo color, antes de calcular `to`). La comprobación de `'broken'` ocurre en el único punto donde el código ya identifica "esta ficha se va a colocar aquí" (justo antes de cada `setPieceAt` que coloca una ficha que se ha desplazado o que ha golpeado con éxito). No se introduce ningún paso nuevo de "barrido" ni ninguna pasada adicional sobre el tablero.

**Rationale**: FR-005 exige explícitamente que la comprobación sea incremental, ficha a ficha, según se resuelve cada eslabón — no una pasada final. Enganchar la lógica exactamente en los puntos de mutación ya existentes (en vez de recorrer el tablero después) es la única forma de cumplir eso literalmente, y además es gratis en términos de complejidad (mismo número de mutaciones de tablero que hoy, ninguna nueva excepto la propia comprobación).

**Consecuencia derivada, no una decisión aparte**: FR-006 ("todas las eliminaciones se aplican antes de evaluar el goal") se cumple automáticamente, sin ningún cambio en `goal.ts` ni en `resolve-launch.ts` — para cuando `evaluateGoal` se invoca, el `board` que recibe ya es el resultado final de `resolveStrike`, que nunca llegó a colocar ninguna ficha rota en primer lugar. No hay nada que "aplicar antes"; nunca se colocó.

## Decision: `advance()` como función total, tipada para excluir `'broken'` en su entrada

**Decision**: `type Fragility = 'new' | 'cracked' | 'broken'`; la función que avanza un estado se tipa como `advance(f: 'new' | 'cracked'): 'cracked' | 'broken'` — un subtipo que excluye `'broken'` de la entrada a nivel de compilador, en vez de una función `Fragility → Fragility` con una rama defensiva `'broken' → 'broken'`.

**Rationale**: el propio spec (Edge Cases, Assumptions) ya establece que ninguna ficha puede ser golpeada más de una vez dentro del mismo lanzamiento (se apoya en la garantía de `012-fix-brown-cascade-loop`) y que una ficha de tablero `'broken'` nunca llega a existir como ficha golpeable (FR-016) — así que `advance()` NUNCA debería recibir `'broken'` como entrada real. Restringir el tipo de entrada convierte esa garantía en algo verificado por el compilador en vez de una rama de código que, si alguna vez se alcanzara, indicaría silenciosamente un fallo de una invariante distinta (más acorde con Principio III: el motor no debería tener ramas "no debería pasar nunca" sin verificar).

**Alternatives considered**: función total `Fragility → Fragility` con `'broken' → 'broken'` como no-op. Descartado por la razón anterior — preferible que un caso realmente imposible sea un error de tipos, no una rama silenciosa.

## Decision: dónde se aplica la normalización de FR-016 (ficha de tablero BROKEN → casilla vacía)

**Decision**: dentro de `createLevel` (`src/engine/level.ts`), que ya es el único punto de construcción compartido entre niveles de prueba escritos a mano, fixtures de test, y (en el futuro, si se retoma) el generador — una ficha de `pieces` (tablero) cuya fragilidad declarada sea `'broken'` simplemente no se coloca en el tablero resultante.

**Rationale**: `createLevel` es exactamente la "finalización del nivel" a la que se refería la clarificación del spec ("cribado al guardar/finalizar el nivel") — es el único lugar por el que TODO nivel pasa antes de ser jugable, así que aplicar la normalización ahí garantiza que ningún caller (actual o futuro) pueda saltársela por accidente. No se necesita ningún cambio en el motor de resolución de lanzamientos ni ninguna validación en tiempo de carga separada.

**Alternatives considered**: validar/normalizar en cada sitio que construye niveles (tests, generador) por separado. Descartado — duplica la regla en varios lugares y depende de que cada autor futuro se acuerde de aplicarla.

## Decision: rojo y fragilidad — consecuencia emergente a documentar, no a mitigar

**Observación** (no una decisión de diseño nueva — ya cerrada en el spec, FR-015): si una ficha `CRACKED` es golpeada por rojo, avanza a `BROKEN` antes de dividirse, y **ambas ramas resultantes heredan ese mismo estado `BROKEN`** — así que, al intentar asentarse cada una en su destino, ninguna de las dos se coloca. El resultado observable es que golpear con rojo a una ficha ya `CRACKED` la elimina por completo (ninguna rama sobrevive), mientras que golpear con rojo a una ficha `NEW` produce dos ramas `CRACKED` que sí sobreviven. Esto es una consecuencia directa y ya decidida de FR-015 (no una ambigüedad nueva), pero merece quedar documentada explícitamente aquí porque tiene una implicación táctica notable: rojo se convierte en la única forma de eliminar dos fichas de golpe a partir de una sola ficha ya dañada.

## Renderer: alcance de la Historia 3 (representación visual)

**Decision**: `board-view.ts::drawBoard` ya calcula el color de relleno de cada ficha a partir de `PIECE_COLOR[piece.color]`; se añade una variación visual (a decidir en tasks — opacidad reducida, borde, o anillo superpuesto según `piece.fragility`) leyendo el nuevo campo, sin tocar ninguna lógica de reglas. Es el único punto de la interfaz que dibuja fichas de tablero directamente con `Graphics` (no hay sprites/texturas por pieza todavía).

**Rationale**: mantiene el Principio I intacto (el renderer solo lee estado del motor) y confirma que la Historia 3 es un cambio contenido y de bajo riesgo, independiente del mecanismo del motor (Historias 1 y 2), consistente con su prioridad P3 en el spec.

**Alternatives considered**: ninguna evaluada en profundidad todavía — el tratamiento visual concreto (qué combinación de opacidad/borde/icono) es una decisión de diseño de UI, no arquitectónica, y se deja para la fase de tasks/implementación.
