# Research: Fragilidad como Factor de Dificultad del Generador

## Decisión 1 — Las fichas de tablero críticas para la solución no necesitan ningún mecanismo nuevo

**Decisión**: una ficha de tablero que la solución construida golpea sigue partiendo siempre de `'new'`, exactamente igual que hoy (`obligations.ts` ya hace `setPieceAt(board, cell, { color, fragility: 'new' })` sin condición alguna). No se introduce ningún conteo de golpes ni ninguna lógica de "elegir el estado inicial más seguro" para estas fichas.

**Rationale**: derivado matemáticamente a partir de `advance()` (`src/engine/pieces/push.ts`) y de la semántica ya existente de `resolveObligations` (`tools/generator/obligations.ts`):

- Cada eslabón de la cadena `defender`-continuación (`chooseFurniture === false`) existe *porque* una obligación posterior en el tiempo real ya resolvió un empuje que necesita que esta ficha sobreviva y se asiente -- si no sobrevive, la casilla que esa obligación exige no queda con el color correcto, y la construcción entera es inválida por definición (no es un caso límite, es la definición misma de "obligación resuelta").
- `advance` solo tiene tres estados, un paso por golpe: `NEW → CRACKED → BROKEN`. Una ficha golpeada exactamente una vez sobrevive únicamente si partía de `NEW` (queda `CRACKED`, se asienta bien). Partir de `CRACKED` la deja `BROKEN` justo en el golpe que necesitaba sobrevivir -- nunca es seguro.
- Una ficha golpeada dos o más veces no tiene NINGÚN estado inicial seguro: incluso partiendo de `NEW`, el segundo golpe la deja `BROKEN` antes de completar su papel.
- Conclusión: para las fichas de tablero que la solución golpea, no hay ninguna decisión real que tomar -- `NEW` es el único valor correcto cuando se golpean una vez, y ningún valor sirve cuando se golpean dos o más veces. No hace falta contar golpes para decidir un valor que ya sabemos cuál es.

**El caso de dos-o-más-golpes ya está cubierto, hoy, por un mecanismo existente**: `validatesForward` (`generate.ts`) ya reproduce la construcción completa con el motor real y descarta el intento entero si el resultado final no es exactamente `'won'` (FR-006 de 011-level-generator-basic). Este es precisamente el mecanismo que ya "arregló" el bug histórico documentado en el commit `4e90191` ("fix(develop): reconcile tools/generator/ con piece fragility después del merge") -- sin ningún código nuevo, simplemente porque una ficha rota antes de tiempo hace que la reproducción real no llegue a `'won'`, y el intento se descarta y se reintenta (política de fallos ya existente, FR-007 de 011). Esta feature no reemplaza ese mecanismo reactivo -- lo mantiene intacto y confirma, con la prueba matemática de arriba, que sigue siendo suficiente ahora que el resto del comportamiento del generador (decoys, fichas lanzadas) empieza a variar deliberadamente de `NEW`.

**Alternativas consideradas**:
- *Recorrer la cadena de obligaciones hacia atrás aplicando el inverso de `advance()` ("regresar" el estado)*: es la idea con la que se empezó a explorar esta feature (ver conversación de diseño previa) -- técnicamente correcta, pero al formalizarla se demuestra que el resultado de ese recorrido SIEMPRE converge a "forzar NEW si se golpea una vez, rechazar si se golpea más" -- es decir, el recorrido no deja ningún grado de libertad real que perseguir. Añadir el recorrido explícito (un campo `hitCount` en `Obligation`, lógica de rechazo proactivo) sería código nuevo para llegar exactamente al mismo resultado que ya se obtiene dejando el comportamiento actual intacto -- violaría el Principio V (no añadir una primitiva nueva cuando la composición ya existente basta) sin ganar nada a cambio.
- *Añadir un rechazo proactivo de cadenas de 2+ golpes, antes de gastar una reproducción completa con el motor real*: sería una optimización de rendimiento pura (evitar construir el resto del nivel antes de descubrir el fallo), no un requisito de corrección -- SC-004 ("la gran mayoría de las peticiones producen un nivel válido dentro del máximo de intentos") ya se cumple hoy con el mecanismo reactivo, según el propio historial del proyecto. Queda fuera de alcance de esta feature; se puede reconsiderar si en el futuro se observa que agota `maxGenerationAttempts` con más frecuencia de la aceptable.

## Decisión 2 — Las fichas lanzadas por la solución y los señuelos comparten el mismo mecanismo de asignación por perfil

**Decisión**: un único helper puro, `assignGroupFragility(profile, count, allowedStates, rng)`, decide la fragilidad de un grupo entero de fichas (señuelos de tablero, señuelos de mano, o fichas lanzadas de la solución) según el perfil de dificultad activo:

- `'easy'` (o perfil no indicado): se sortea un único estado, dentro de `allowedStates`, y se aplica a las `count` fichas del grupo -- cumple FR-006 (estado uniforme dentro del grupo).
- `'hard'`: cada una de las `count` fichas sortea su propio estado, independientemente, dentro de `allowedStates` -- maximiza la probabilidad de heterogeneidad (FR-007), sin garantizarla al 100% (un sorteo independiente puede coincidir por azar; SC-003 solo exige una proporción "sensiblemente mayor", no absoluta, igual que el resto de parámetros probabilísticos ya existentes en el generador como `chainOriginProbability`).
- `'medium'`: se sortea un estado base igual que en `'easy'`, y después cada ficha tiene una probabilidad moderada (fija, ver `data-model.md`) de sortear un estado distinto -- produce heterogeneidad ocasional, menos frecuente que `'hard'`.

