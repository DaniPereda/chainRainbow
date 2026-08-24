# Phase 0 Research: Generador de Niveles por Construcción Inversa (verde/naranja/marrón)

`documentation/level-generator-design.md` (secciones 1-3, 6-8) ya fija la forma general del
algoritmo. Esta investigación lo precisa donde la descripción original, aunque correcta en
espíritu, no era suficientemente concreta para implementar sin ambigüedad — en particular, la
distinción entre dos tipos de obligación que el documento trataba como una sola cosa, y una
consecuencia no explicitada del propio tope de cruces de marrón.

## Decisión: dos tipos de obligación, no uno solo

- **Decisión**: una obligación es siempre `{cell, color}`, pero se crea desde dos sitios
  distintos con implicaciones distintas:
  1. **Obligación de defensor**: "un/a ficha de este color estaba en esta casilla antes de ser
     golpeada" — nace de resolver OTRA obligación mediante un empuje (mismo color que la
     obligación original, casilla = el inverso calculado).
  2. **Obligación de origen del golpeador**: "una ficha de este color estaba en esta casilla,
     y su propio empuje hacia delante es lo que llega a golpear a la obligación de defensor de
     arriba" — nace cuando se decide que el golpeador de un paso NO viene de la mano, sino que
     él mismo fue empujado antes.
  Ambas vuelven a la MISMA cola y se resuelven con las MISMAS reglas (mobiliario inicial, o un
  nuevo empuje) — la distinción solo importa para dos cosas: (a) una obligación de origen de
  golpeador NUNCA se resuelve como "lanzamiento de mano" sin más — ese ES precisamente uno de sus
  dos posibles cierres (junto con "sigue la cadena, empújala otra vez"); y (b) el conteo de
  lanzamientos (ver más abajo) solo avanza cuando una obligación de origen de golpeador se cierra
  como lanzamiento de mano.
- **Rationale**: el documento de diseño decía "cada obligación resuelta con un empuje genera
  además la obligación de construir el origen de quien golpea" sin distinguir que esa nueva
  obligación no vive en la misma casilla que la original, ni se resuelve exactamente igual
  (nunca es mobiliario inicial "en el sentido de furniture-antes-del-golpe", siempre es mano o
  cadena). Sin esta distinción, una implementación directa del texto original mezclaría ambas
  casillas y produciría construcciones incoherentes.
- **Ejemplo verificado a mano** (nivel 8 del prototipo, releído hacia atrás): objetivo
  `(6,4,green)`. Resuelto vía golpeador naranja, dirección E → obligación de defensor
  `(6,2,green)` [cierra como mobiliario — la segunda verde ya estaba ahí]. El naranja golpeador
  necesita su propio origen: obligación de origen de golpeador, resuelta vía golpeador verde,
  misma dirección E → `(6,1,orange)` [cierra como mobiliario — el naranja ya estaba ahí]. El
  verde, a su vez, es un lanzamiento de mano, dirección E, carril 6. Coincide exactamente con el
  nivel 8 real.

## Decisión: la dirección es invariante dentro de una misma cadena

- **Decisión**: al resolver la obligación de origen de un golpeador (no la de defensor), la
  dirección DEBE ser la misma que la del paso que la generó — nunca se elige una dirección nueva
  ahí. Una obligación de DEFENSOR, en cambio, si se resuelve con un nuevo empuje, SÍ elige una
  dirección nueva libremente (es el comienzo de una cadena conceptualmente distinta).
- **Rationale**: `resolveStrike` en el motor real pasa `direction` sin cambios en cada llamada
  recursiva de una misma cascada — todos los eslabones de UN lanzamiento viajan en la misma
  dirección de brújula. Elegir una dirección nueva a mitad de cadena produciría una traza que el
  motor real nunca reproduciría, y la validación hacia delante (FR-006) la descartaría siempre.

## Decisión: un lanzamiento de mano requiere camino despejado desde el borde

- **Decisión**: cerrar una obligación de origen de golpeador como "lanzamiento de mano" (color S,
  dirección D, en la casilla X) exige que, en el tablero construido hasta ese momento, todas las
  casillas entre el borde de entrada y X (sin incluir X) a lo largo de esa dirección/carril estén
  vacías.
- **Rationale**: es literalmente cómo funciona `travelLaunch` — busca la PRIMERA ficha ocupada
  desde el borde; si algo la precede en el camino, el lanzamiento golpearía esa otra ficha, no la
  que se pretendía. No es una regla específica de ningún color, es una propiedad general del
  lanzamiento en sí.
- **Nota de implementación**: no hace falta una comprobación aparte además de la validación hacia
  delante (FR-006/FR-007) — si el camino no está despejado, la reproducción con el motor real
  golpeará la ficha equivocada (o hará missclick) y la discrepancia se detectará y descartará el
  intento igualmente. Una comprobación anticipada (antes de terminar de construir todo el nivel)
  es una optimización de rendimiento razonable — falla antes, sin gastar el resto de la
  construcción — pero no es estrictamente necesaria para la corrección.

## Decisión: marrón tiene dos modos de inverso, no uno

