# Research: La Ficha Lanzadora Recién Asentada Debe Ser Visible Para el Desplazamiento de la Ficha Que Golpeó

## Decisión 1: Qué tablero recibe la llamada a `PUSH_STRATEGY`

**Decisión**: Dentro de `applyImpact` (`src/engine/pieces/push.ts`), la línea

```ts
const to = PUSH_STRATEGY[site.piece.color](vacated, hitDefender, site.to, site.direction);
```

pasa a recibir `boardWithStriker` en vez de `vacated`:

```ts
const to = PUSH_STRATEGY[site.piece.color](boardWithStriker, hitDefender, site.to, site.direction);
```

**Rationale**: `vacated` es una fotografía tomada en el momento en que se libera la casilla de impacto (`site.to`), ANTES de que la ficha lanzadora (`site.piece`) se escriba en ella. `boardWithStriker` es el resultado de `settleOrVanish(vacated, site.piece, ...)`, calculado unas líneas más abajo -- ya incluye a la ficha lanzadora asentada. El desplazamiento de la ficha defensora golpeada (`hitDefender`) debe calcularse viendo el tablero REAL en ese instante de la resolución, que ya incluye a la ficha lanzadora. Para verde/naranja (`stepBy`, distancia fija) esto es un no-op observable -- ninguna de las dos funciones consulta su parámetro `board`. Para marrón (`stepUntilBlocked`), que sí inspecciona ocupación celda a celda, la diferencia es real: verificado empíricamente (nivel 49 generado, ver spec.md) que el mismo cálculo devuelve `(7,7)` con `vacated` (da la vuelta completa al tablero sin detectar la ficha lanzadora) y `(4,7)` con un tablero que sí la incluye (colisión inmediata, correcta).

**Alternativas consideradas**:

- **Diferir el asentamiento de la ficha lanzadora hasta después de calcular el desplazamiento de la defensora**: revertiría el objetivo central de 016-immediate-chain-placement (la ficha lanzadora debe asentarse de inmediato, FR-001 de esa feature) y reintroduciría exactamente el tipo de estado intermedio que esa feature eliminó. Descartada.
- **Caso especial solo para marrón** (ya que es la única estrategia que consulta el tablero): violaría el Principio V (primitivas composables, sin casos especiales) sin ningún beneficio -- pasar `boardWithStriker` uniformemente a las tres estrategias no cambia el resultado de verde/naranja (que ignoran el parámetro) y sí corrige marrón. Descartada.
- **Recalcular `vacated` para que incluya a la ficha lanzadora, en vez de introducir/usar `boardWithStriker`**: equivalente en efecto a la decisión adoptada, pero renombraría o mutaría el significado de una variable que otro código de la misma función (el caso base `defender === null`, y la propia llamada a `settleOrVanish`) sigue necesitando en su forma actual (la casilla vacía, sin la ficha lanzadora, es exactamente lo que `settleOrVanish` necesita para escribir en ella). Usar la variable `boardWithStriker` ya calculada, sin tocar `vacated`, es el cambio mínimo y más legible. Adoptada como parte de la Decisión 1.

## Decisión 2: Qué hacer con los niveles ya generados

**Decisión**: Reproducir la secuencia de referencia de los 140 niveles existentes con el motor corregido; regenerar (mismo `complexityScore`, mismo mecanismo de `tools/generator/`) únicamente los que dejen de resolver a `'won'`.

**Rationale**: El bug corregido solo es observable cuando una cascada involucra a marrón desplazando a otra ficha por un camino que, sin el bug, volvería a colisionar con la ficha lanzadora de esa misma cascada -- una construcción rara pero no imposible, que el generador pudo producir sin saberlo (el nivel 49 es un caso real confirmado). No hay razón para asumir que TODOS los niveles están afectados (la mayoría de cascadas de marrón no completan una vuelta al tablero ni vuelven a alcanzar la casilla de la ficha lanzadora), así que regenerar el batch completo desde cero -- como hizo 016, donde el cambio de semántica era mucho más amplio -- sería más trabajo del necesario. Reverificar y regenerar selectivamente es proporcional al alcance real del bug.

