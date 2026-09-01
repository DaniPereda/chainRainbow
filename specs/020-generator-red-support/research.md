# Phase 0 Research: Ficha Roja en el Generador de Niveles

## Decisión 1 -- El origen de rojo (`C`) se calcula EXACTAMENTE como el inverso de verde

**Contexto de motor verificado** (`src/engine/pieces/push.ts`, `resolveRedSplit`):

```ts
const [first, second] = PERPENDICULAR_DIRECTIONS[direction];
return resolveChain(
  board,
  [
    { piece: hitDefender, direction: first, from: position, to: stepBy(position, first, 1) },
    { piece: hitDefender, direction: second, from: position, to: stepBy(position, second, 1) },
  ],
  applyImpact,
  applyMutualImpact,
);
```

Cada rama nace en `position` (el punto de la división, `C`) y su PRIMER salto es SIEMPRE
exactamente 1 casilla (`stepBy(position, dir, 1)`), sin excepción y sin mirar el color de `D` --
esto no es una elección del generador, es literal en el motor. `applyImpact` procesa después ese
salto normalmente: si la casilla de aterrizaje está vacía, la rama se asienta ahí (fin); si está
ocupada por otro color, la rama se asienta ahí de todos modos (golpeando al ocupante, que se
desplaza más allá usando la mecánica de la propia rama) -- ver `applyImpact`, rama
"defender.color !== site.piece.color".

**Consecuencia para la inversión**: si estamos invirtiendo una obligación `'defender'` normal
(color=`X`, dirección=`direction`, celda=`to`) y decidimos resolverla mediante un split de rojo,
la RAMA QUE LLEGA A `to` solo puede haber recorrido exactamente 1 casilla desde `C` -- porque en
cuanto esa rama aterriza en una casilla OCUPADA, ELLA MISMA se asienta ahí (no sigue viajando; lo
que sigue viajando es el OCUPANTE, un color distinto, no la propia rama). Por tanto:

```
to = stepBy(C, direction, 1)  =>  C = stepBackward(to, direction, 1)
```

Esta es la MISMA fórmula, con el mismo único candidato, que `inverseCandidates('green', ...)` ya
calcula (`inverses.ts`). No hace falta ninguna matemática nueva para `C` -- rojo, para efectos de
`inverseCandidates`, se comporta como verde.

**Alternativa rechazada**: modelar un salto múltiple para la rama principal (que aterrice más
lejos de `C` golpeando algo en su camino). Descartada porque, como se acaba de verificar, ese
"algo en su camino" desvía al OCUPANTE, no a la propia rama -- la rama que lleva al objetivo
nunca recorre más de 1 casilla desde `C` en un split real. Intentarlo produciría una construcción
que `validatesForward` rechazaría siempre.

## Decisión 2 -- La rama secundaria reutiliza el `Obligation` `'defender'` sin tipo nuevo

**Verificado en motor** (`applyImpact`, `settleOrVanish`): cuando una rama aterriza en una casilla
vacía, se asienta con su propia fragilidad (ya avanzada por el split, FR-015 de 009). Cuando
aterriza en una casilla ocupada por otro color, TAMBIÉN se asienta ahí (el ocupante es quien se
desplaza). En ambos casos la rama secundaria termina siendo, desde el punto de vista de "qué hay
en esa casilla al final", una pieza de color `X` (el color de `D`) con la fragilidad compartida
del split -- exactamente lo que una obligación `'defender'` ya modela (una pieza de un color dado
que debe explicarse en una celda dada).

