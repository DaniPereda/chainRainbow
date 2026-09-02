# Phase 0 Research: Resolución de Colisiones Casilla a Casilla

## Decisión 0 -- Confirmación empírica del bug antes de diseñar nada

Antes de diseñar la solución, se reprodujo el ejemplo exacto del usuario contra el motor YA CORREGIDO por 020's propios fixes (incluido el más reciente, `findCoincidingPair` exigiendo casilla vacía) para confirmar que el bug más profundo sigue presente, y para verificar CUÁL es el comportamiento correcto esperado.

**Board real** (`levels/2.json`, editado a mano): brown en `(5,5)`, green en `(5,6)` y `(5,4)`. Rojo lanzado hacia el norte o el sur en el carril 5 golpea a brown, dividiéndolo en rama E (golpea green en `(5,6)`) y rama O (golpea green en `(5,4)`).

**Comportamiento actual, verificado con trazas reales**: cada green golpeado calcula su propio destino final de una sola vez, vía `PUSH_STRATEGY['brown']` (stepUntilBlocked), SIN saber que el otro green también se está desplazando en ese mismo instante. El resultado real (10 eventos, verificado) es que UN solo green sobrevive (en `(5,4)`), el otro se consume en una cadena de golpes secuenciales, y rojo termina asentado en `(5,6)` -- las dos fichas verdes NUNCA llegan a "verse" entre sí.

**Comportamiento correcto, derivado a mano y confirmado con el usuario**: si ambos greens avanzan EN PARALELO, una casilla por tick, en direcciones opuestas (green1 hacia el este desde `(5,6)`, green2 hacia el oeste desde `(5,4)`):

```
tick 1: green1 (5,6)->(5,7)         green2 (5,4)->(5,3)
tick 2: green1 (5,7)->(5,0) [wrap]  green2 (5,3)->(5,2)
tick 3: green1 (5,0)->(5,1)         green2 (5,2)->(5,1)   <- MISMA CASILLA
```

Ambos llegan a `(5,1)` en el MISMO tick -- exactamente la columna 1 que el usuario predijo de memoria, y exactamente lo que el modelo actual (destino final precalculado de una sola vez, sin ver al otro) no puede detectar. Mismo color -> aniquilación ahí mismo.

Esto confirma que el problema NO es (solo) el ya corregido "trayectoria vs. ficha real quieta" -- es que el AVANCE en sí (`PUSH_STRATEGY['brown']` = `stepUntilBlocked`) se ejecuta de principio a fin en una sola llamada síncrona, ciega a cualquier OTRA trayectoria en vuelo simultánea, porque esa otra trayectoria no está escrita en el tablero (solo existe como un `ImpactSite` pendiente en la cola) y `stepUntilBlocked` solo mira el tablero real.

## Decisión 1 -- Alcance del rediseño: solo marrón necesita volverse incremental

Analizando las tres mecánicas de empuje (`PUSH_STRATEGY`, `src/engine/pieces/push.ts`):

- **green** (`stepBy(pos, dir, 1)`): un único paso, sin mirar el tablero. Como es un solo paso, no existe ninguna casilla "intermedia" que pueda cruzarse con otra trayectoria sin que también coincida su destino final -- el `findCoincidingPair` ya existente (comparando destinos finales) ya cubre correctamente este caso. **No necesita cambiar.**
- **orange** (`stepBy(pos, dir, 2)`): dos pasos, deliberadamente ciego al tablero en el punto intermedio (simplificación ya aceptada y probada desde 011/018 -- el propio efecto visual de "salto" en el renderer depende de esta ceguera). Igual que green, esto es un único salto ATÓMICO de cara al resto del sistema; el punto intermedio nunca participa en ninguna comprobación (ni de tablero real, ni de trayectorias en vuelo) hoy, y esta feature NO cambia eso -- extenderle detección de colisión en el punto intermedio sería añadir una capacidad que rompe una simplificación ya deliberada y ya spec'd (FR-005 de esta feature: "el comportamiento de marrón y naranja... DEBE preservarse en su resultado final"). **No necesita cambiar.**
- **brown** (`stepUntilBlocked`): el ÚNICO de los tres cuya distancia es variable y cuyo propio bucle interno YA avanza casilla a casilla, comprobando ocupación en cada paso -- pero contra una única foto fija del tablero real, tomada una vez al principio de la llamada. Es el ÚNICO caso donde dos trayectorias pueden, matemáticamente, cruzar sus caminos en una casilla intermedia sin compartir destino final (el ejemplo del usuario lo demuestra).