Verificado empíricamente sobre el batch completo: 11 de 140 niveles afectados (`40, 49, 71, 101, 107, 113, 132, 156, 165, 207, 251`) -- cada uno regenerado con su mismo `complexityScore` (mismo id de fichero, `seed` distinto cuando el `seed` original ya no producía una construcción válida dentro de `maxGenerationAttempts`, ya que el motor y el generador corregidos exploran el mismo flujo de `rng()` de forma distinta) y reverificado individualmente antes de sustituir el fichero.

**Alternativas consideradas**:

- **Regenerar los 140 niveles desde cero** (como en 016): descartada por desproporcionada -- el bug de esta feature es mucho más acotado (una sola línea, un solo caso de tablero desactualizado) que el de 016 (semántica de recursión completa), y no hay motivo para esperar que afecte a una fracción significativa del batch.
- **No tocar `levels/` y dejar que el bug se manifieste en producción**: descartada -- el propio nivel 49 demuestra que el bug SÍ puede alterar si un nivel generado es realmente resoluble como su `solution` afirma, lo cual viola la garantía ya exigida desde 011 (todo nivel generado debe resolver a `'won'` con su secuencia de referencia).

## Decisión 3: Alcance del test de regresión

**Decisión**: Un test sintético en `tests/unit/engine/push.test.ts` (la suite ya creada por 016) que reproduce la forma exacta del caso del nivel 49: una ficha marrón lanzada que golpea a una ficha defensora en una fila/columna por lo demás completamente despejada, de forma que el único obstáculo posible en el paseo resultante (`stepUntilBlocked`) es la propia ficha lanzadora ya asentada -- se afirma que el desplazamiento se detiene ahí (colisión real), en vez de completar la vuelta y aterrizar más allá.

**Rationale**: Es la forma mínima y más directa de fijar el contrato corregido, coherente con el resto de la suite ya existente (`push.test.ts` ya tiene un test de "auto-colisión" para 016 con una lista de piezas de tablero; este caso es distinto porque la auto-colisión es contra la PROPIA ficha lanzadora, no contra otra ficha de tablero previamente colocada por la misma cascada).

## Decisión 4: El generador necesita un golpeador marrón forzado a `'broken'` (Historia 3, descubierta durante la implementación)

**Decisión**: Cuando `obligations.ts` elige marrón como golpeador para un asentamiento limpio ('settle' context, `chooseStrikerAndOrigin`), la obligación `'striker-origin'` resultante se marca `mustBeBroken: true`. Al resolverse, esa marca (a) fuerza que la obligación se resuelva SIEMPRE por lanzamiento directo desde mano (nunca por una cadena anterior, sin importar el sorteo de `chainOriginProbability`), y (b) fuerza la fragilidad de ese lanzamiento concreto a `'broken'` en `generate.ts`, EXCLUYENDO esa ficha del grupo de uniformidad de `fragilityProfile` para fichas lanzadas (FR-006 de 013 solo exige uniformidad entre las fichas NO forzadas).