Esto significa que la pregunta de US2 ("¿la rama secundaria es mobiliario fijo o el resultado de
un golpe anterior?") es LITERALMENTE la misma pregunta que cualquier obligación `'defender'`
normal ya se hace vía `defenderContinuationProbability` -- con una única diferencia: cuando se
resuelve como mobiliario, la fragilidad no es la libre `'new'` por defecto, sino la ya avanzada
del split (`'cracked'`, ver Decisión 5 sobre por qué siempre es exactamente ese valor).

Cuando NO se resuelve como mobiliario (continúa su cadena, US2), se reutiliza
`chooseStrikerAndOrigin(..., 'settle', ...)` sin ningún cambio -- y esto YA produce, sin código
adicional, la fragilidad correcta: el golpeador que la empuja hasta ahí procede de una obligación
`'defender'` recursiva que por defecto empieza en `'new'`, así que al golpear avanza a
`'cracked'` -- exactamente la fragilidad compartida del split. Verificado leyendo el bloque
`'defender'` de `resolveObligations`: la única obligación recursiva que se empuja para el
`origin` de un golpe usa siempre fragilidad `'new'` cuando se resuelve como mobiliario, así que
`advance('new') === 'cracked'` en el momento en que ese golpe alcanza la celda de la rama
secundaria.

**Alternativa rechazada**: introducir un tipo de obligación `'split-branch'` nuevo, con su propia
lógica de mobiliario-vs-cadena duplicada. Rechazada por Principio V (primitivas composables) --
sería duplicar exactamente la lógica que `'defender'` ya tiene, solo para poder fijar la celda de
antemano (algo que un campo opcional en el `Obligation` existente ya resuelve, ver
data-model.md).

## Decisión 3 -- Punto de la única desviación real de "cero casos especiales"

El único lugar donde el código de `resolveObligations` necesita SABER que está ante un split de
rojo (en vez de tratarlo con la misma rama genérica de cualquier otro color) es: al empujar las
obligaciones siguientes tras resolver `chooseStrikerAndOrigin` para un `'defender'`. Actualmente
esa función siempre empuja exactamente 2 obligaciones (una `'defender'` recursiva para el color
de la obligación en `origin`, una `'striker-origin'` para el color del golpeador en `origin`).
Cuando el golpeador resuelto es `'red'`, hay que empujar 3 en su lugar (la `'defender'` de `D`
forzada a mobiliario, la `'striker-origin'` de rojo con una dirección perpendicular recién
sorteada, y la `'defender'` de la rama secundaria en su propia celda de aterrizaje).

Esto es un `if (resolved.striker === 'red') { ... } else { ... }` -- no se puede evitar sin
inventar una abstracción más genérica que "un golpe explica 2 obligaciones nuevas" (algo que
ningún otro color necesita y que complicaría el resto del fichero sin beneficio real). Se acepta
como la única desviación de Principio V, documentada aquí y en el `Constitution Check` de
plan.md, en vez de dejarla implícita.

## Decisión 4 -- Rojo NUNCA es candidato para resolver una obligación `'striker-origin'`

`chooseStrikerAndOrigin` se llama desde dos sitios: resolviendo una obligación `'defender'`
(contexto `'settle'`) y resolviendo una obligación `'striker-origin'` vía cadena (contexto
`'occupied'`). Este feature SOLO extiende el primero (FR-001 de spec.md dice explícitamente
"una obligación de tipo 'defender'"). Permitir que rojo también explicara "cómo empezó a moverse
un golpeador ya conocido" añadiría una recursión no pedida (un golpeador que a su vez es una rama
de un split anterior, con su propia rama secundaria, potencialmente anidada) fuera del alcance
decidido con el usuario para esta feature.

**Implementación de la exclusión**: `inverseCandidates('red', direction, to, board, context)`
devuelve `[]` explícitamente cuando `context !== 'settle'` -- la exclusión vive en la función que
ya posee toda la matemática por color, en vez de depender solo de que el único call-site con
contexto `'occupied'` recuerde filtrar `'red'` de `availableColors`. Ambas cosas se hacen (cinturón
y tirantes): el call-site de `'occupied'` también filtra `'red'` explícitamente, para que quede
documentado en el propio sitio de la decisión, no solo en `inverses.ts`.

**Alternativa rechazada**: dejar que rojo participe también en el contexto `'occupied'` y confiar
en que la recursión simplemente rara vez ocurra. Rechazada porque introduciría un comportamiento
no pedido ni probado (splits anidados dentro de la cadena de un golpeador) sin ningún requisito
que lo pida -- mejor excluirlo explícitamente ahora y ampliarlo como una feature futura separada
si algún día se desea.

## Decisión 5 -- La fragilidad compartida es SIEMPRE `'cracked'`, nunca un valor libre

FR-002 obliga a que `D` (la ficha pre-split) se construya SIEMPRE con fragilidad `'new'` -- la
única forma de que el split resulte en una rama utilizable (FR-015 de 009-red-piece: `'cracked'`
produce dos ramas `BROKEN` que jamás se asientan). Como `D` está forzada a `'new'` sin excepción
(ver Decisión 6, `forceFurniture`), la fragilidad que ambas ramas comparten tras el golpe de rojo
es siempre `advance('new') === 'cracked'` -- un valor fijo, no una fragilidad que dependa del
perfil de dificultad (`fragilityProfile`) ni de ningún sorteo. Esto es lo que
`furnitureFragility` fija literalmente a `'cracked'` (nunca un valor calculado en tiempo de
resolución).