**Decisión**: el rediseño se acota a marrón. Green y orange conservan sus funciones actuales en `PUSH_STRATEGY`, sin cambios de firma ni de comportamiento. Se introduce un mecanismo NUEVO, paralelo, específicamente para avanzar una o más trayectorias marrón-empujadas una casilla por tick, con comprobación de colisión (contra el tablero real Y contra otras trayectorias en vuelo) en CADA paso -- no una reescritura general de cómo se representa "una trayectoria en vuelo" para los tres colores por igual.

**Alternativa rechazada**: unificar los tres colores bajo un único modelo "N ticks, cada uno opcionalmente comprobado" (green=1 tick comprobado; orange=2 ticks, el primero ciego; marrón=ticks ilimitados, todos comprobados). Es más "elegante" en abstracto (composición uniforme, Principio V), pero para green/orange es una generalización sin ningún caso real que la necesite (ya que un salto de 1 o 2 casillas nunca puede "cruzarse" con otra trayectoria sin compartir también destino final) -- y complica innecesariamente el modelo de datos y el bucle principal para colores que ya funcionan perfectamente bien tal como están. Se prefiere la solución mínima, acotada al color que realmente lo necesita, dejando green/orange exactamente como están (menor superficie de cambio, menor riesgo de regresión en código ya probado).

## Decisión 2 -- No hace falta un tipo ni una cola nueva: `ImpactSite` gana un marcador opcional y su "salto" pasa a ser de 1 casilla cuando quien empuja es marrón

Analizando `resolveChain` más de cerca: su cola YA procesa `ImpactSite`s uno a uno, en FIFO, comprobando antes de cada uno si coincide con otro pendiente (`findCoincidingPair`) -- y su propio docstring ya documenta la idea central de 019 ("sembrada con más de un site a la vez, ya los intercala salto a salto"). El problema no es la ORQUESTACIÓN (la cola ya intercala genuinamente) -- es que, para marrón, un "salto" hoy significa "la caminata COMPLETA hasta el primer obstáculo", calculada de una vez (`PUSH_STRATEGY['brown']` = `stepUntilBlocked`, ciega a cualquier otro `ImpactSite` todavía pendiente en esa misma cola). Si un "salto" de marrón pasa a significar "exactamente 1 casilla", la cola YA EXISTENTE logra el resto sin cambios: cada casilla intermedia de un paseo marrón vuelve a pasar por `findCoincidingPair` (que ya compara `to` contra `to` y ya exige que la casilla esté vacía) antes de la siguiente, exactamente igual que cualquier otro par de `ImpactSite`s.

**Diseño concreto**: `ImpactSite` gana un campo opcional `walking?: { edgeCrossings: number }`, presente únicamente cuando `to` es un paso TENTATIVO de 1 casilla (no un destino final) -- es decir, cuando `pushedByColor` para esta ficha es `'brown'`. Dos cambios, ambos en `applyImpact` (`resolveMutualSide`/`applyMutualImpact` reutiliza exactamente la misma idea, ver Decisión 6):

1. Al construir el `nextSite` para una ficha desplazada por un golpeador marrón (`site.piece.color === 'brown'`), en vez de `PUSH_STRATEGY['brown'](board, hitDefender, site.to, site.direction)` (destino final de una sola vez), se calcula un ÚNICO paso: `to = step(site.to, site.direction)` (envuelto con `wrapCoordinate`), y se marca `walking: { edgeCrossings: 0 }` (o `1` si ese paso ya cruzó un borde). Verde/naranja NO cambian -- siguen llamando a `PUSH_STRATEGY['green'|'orange']` exactamente como hoy, sin `walking`.
2. La rama `defender === null` de `applyImpact` (que hoy siempre asienta la ficha ahí) comprueba primero si `site.walking` está presente:
   - Si NO está presente (verde, naranja, o cualquier asentamiento final ya resuelto): comportamiento actual, sin cambios -- se asienta.
   - Si SÍ está presente: en vez de asentarse, da UN paso más (`step` + `wrapCoordinate`, incrementando `edgeCrossings` si cruza un borde) y devuelve un `nextSite` con el `to` actualizado y el mismo `walking` (o, si `edgeCrossings` alcanza `MAX_EDGE_CROSSINGS`, SÍ se asienta ahí -- mismo tope ya existente).

`from` nunca cambia mientras una ficha "camina" -- sigue siendo la casilla original desde la que empezó a desplazarse (para que el evento final, cuando por fin se asiente o choque, muestre el mismo `from` que mostraría hoy). Solo `to` avanza, una casilla por vez, cada vez que esta ficha vuelve a su turno en la cola FIFO.