**Rationale -- por qué esto hacía falta (matemática verificada empíricamente antes de escribir código)**: la corrección de la Decisión 1 tiene una consecuencia mucho más amplia de lo que sugería el caso del nivel 49. `stepUntilBlocked` no se detiene ANTES de un obstáculo -- se detiene ENCIMA de la casilla donde lo encuentra (así es como una ficha "llega" a la siguiente colisión). En un carril por lo demás totalmente despejado, la ÚNICA ficha real que existe es la propia lanzadora, asentada exactamente en la casilla de origen del paseo de la defensora. Una vuelta completa (8 pasos en un tablero 8x8) SIEMPRE devuelve el paseo a esa casilla de origen, sin importar hacia dónde se dirigía `to` -- así que, para CUALQUIER distancia `to`, el paseo real nunca se detiene en `to` (que está vacía, nada lo bloquea ahí): sigue de largo y termina chocando con su propio golpeador al completar la vuelta. Verificado directamente con `stepUntilBlocked`: tanto un origen a distancia 1 de `to` como uno a distancia 7 terminan de vuelta en el origen, NUNCA en `to`. Esto significa que el "asentamiento limpio" de marrón (la construcción que modela `isFarEdgeOfLane`/`laneCandidatesWithClearPath` en `inverses.ts`, sin cambios en esta decisión) es ahora permanentemente inalcanzable con un golpeador real, para cualquier distancia -- no una limitación de alcance de wrap-around, sino una imposibilidad estructural. La única forma de restaurar la física original (un carril genuinamente despejado) es que el golpeador nunca llegue a asentarse -- exactamente lo que `fragility: 'broken'` ya garantiza (`settleOrVanish`: una ficha `'broken'` golpea con normalidad pero nunca se escribe en el tablero).

**Alcance de la marca `mustBeBroken`**: solo se propaga a través de un lanzamiento DIRECTO. Si la obligación del golpeador, en vez de lanzarse directo, se explicara por una cadena anterior (otra ficha golpeando a esta), no hay forma sencilla de garantizar que esa ficha intermedia llegue exactamente `'broken'` en el momento correcto (dependería de cuántas veces fue golpeada antes, y de si la pieza "furniture" original se colocó con la fragilidad de partida adecuada -- hoy siempre `'new'`, sin mecanismo para pedir otra cosa). Ampliar `mustBeBroken` a través de la recursión de cadena habría exigido tocar cómo se asigna la fragilidad de las piezas "furniture" originales, un cambio bastante más invasivo para un caso que además es opcional (el generador simplemente reintenta si la combinación no es viable, FR-007 de 011). Se optó por forzar SIEMPRE el lanzamiento directo para una obligación `mustBeBroken` (saltándose el sorteo de `chainOriginProbability`) en vez de soportar el caso recursivo.

**Interacción con FR-006 de 013 (uniformidad de `'easy'`)**: dado que una ficha lanzada nunca recibe `'broken'` por elección del perfil de fragilidad (`assignGroupFragility` para fichas lanzadas siempre usa `['new','cracked']`, FR-009/FR-010 de 013), cualquier `'broken'` observado entre las fichas lanzadas de un nivel generado es, sin ambigüedad, esta excepción estructural -- nunca una coincidencia del perfil. Esto permite que los tests de `fragility.test.ts` (Historia 2 de 013) sigan verificando la uniformidad real del perfil excluyendo explícitamente cualquier ficha lanzada `'broken'` del cálculo, en vez de debilitar la propia garantía de 013.

**Alternativas consideradas**:

- **Extender `laneCandidatesWithClearPath` para soportar wrap-around genérico** (la dirección inicialmente propuesta): investigada a fondo y descartada tras verificar la matemática -- el wrap-around no es la limitación; el asentamiento limpio de marrón es inalcanzable con CUALQUIER distancia, wrapeada o no, mientras el golpeador sea real. Extender el wrap-around SÍ sigue siendo válido y útil para el contexto 'occupied' (un golpeador explicando su propio origen contra una ficha YA existente, donde el paseo se detiene en `to` porque `to` mismo está ocupado, no por el tope de cruces) -- pero no se implementó en esta feature porque ningún test o nivel existente lo necesitaba, y el alcance ya se había ampliado lo suficiente; queda como una capacidad futura del generador, no ligada a ningún bug pendiente.
- **Eliminar por completo el contexto 'settle' de marrón** (dejar que `inverseCandidates` devuelva siempre `[]` para ese caso): más simple, pero elimina una categoría de nivel ya construible y rompe el nivel 12 del prototipo sin necesidad -- descartada a favor de preservar la capacidad con el golpeador `'broken'`.