- **Decisión**:
  1. **Modo "destino ya ocupado"** (usado para resolver una obligación de ORIGEN DE GOLPEADOR,
     donde la casilla de llegada YA tiene una ficha — la que sigue la cadena): el conjunto
     flexible de candidatos que ya describía el documento original — cualquier casilla de origen
     cuyo paseo hacia delante llegue exactamente a la casilla de llegada sin toparse con nada
     antes.
  2. **Modo "destino vacío / asentamiento directo"** (usado para resolver una obligación de
     DEFENSOR o el objetivo mismo, donde la casilla de llegada debe quedar vacía hasta que la
     ficha se asiente ahí sin más): SOLO es válido si la casilla de llegada es exactamente la
     casilla del borde lejano de su carril en la dirección elegida (col 7 para E, col 0 para O,
     fila 7 para S, fila 0 para N) — cualquier otra casilla NO es alcanzable por este modo, sin
     importar qué distancia se elija.
- **Rationale**: el paseo largo de marrón (`stepUntilBlocked`) solo se detiene en una casilla
  VACÍA cuando agota el tope de cruces de borde sin encontrar nada — y ese punto de parada, para
  un camino completamente despejado, cae SIEMPRE en el borde lejano del carril, sin importar
  desde qué columna/fila empiece (se deriva de que una vuelta completa, 8 casillas, no cambia la
  posición relativa módulo 8 — el mismo razonamiento que llevó al fix de PR #10 sobre el
  desfase de una casilla). Si el paseo encuentra ANTES una ficha ya colocada, se detiene ahí
  ocupado — lo cual dispara una cascada, no un asentamiento limpio; por tanto una casilla de
  llegada vacía y no-borde-lejano nunca es alcanzable de forma directa por marrón.
- **Consecuencia práctica**: si se pide un nivel usando marrón y la obligación en cuestión no es
  ni el borde lejano de ningún carril ni una casilla ya ocupada por la cadena, el generador
  simplemente NO puede usar marrón como golpeador directo ahí — debe elegir otro color disponible
  para esa obligación concreta (o, si marrón es el único color disponible, ese intento de
  generación falla y se descarta como cualquier otro, spec.md FR-007).
- **Alternatives considered**: restringir el generador a solo el modo "destino ya ocupado" para
  marrón (nunca usarlo como golpeador terminal directo) — descartado porque excluiría
  innecesariamente niveles tan simples y ya validados como el nivel 12 del prototipo (marrón
  contra un carril despejado, asentándose en el borde lejano).

## Decisión: el golpeador elegido para un empuje nunca puede ser del mismo color que la obligación

- **Decisión**: al resolver una obligación `(cell, C)` mediante un empuje, el color del golpeador
  elegido DEBE ser distinto de `C`.
- **Rationale**: en el motor real, `defender.color === strikerColor` dispara aniquilación, no un
  empuje — es una rama de `resolveStrike` completamente distinta a `PUSH_STRATEGY`. Esta feature
  no modela construcción vía aniquilación (fuera de alcance, ver spec.md); permitir elegir el
  mismo color produciría una obligación que, al reproducirse con el motor real, jamás coincidiría
  con lo esperado (aniquilaría en vez de empujar) y se descartaría siempre — mejor excluirlo en el
  propio momento de elegir, en vez de esperar a que la validación lo detecte siempre.

## Decisión: control del número de lanzamientos mediante un contador con cierre forzado

- **Decisión**: se mantiene un contador `launchesUsed`, inicializado a 0, con un objetivo `N`
  (parámetro de entrada). Reglas:
  - La obligación del objetivo (la primera de todas) SIEMPRE se resuelve con un empuje, nunca
    como mobiliario — garantiza `N >= 1`.
  - Una obligación de DEFENSOR se cierra como mobiliario si `launchesUsed >= N`; si no, se decide
    entre mobiliario y empuje según una probabilidad de continuación (parámetro interno, ver
    Assumptions de spec.md — valor por defecto propuesto: 0.4).
  - Una obligación de ORIGEN DE GOLPEADOR nunca es mobiliario — siempre es lanzamiento de mano o
    continuación de cadena, decidido con la probabilidad de FR-005, salvo que se haya alcanzado
    una profundidad máxima de cadena (parámetro interno, valor por defecto propuesto: 4), en cuyo
    caso se fuerza "lanzamiento de mano" para garantizar que la cadena termina. Cada cierre como
    "lanzamiento de mano" incrementa `launchesUsed`.
  - Si la cola se vacía con `launchesUsed < N`, es un fallo de generación de este intento
    (spec.md FR-007: se descarta el nivel completo, no solo ese paso).
- **Rationale**: garantiza terminación (la profundidad máxima de cadena evita recursión
  indefinida) y exactitud (`launchesUsed` nunca puede superar `N`, porque toda obligación de
  defensor se fuerza a mobiliario en cuanto se alcanza el objetivo). No alcanzar `N` es un
  resultado válido a nivel de intento individual — se resuelve con la política de reintento ya
  acordada, no con lógica especial adicional.
- **Alternatives considered**: planificar de antemano exactamente qué obligaciones se convertirán
  en lanzamientos antes de empezar a construir — descartado por ser innecesariamente más
  complejo que decidirlo sobre la marcha con un contador simple, sin ninguna ventaja de
  corrección adicional.