Con esto, el ejemplo del usuario se resuelve solo: cada green (empujado por marrón) se re-encola con un `to` un paso más lejos cada vez que le toca turno en la cola, intercalado con el otro green (exactamente el mismo mecanismo FIFO que 019 ya usa para intercalar las dos ramas de un split) -- y `findCoincidingPair` los detecta en la PRIMERA casilla real donde sus `to` tentativos coinciden y esa casilla está vacía, sin necesidad de ninguna cola ni tipo nuevo.

**Alternativa rechazada** (la del primer borrador de este research.md): introducir un tipo `BrownWalk` separado y una fase de avance-por-tick dedicada en `resolveChain`, procesando TODAS las trayectorias marrón a la vez antes de tocar la cola de `ImpactSite` ya existente. Rechazada tras darme cuenta de que la cola FIFO ya existente, sin ningún cambio estructural, logra exactamente el mismo resultado con una superficie de cambio mucho menor: no hace falta una fase nueva, ni un tipo nuevo, ni tocar `resolveChain` en absoluto -- solo el punto donde `applyImpact` decide "he llegado, me asiento" para pasar a decir, cuando corresponde, "todavía no, doy un paso más". Menos código nuevo, cero cambio en la orquestación ya probada de 019, más fácil de razonar sobre la terminación (ver Decisión 7).

## Decisión 3 -- El identity-exclusion de `stepUntilBlocked` se traduce directamente: la ficha que golpeó ya está en el tablero real, así que la comprobación de `defender === null` ya la excluye correctamente

El comentario ya existente de `stepUntilBlocked` documenta que el golpeador que originó el desplazamiento (ya asentado en el tablero real, en la casilla de origen del paseo) debe ser ignorado por identidad, no por coordenada, para que el paseo pueda dar una vuelta completa y chocar consigo mismo por SEGUNDA vez si el carril está despejado (016/017). En el nuevo modelo, esta exclusión ya no hace falta como caso especial: cada paso tentativo se resuelve con la MISMA `applyImpact` que cualquier otro golpe, que ya lee `getPieceAt(board, site.to)` contra el tablero real tal cual está -- el golpeador que se asentó en el origen del paseo simplemente ES una ficha real ahí, y cuando el paseo (tras dar la vuelta completa) vuelve a esa casilla, la encuentra como cualquier otra ficha real, con distinto color casi siempre (el golpeador y la ficha desplazada nunca son el mismo color salvo aniquilación) -- exactamente la misma conclusión que hoy, alcanzada por el camino genérico en vez de un parámetro de exclusión por identidad. La antigua exclusión por identidad de `stepUntilBlocked` deja de ser necesaria porque ya no hay una única llamada de función que necesite "no verse a sí misma" -- cada paso es un `ImpactSite` fresco, y el golpeador es simplemente otra ficha real en el tablero, tratada igual que cualquier otra.

## Decisión 4 -- `MAX_EDGE_CROSSINGS` sigue siendo el mismo límite, ahora contado en `site.walking.edgeCrossings` en vez de en una variable local

Hoy, `stepUntilBlocked` lleva su contador `edgeCrossings` en una variable local, viva durante una única llamada. En el nuevo modelo, ese mismo contador vive en `site.walking.edgeCrossings`, persistido entre pasos de la cola (cada paso lo lee, lo incrementa si cruza un borde, y lo devuelve en el `nextSite`) -- mismo límite (`MAX_EDGE_CROSSINGS = 2`), misma condición de parada, solo que ahora repartido en llamadas sucesivas a `applyImpact` en vez de iteraciones de un único bucle `for`.

## Decisión 5 -- Forma del `EventLog`: sin cambios de tipo, un evento por asentamiento/aniquilación final (no uno por tick intermedio)

Se decide NO añadir un evento nuevo por cada tick intermedio de una `BrownWalk` (p. ej., un evento "sigue caminando" por cada casilla visitada). El `EventLog` sigue representando únicamente los momentos de asentamiento, aniquilación, o intercambio -- exactamente como hoy -- pero el CÁLCULO de a dónde llega cada `MOVE_STEP` ahora tiene en cuenta las demás trayectorias en vuelo, no solo el tablero real. Esto significa:
- `MoveStepEvent`/`AnnihilationEvent` NO cambian de forma (siguen teniendo `from`, `to`/`at`, `direction`, `pushedByColor` igual que hoy).
- El renderer (`src/renderer/launch-animation.ts`) NO necesita cambios -- sigue reproduciendo el mismo tipo de eventos, con las mismas animaciones ya construidas (`cellPath`, `walkPath`, etc.), simplemente los valores `to`/`at` que recibe ahora son los correctos (la casilla real donde el cruce ocurrió), no un destino final calculado a ciegas.