## Decisión 6 -- `D` se fuerza a mobiliario mediante un campo nuevo, no un color especial

Igual que 017-striker-visibility-gap introdujo `mustBeBroken` en el `Obligation` para forzar un
lanzamiento directo con fragilidad `'broken'`, esta feature introduce `forceFurniture?: boolean`
para forzar que la obligación `'defender'` de `D` en `C` se resuelva SIEMPRE como mobiliario
(`fragility: 'new'`), sin someterse al sorteo de `defenderContinuationProbability`. Igual que
`mustBeBroken`, esto se comprueba ANTES del sorteo (con cortocircuito `||`, sin consumir
`rng()`), preservando exactamente los mismos conteos de `rng()` de cualquier fixture existente
que no use rojo (FR-007: cero regresión).

## Decisión 7 -- La dirección de golpe de rojo se sortea con una tabla local, sin tocar el motor

`PERPENDICULAR_DIRECTIONS` (motor, `push.ts`) mapea "dirección de golpe de rojo" ->
"par de direcciones de rama" (`N|S -> [E,O]`, `E|O -> [N,S]`). Para la inversión necesitamos el
mapeo INVERSO: dada la dirección de la rama principal (`direction`, ya conocida), ¿qué
direcciones de golpe de rojo son compatibles? La respuesta es la MISMA partición por eje
(horizontal/vertical), así que se define una tabla local en `obligations.ts`:

```ts
const RED_STRIKE_DIRECTIONS_FOR_BRANCH: Record<Direction, [Direction, Direction]> = {
  E: ['N', 'S'],
  O: ['N', 'S'],
  N: ['E', 'O'],
  S: ['E', 'O'],
};
```

y la dirección de la rama secundaria es siempre `opposite(direction)` -- verificado porque
`PERPENDICULAR_DIRECTIONS['N']` y `PERPENDICULAR_DIRECTIONS['S']` devuelven AMBAS el mismo par
`[E, O]` (y simétricamente para `E`/`O` -> `[N, S]`): el par de direcciones de las dos ramas no
depende de CUÁL de las dos direcciones de golpe compatibles se eligió, solo del eje. Duplicar
esta tabla diminuta en el generador (en vez de exportar la del motor) sigue el mismo precedente
ya establecido por `entryCoordinate` en `obligations.ts` (comentario existente: "Mirrors
launch.ts's private entryCoordinate -- same tiny, stable mapping") -- mantiene FR-008 (el motor
no cambia ni siquiera en visibilidad) sin introducir divergencia real de comportamiento, porque
ambas tablas codifican la misma partición fija N/S<->E/O que no ha cambiado desde 009.

## Decisión 8 (CORREGIDA) -- El objetivo (`goalColor`) SÍ puede ser `'red'`, sin ningún cambio de código

**Versión original de esta decisión (incorrecta, señalada por el usuario)**: se excluía `'red'`
de las candidatas de `goalColor` razonando que "rojo nunca se comporta como una ficha coleccionable
-- siempre se transforma al golpear algo." Esa afirmación es cierta SOLO cuando rojo es quien
golpea (`site.piece.color === 'red'` en `applyImpact`, la condición que dispara
`resolveRedSplit`). Cuando rojo es la ficha GOLPEADA (defensora) por otro color, no hay ninguna
comprobación de color especial en absoluto -- sigue exactamente la misma rama genérica que
cualquier otro color distinto (`hitDefender`/`PUSH_STRATEGY[site.piece.color]`), así que un rojo
empujado por, por ejemplo, verde, se desplaza y puede asentarse limpiamente en la celda del
objetivo como cualquier otra ficha. Verificado empíricamente con el motor real: rojo en `{4,3}`,
mano `['green']`, objetivo `{color:'red', cell:{4,4}}`, lanzamiento E/lane 4 -> `resolveLaunch`
devuelve `result: 'won'`, con rojo asentado en `{4,4}` (fragilidad `'cracked'`, avanzada por el
golpe) -- CERO split, exactamente como con verde/naranja/marrón como defensor.