## Decisión: PRNG con semilla propio, sin dependencia nueva

- **Decisión**: un generador de números pseudoaleatorios determinista de ~10 líneas
  (`tools/generator/rng.ts`), tipo *mulberry32* — recibe una semilla entera de 32 bits, devuelve
  una secuencia reproducible de flotantes en `[0,1)`.
- **Rationale**: `Math.random()` no admite semilla, y FR-009 exige reproducibilidad exacta dada
  la misma semilla. Un PRNG de este tipo es un algoritmo de dominio público, ampliamente usado
  para este propósito exacto, y evita añadir una dependencia de npm para una necesidad tan
  pequeña — coherente con que el motor tampoco tiene dependencias de runtime.
- **Alternatives considered**: una librería de npm (p. ej. `seedrandom`) — descartada por
  desproporcionada frente a implementar el algoritmo directamente, y por introducir una
  dependencia externa donde el proyecto ya prefiere no tenerlas salvo necesidad clara (Phaser es
  la única excepción, y es específica del renderer).

## Decisión: importar directamente de los módulos del motor, no solo del barril `index.ts`

- **Decisión**: `tools/generator/` importa `getPieceAt`/`setPieceAt`/`createBoard` de
  `src/engine/board.js`, y `step`/`stepBy`/`stepUntilBlocked`/`opposite` de
  `src/engine/move-step.js`, además de `resolveLaunch`/`createLevel`/tipos vía
  `src/engine/index.js` donde ya están expuestos.
- **Rationale**: estas primitivas de bajo nivel no están reexportadas por el barril `index.ts`
  hoy, y ya existe precedente claro en el propio proyecto de importar directamente de los módulos
  internos del motor cuando se necesitan (`tests/unit/engine/move-step.test.ts` importa
  `createBoard`/`setPieceAt` de `board.js` directamente, no vía `index.ts`). Seguir el mismo
  patrón evita tocar `src/engine/index.ts` — FR-011 ("ningún cambio de motor") queda
  literalmente intacto, cero líneas modificadas dentro de `src/engine/`.
- **Alternatives considered**: ampliar `src/engine/index.ts` para reexportar estas primitivas —
  descartada por ser un cambio (aunque mínimo y de solo-añadir) dentro de `src/engine/`, que
  FR-011 pide evitar explícitamente; el patrón ya existente de importar directamente de los
  módulos internos logra lo mismo sin tocar ese árbol en absoluto.

## Decisión: ubicación y ejecución — `tools/generator/`, ejecutado vía `tsx`

- **Decisión**: código fuente en `tools/generator/`, fuera de `src/`; se ejecuta con
  `npx tsx tools/generator/cli.ts [opciones]`, sin paso de build ni integración con Vite.
  `tsconfig.json` añade `"tools"` a su `include` para que `npm run typecheck` lo cubra.
- **Rationale**: decisión ya tomada en la sesión de diseño (documentation/level-generator-design.md)
  — nada alcanzable desde `src/renderer/main.ts` acaba en el bundle de producción. `tsx` ya se
  usó sin fricción en esta misma sesión para generar las trazas del visor de niveles.
- **Verificación de la frontera**: se añade una comprobación (grep, ejecutada como parte de la
  regresión de esta feature) de que `src/renderer/` nunca importa nada de `tools/` — mismo
  patrón que la comprobación motor↔renderer ya existente en cada feature anterior.

## Decisión: la fuente de aleatoriedad se inyecta como función, no se acopla al PRNG concreto

- **Decisión**: el algoritmo de construcción (`obligations.ts`/`generate.ts`) recibe un
  `rng: () => number` como parámetro, no importa `rng.ts` directamente. El CLI conecta el
  mulberry32 real; los tests conectan una función "guionizada" (una secuencia fija de valores
  predecibles) para poder verificar a mano exactamente qué construye el algoritmo con decisiones
  concretas conocidas, sin tener que calcular a mano la secuencia real de mulberry32.
- **Rationale**: es la única forma práctica de tener fixtures de test verificables a mano (mismo
  rigor que el resto del proyecto) para un algoritmo que, por diseño, consume aleatoriedad en
  cada decisión — inyectar la fuente separa "¿el algoritmo hace lo correcto dada una secuencia de
  decisiones conocida?" (se prueba con el stub) de "¿el PRNG con semilla es reproducible?" (se
  prueba aparte, en `rng.test.ts`, sin implicar el resto del algoritmo).

## Decisión: fichas señuelo (Historia 3) se añaden al final, sin verificación adicional

- **Decisión**: tras completar y validar la construcción real, se añaden `N` fichas señuelo a la
  mano, elegidas al azar (con semilla) del conjunto de colores disponible, insertadas en
  posiciones aleatorias de la mano final.
- **Rationale**: coincide con spec.md (Assumptions): no se garantiza nada sobre qué harían si se
  lanzaran, solo que no forman parte de la secuencia de referencia — cualquier verificación más
  profunda de su comportamiento queda para el futuro solver (fuera de alcance).