**Alternativa rechazada**: emitir un evento por cada tick intermedio de un paseo marrón, para que el renderer pudiera (en teoría) animar el cruce de dos fichas "en vivo, viéndose venir". Rechazada por alcance -- la propia especificación de esta feature excluye explícitamente cambios de renderer más allá de lo estrictamente necesario, y el renderer YA anima un `MOVE_STEP` largo casilla a casilla por su cuenta (`cellPath`, de una feature reciente) usando solo `from`/`to`/`direction` -- no necesita eventos intermedios del motor para lograr ese efecto visual, ya lo hace localmente. Añadir eventos intermedios sería una duplicación de responsabilidad entre motor y renderer sin beneficio real.

## Decisión 6 -- Dónde nace `site.walking`: exactamente en los mismos dos puntos donde hoy se invoca `PUSH_STRATEGY['brown']`

`walking` se fija (en vez de resolver el destino final) en los dos únicos lugares donde `PUSH_STRATEGY['brown']` se invoca hoy:
1. `applyImpact`, rama de golpe normal (color distinto, tablero real): cuando `site.piece.color === 'brown'` (el golpeador ACTUAL es marrón), el `nextSite` para la ficha desplazada nace con `to = step(site.to, site.direction)` (1 casilla) y `walking: {edgeCrossings: ...}`, en vez de con el destino final de `PUSH_STRATEGY['brown']`.
2. `applyMutualImpact`, rama genérica (colores distintos, ninguno rojo, dentro de `resolveMutualSide`): cuando el lado CUYA dirección/mecanismo se hereda es marrón, exactamente el mismo cambio.

Esto depende de `pushedByColor` (qué mecanismo gobierna el desplazamiento), NO del color de la propia ficha desplazada -- la misma distinción que ya rige el campo `pushedByColor` ya existente (una ficha verde empujada por marrón usa el mecanismo de marrón, no el suyo propio). Una ficha de CUALQUIER color, si es marrón quien la empuja, nace con `walking`; una ficha marrón empujada por verde u naranja NO lleva `walking` (usa `PUSH_STRATEGY['green'|'orange']` tal cual, sin cambios).

## Decisión 7 -- Terminación: el mismo argumento de siempre, ahora contado en casillas en vez de en golpes

La terminación ya garantizada (cada ficha solo puede avanzar `nueva -> agrietada -> rota` una vez por golpe, un número finito de veces) no depende de CUÁNTOS `ImpactSite`s hacen falta para representar un desplazamiento -- solo de que cada ficha, una vez golpeada, eventualmente se asiente, desaparezca, o golpee a su vez (avanzando fragilidad, un proceso finito). Trocear el desplazamiento de marrón en pasos de 1 casilla en vez de un salto final no cambia ese argumento: cada paso o bien termina el paseo (golpea algo real, colisiona con otra trayectoria, o alcanza `MAX_EDGE_CROSSINGS`) o bien se re-encola exactamente una vez más -- y `MAX_EDGE_CROSSINGS` (ya finito, ya existente) sigue acotando cuántas veces puede re-encolarse un mismo paseo antes de asentarse por la fuerza. No se introduce ningún mecanismo nuevo de parada; se reutiliza el ya existente, verificado durante 019.

## Resumen para data-model.md

- `ImpactSite` gana un campo opcional `walking?: { edgeCrossings: number }` -- presente solo cuando `to` es un paso tentativo de 1 casilla (marrón empujando), ausente cuando `to` ya es un destino final (verde/naranja, o cualquier resolución no walking).
- `applyImpact`: al construir el `nextSite` de una ficha desplazada por un golpeador marrón, usa `step`+`wrapCoordinate` (1 casilla) + `walking` en vez de `PUSH_STRATEGY['brown']` (destino final). La rama `defender === null` dispensa un paso más (en vez de asentar) cuando `site.walking` está presente y no se ha alcanzado `MAX_EDGE_CROSSINGS`.
- `applyMutualImpact`/`resolveMutualSide`: mismo cambio, en el lado cuyo mecanismo heredado es marrón.
- `resolveChain`/`findCoincidingPair`: SIN CAMBIOS -- la cola FIFO y la comprobación de coincidencia ya existentes procesan los pasos tentativos exactamente igual que cualquier otro `ImpactSite`.
- Sin cambios en `MoveStepEvent`/`AnnihilationEvent`/el renderer/`PUSH_STRATEGY['green']`/`PUSH_STRATEGY['orange']`.