**Corrección**: se elimina el filtro `availableColors.filter(c => c !== 'red')` en `generate.ts`
-- `goalColor` vuelve a sortearse de `params.availableColors` sin ninguna exclusión, idéntico al
código anterior a esta feature (byte a byte, cuando `availableColors` no incluye rojo). Esto no
requiere NINGÚN cambio adicional en `obligations.ts`/`inverses.ts`: una obligación raíz con
`color: 'red'` ya funciona correctamente con el código existente sin tocar --
`chooseStrikerAndOrigin('red', ...)` ya excluye `'red'` de sus propias candidatas de golpeador
(`candidates = availableColors.filter(color => color !== obligationColor)`, con
`obligationColor==='red'` esta vez) y usa verde/naranja/marrón para explicar cómo llegó rojo ahí --
exactamente la misma composición genérica que cualquier otro color, sin ningún caso especial
(Principio V). La única capacidad que sigue sin existir (y que esta corrección no añade) es
"rojo golpeando algo para llegar él mismo al objetivo" -- eso es imposible por diseño del motor
(rojo, al golpear, se sustituye instantáneamente por sus dos ramas en el punto de impacto, nunca
avanza como golpeador -- FR-007 de 009-red-piece), pero no tiene nada que ver con rojo COMO
objetivo, que es lo que esta decisión trataba.

## Decisión 9 -- Board decoys de color rojo: riesgo ya cubierto, sin código nuevo

Con rojo en `availableColors`, `boardDecoyProbability` podría colocar un señuelo de tablero rojo,
sin relación con la construcción de la solución. Un señuelo rojo nunca dispara un split si nunca
actúa como golpeador (solo lo hace si un OTRO golpe lo desplaza y esa pieza desplazada, ahora en
movimiento, golpea algo más -- ver `applyImpact`, el chequeo `site.piece.color === 'red'` se
evalúa en CADA salto de la cadena, no solo en el lanzamiento original). Esto es un riesgo
genuino, pero ya cubierto por el mismo mecanismo general de "cualquier señuelo puede interferir
con la construcción, y `validatesForward` + reintento (FR-007) lo descarta si ocurre" -- no es un
riesgo nuevo introducido por rojo, es el MISMO riesgo que ya existe para señuelos de cualquier
color, ahora con un color más en la mezcla. No requiere ningún código nuevo.

## Decisión 10 -- La rama secundaria SIEMPRE se autoanula al jugarse de verdad (hallazgo empírico, no un bug)

Verificado jugando construcciones reales con el motor: tanto si la obligación de la rama
secundaria se resuelve como mobiliario (una pieza puesta directamente en `landingCell` antes de
cualquier lanzamiento) como si se resuelve como cadena (una pieza del mismo color, empujada hasta
`landingCell` por un lanzamiento anterior), la pieza que YA está en `landingCell` en el momento en
que la propia rama secundaria intenta asentarse ahí SIEMPRE comparte su mismo color (porque
`chooseStrikerAndOrigin` para esa obligación usa siempre `obligation.color`, el mismo color que la
propia rama) y su misma fragilidad (`'cracked'`, compartida por construcción). Un mismo color
sobre la misma casilla es, por reglas del motor, una ANIQUILACIÓN (`applyImpact`, rama
`defender.color === site.piece.color`) -- así que la rama secundaria, en la práctica, SIEMPRE
termina aniquilándose con lo que sea que la explique, sin sobrevivir en el tablero final.

Esto NO rompe ningún requisito: SC-002 (todo nivel resuelve `'won'`) y FR-002/FR-004 (fragilidades
correctas) se verifican en el instante en que cada colocación ocurre, no en la persistencia final
de la rama secundaria -- y la diferencia observable entre "mobiliario" y "cadena" para efectos de
SC-004 sigue siendo real y verificable (la cadena añade un lanzamiento adicional a la solución,
aumentando genuinamente `launchCount` consumido y la complejidad del nivel), aunque la casilla de
aterrizaje de la rama secundaria termine vacía en ambos casos. Se documenta aquí para que un futuro
lector no lo confunda con un bug: es una consecuencia matemática inevitable de que la rama
secundaria y su "explicación" comparten siempre color y fragilidad por diseño (FR-004).