`allowedStates` es lo único que distingue un grupo de otro:
- Señuelos de tablero: `['new', 'cracked']` (FR-008 -- nunca BROKEN, porque desaparecería de `createLevel`).
- Señuelos de mano: `['new', 'cracked', 'broken']` (FR-009 -- rango completo).
- Fichas lanzadas de la solución: `['new', 'cracked']` (FR-010 -- nunca BROKEN, por diseño, aunque sería técnicamente seguro para la reproducción -- se reserva BROKEN como señal exclusiva de "señuelo de mano" para no generar ambigüedad).

**Rationale**: un solo mecanismo, reutilizado tres veces con distinto `allowedStates`, evita triplicar la lógica de "cómo se reparte la heterogeneidad" (Principio V). Los tres grupos comparten exactamente la misma pregunta ("¿cuánta variedad de estados quiero en este conjunto de fichas, dado un perfil?") aunque su rango de estados válidos difiera.

**Alternativas consideradas**:
- *Un parámetro numérico 0-1 de heterogeneidad, con un umbral por perfil*: ya descartado en la fase de especificación -- el usuario pidió perfiles discretos explícitamente, dejando el dial numérico como posible evolución futura fuera de alcance.
- *Heterogeneidad "garantizada" en vez de probabilística para `'hard'`*: forzar que aparezcan literalmente 2+ estados distintos cuando `count >= 2`, en vez de sortear independientemente. Se descarta porque introduciría una asimetría extraña frente a `'easy'` (que sí es determinista) y frente al resto de parámetros del generador, todos probabilísticos; además, complica la reproducibilidad sin aportar valor de diseño claro -- el objetivo (FR-007) es "más probable", no "garantizado".

## Decisión 3 — Los señuelos de tablero, al colocarse uno a uno sin conocer el total por adelantado, necesitan un pequeño ajuste en `resolveObligations`

**Decisión**: cuando el perfil es `'easy'`, el estado compartido del grupo "señuelos de tablero" se sortea **una sola vez**, la primera vez que se coloca un señuelo de tablero dentro de un intento de construcción, y se reutiliza para cualquier señuelo de tablero posterior dentro del MISMO intento. Cuando el perfil es `'hard'` o `'medium'`, cada señuelo de tablero sortea su propio estado en el momento en que se coloca, sin necesitar conocer el total.

**Rationale**: a diferencia de los señuelos de mano (`decoyCount` fijo, conocido antes de generarlos) y de las fichas lanzadas (conocidas en cuanto `resolveObligations` termina con éxito), los señuelos de tablero se sortean de nuevo en CADA paso de construcción (`boardDecoyProbability`, research.md de 011-level-generator-basic) -- su cantidad final no se conoce hasta que la cola de obligaciones se vacía del todo. `'easy'` exige que todos compartan el mismo estado, así que ese estado debe decidirse antes de saber cuántos habrá -- guardar el valor ya sorteado (en el mismo objeto `ResolutionContext` que ya viaja por toda la función) y reutilizarlo resuelve esto sin necesitar una pasada previa ni conocer el total por adelantado.

**Disciplina de determinismo a preservar**: ningún sorteo de fragilidad nuevo (señuelo de tablero, señuelo de mano, o ficha lanzada) debe consumir una llamada a `rng()` cuando `difficultyProfile` no se indica -- exactamente la misma disciplina que ya sigue `boardDecoyProbability` ("el `>0` evita consumir ningún `rng()` cuando no se pide", `obligations.ts`), para no desincronizar ninguna secuencia scripted-rng de los tests ya existentes.

## Decisión 4 — `GeneratedLevel.pieces`/`hand` deben empezar a transportar `fragility`

**Decisión**: `GeneratedLevel.pieces` pasa de `{ at, color }[]` a `{ at, color, fragility }[]` (equivalente a `PiecePlacement[]` del motor), y `GeneratedLevel.hand` pasa de `PieceColor[]` a `HandPieceInput[]` (tipo ya exportado por el motor desde 012-piece-fragility). `validatesForward` y el resto de la tubería (`createLevel`, reproducción real) ya aceptan estas formas sin cambios -- son exactamente los tipos que `createLevel` espera desde que 012-piece-fragility los introdujo.

**Rationale**: sin este cambio de forma, no hay dónde transportar la fragilidad decidida para señuelos/fichas lanzadas hasta la salida del generador ni hasta la reproducción de verificación -- sería imposible cumplir FR-005/006/007 sin, a la vez, hacer este cambio de tipo. No se necesita ningún cambio en el motor (`src/engine/`): estos tipos ya existen ahí, el generador solo empieza a usarlos con más detalle del que usa hoy (donde siempre asume `fragility: 'new'` implícitamente, vía los valores por defecto de `createLevel`).

**Compatibilidad**: cualquier llamador existente de `generateLevel`/`generateLevelWithRng` que no pida ningún perfil de dificultad sigue recibiendo, en la práctica, exactamente los mismos valores (`fragility: 'new'` en todo) que hoy -- el cambio de tipo es más ancho, no rompe ningún uso existente en tests o en `cli.ts`/`batch.ts`.

## Cambio de semántica de resolución de cadenas

Ninguno. Esta feature no toca `src/engine/` en absoluto (FR-013) -- ni `resolveStrike`, ni `applyImpact`, ni ninguna otra función de resolución de cadenas. Toda la lógica vive en `tools/generator/`, consumiendo `createLevel` exactamente como ya lo hace hoy.