**Alternativa rechazada**: dar a la rama secundaria un color distinto al de `obligation.color`
para evitar la autoaniquilación. Rechazada porque contradice FR-004 y el propio mecanismo del
motor (ambas ramas de un split SIEMPRE comparten el color de `D`, no algo que el generador pueda
elegir libremente) -- la ficha en `landingCell` DEBE ser del mismo color que la rama para ser una
explicación válida de "qué había ahí", así que la aniquilación es inherente, no evitable sin
romper la fidelidad de la inversión.

## Decisión 11 (Historia 3) -- Regenerar 10 por `complexityScore` exige iterar semillas, no solo `--max-attempts`

`tools/generator/batch.ts` consume exactamente `count` semillas (ids consecutivos), sin garantía
de que todas produzcan una construcción válida -- `count: 10` significa "10 intentos", no
"10 éxitos". Para los valores bajos de `complexityScore` (7-16) la tasa de éxito por semilla es
alta (>60%), pero cae con fuerza en los valores más altos: verificado empíricamente, incluso con
`maxGenerationAttempts: 3000` (15x el valor por defecto) por semilla, `complexityScore` 20 y 21
solo tuvieron éxito en ~10-13% de 30 semillas probadas -- el cuello de botella no es "pocos
intentos por semilla" (aumentar ese número apenas cambió la tasa), sino que, con TODOS los
factores cerca de su máximo simultáneamente (`fragilityProfile:'hard'`, `launchCount` alto,
`decoyCount`/`boardDecoyProbability` altos, los 4 colores disponibles), la fracción de
combinaciones aleatorias que producen una construcción válida es simplemente más pequeña -- algo
que ya podía ocurrir ANTES de esta feature (verificado con el código previo a 020 vía `git
stash`: `complexityScore: 20` con 200 intentos por semilla también dio 0/10 éxitos), no una
regresión introducida por soporte de rojo.

**Decisión**: en vez de usar `batch.ts` tal cual, se escribió un script puntual (no comprometido
al repositorio, igual que `scratch-solver.mjs`) que, para cada valor de `complexityScore`, sigue probando semillas
consecutivas (consumiendo cada una del contador global de ids, éxito o no -- mismo criterio de
"nunca reutilizar un id" que `batch.ts` ya sigue) HASTA acumular exactamente 10 éxitos, en vez de
detenerse tras un número fijo de intentos. Con `maxGenerationAttempts: 1000` por semilla, el
número de semillas necesarias creció con la dificultad (12 semillas para `complexityScore: 7`,
80 para `complexityScore: 20`, 199 para `complexityScore: 21`) pero terminó en segundos para las
15 puntuaciones combinadas -- sin necesitar ningún ajuste a `tools/generator/` en sí.

**Alternativa rechazada**: relajar las horquillas de `complexity-config.json` para que los
valores más altos de `complexityScore` sean más fáciles de construir. Rechazada porque no fue
pedida por el usuario y cambiaría el significado de la dificultad configurada para CUALQUIER
llamada futura al generador, no solo para esta regeneración puntual -- un cambio de producto, no
una necesidad técnica de esta tarea.

## Resumen del algoritmo de inversión (para data-model.md)

Al resolver una obligación `'defender'` (color=`X`, dirección=`direction`, celda=`to`) y obtener
`chooseStrikerAndOrigin(...) = { striker: 'red', origin: C }`:

1. Sortear `redStrikeDirection` de `RED_STRIKE_DIRECTIONS_FOR_BRANCH[direction]` (2 opciones).
2. `secondaryDirection = opposite(direction)`.
3. `landingCell = stepBy(C, secondaryDirection, 1)`.
4. Empujar `{ cell: C, color: X, kind: 'defender', forceFurniture: true }` (D, siempre `'new'`).
5. Empujar `{ cell: C, color: 'red', kind: 'striker-origin', direction: redStrikeDirection }`
   (rojo mismo, resuelto con el mecanismo `'striker-origin'` ya existente, sin cambios).
6. Empujar `{ cell: landingCell, color: X, kind: 'defender', furnitureFragility: 'cracked' }`
   (rama secundaria, mobiliario-vs-cadena ya existente, sin cambios salvo la fragilidad fija).
7. No se coloca nada en `to` directamente -- lo produce el motor real al reproducir el split,
   igual que cualquier otra resolución de `'defender'` ya no coloca nada en `to` directamente.
