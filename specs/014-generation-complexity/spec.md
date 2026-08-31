# Feature Specification: Puntuación de Complejidad de Generación

**Feature Branch**: `014-generation-complexity`

**Created**: 2026-08-31

**Status**: Draft

**Input**: User description: "Extender el generador de niveles (tools/generator/) para separar dos conceptos hoy confundidos: (a) el parámetro de entrada que controla cuánta complejidad de construcción pedimos al generador, y (b) la dificultad real percibida de un nivel ya construido -- que se calculará en el futuro con un algoritmo separado que analiza el resultado (mano, tablero inicial, ruta de solución), no los parámetros de entrada. Esta feature cubre únicamente (a); (b) queda explícitamente fuera de alcance como trabajo futuro. Renombrado obligatorio: el campo `difficultyProfile: FragilityProfile` introducido en 013-generator-fragility-difficulty (en GenerationParams, ResolutionContext, y el flag `--difficulty-profile` de cli.ts/batch.ts) pasa a llamarse `fragilityProfile` -- el tipo `FragilityProfile` no cambia de nombre, solo el campo/flag que lo usa. Nuevo concepto -- generationComplexity: un único parámetro numérico de entrada (`complexityScore`) que resume cuánta complejidad de construcción se pide, calculado como la suma de un nivel (entero, empezando en 1, no en 0) asignado a cada uno de los factores de generación con influencia directa y demostrada sobre la forma del nivel resultante: launchCount, chainOriginProbability, defenderContinuationProbability, decoyCount, boardDecoyProbability, availableColors (caso especial: conjunto, no rango, 2 niveles naturales), y fragilityProfile (sus 3 valores ya existentes se tratan como sus 3 niveles). Cada factor tiene su propia cantidad de niveles -- no todos exactamente 3, y el sistema debe estar preparado para que algunos tengan más de 3. Cada nivel de cada factor se define como una horquilla de valores concretos del parámetro real subyacente. Al construir un nivel con un complexityScore objetivo, el generador reparte ese presupuesto entre los factores mediante sorteo aleatorio determinista (mismo rng inyectado que ya usa el generador): todos los factores arrancan en su nivel 1, y se van subiendo factores al azar, respetando el tope de niveles de cada uno, hasta que la suma iguala el complexityScore pedido; después se sortea un valor concreto uniformemente dentro de la horquilla del nivel resultante de cada factor. El rango válido de complexityScore se deriva de la configuración (suma de niveles mínimos a suma de niveles máximos), no es un rango fijo arbitrario. Las horquillas deben vivir en un archivo de configuración de datos externo a la lógica TypeScript del generador, no hardcodeadas. Determinismo: misma semilla + mismos parámetros + mismo complexityScore debe producir siempre el mismo nivel, incluyendo el mismo reparto de niveles por factor y los mismos valores sorteados. Compatibilidad: las llamadas existentes con parámetros individuales explícitos siguen funcionando igual sin necesidad de complexityScore; si se combinan ambos, el valor explícito prevalece para ese factor concreto. Contexto ya vigente (informativo, no a re-especificar): 013-generator-fragility-difficulty ya introdujo el campo a renombrar y su tipo FragilityProfile, con el mecanismo assignGroupFragility ya probado; esta feature no cambia esa lógica interna, solo el nombre del campo y cómo se decide su valor cuando se usa complexityScore."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - El nombre "dificultad" deja de estar ocupado por un parámetro de entrada (Priority: P1)

Quien opera el generador ya no confunde "pedir más heterogeneidad de fragilidad" con "dificultad real percibida" -- el campo que activa esa heterogeneidad (introducido en 013-generator-fragility-difficulty como `difficultyProfile`) pasa a llamarse según lo que realmente controla, liberando el nombre "dificultad" para el futuro algoritmo que la medirá sobre el resultado ya construido (fuera de alcance de esta feature).

**Why this priority**: Es la base sobre la que se construye el resto -- sin este rename, `complexityScore` (Historia 2) competiría de nombre con un parámetro de entrada que ya se llama "difficulty", y la futura medición real de dificultad heredaría la misma ambigüedad desde el principio.

**Independent Test**: Generar niveles con el campo renombrado y confirmar que el comportamiento (incluyendo la reproducibilidad por semilla) es exactamente el mismo que con el nombre anterior -- ningún test existente cambia de valor esperado, solo de nombre de campo/flag.

**Acceptance Scenarios**:

1. **Given** un nivel generado hoy con el parámetro de heterogeneidad de fragilidad activado, **When** se genera el mismo nivel tras el rename usando el nuevo nombre de parámetro con el mismo valor, **Then** el nivel resultante (fichas, mano, fragilidad, solución) es idéntico.
2. **Given** la documentación y el flag de línea de comandos del generador, **When** se revisan tras esta historia, **Then** ninguna referencia a "difficulty"/"dificultad" señala ya al control de heterogeneidad de fragilidad -- solo al nuevo concepto de complejidad de generación (Historia 2).

---

### User Story 2 - Pedir un nivel por complejidad total, no factor a factor (Priority: P2)

Quien opera el generador pide un nivel indicando un único número, `complexityScore`, en vez de decidir manualmente el valor de cada parámetro de generación existente. El generador reparte ese número entre los factores de generación conocidos (número de lanzamientos, probabilidad de origen de cadena, probabilidad de continuación de defensor, señuelos de mano, señuelos de tablero, colores disponibles, y heterogeneidad de fragilidad), subiendo el nivel de cada factor al azar hasta agotar el número pedido, y dentro del nivel resultante de cada factor sortea un valor concreto dentro de la horquilla que ese nivel define.

**Why this priority**: Es donde vive el valor real de esta feature para quien diseña niveles -- sin esto, la Historia 1 por sí sola es solo un rename sin ninguna capacidad nueva.

**Independent Test**: Generar muchos niveles pidiendo el mismo `complexityScore` con distintas semillas, y comprobar que (a) los valores concretos usados para cada factor caen siempre dentro de la horquilla del nivel que le tocó, (b) la suma de los niveles asignados a los factores es siempre exactamente el `complexityScore` pedido, y (c) la misma semilla repite exactamente el mismo reparto y los mismos valores.

**Acceptance Scenarios**:

1. **Given** un `complexityScore` igual al mínimo posible (todos los factores en su nivel 1), **When** se genera el nivel, **Then** cada factor usa un valor dentro de la horquilla de su propio nivel 1.
2. **Given** un `complexityScore` intermedio, **When** se genera el nivel, **Then** la suma de los niveles asignados a los factores es exactamente ese número, y ningún factor supera el número de niveles que tiene definidos.
3. **Given** un factor con más de 3 niveles definidos en la configuración (p. ej. 5), **When** ese factor recibe presupuesto durante el reparto, **Then** puede subir hasta su propio tope de 5, no un tope fijo de 3 compartido con el resto.
4. **Given** el mismo seed, los mismos parámetros y el mismo `complexityScore`, **When** se genera el nivel dos veces, **Then** el resultado es idéntico, incluyendo qué nivel le tocó a cada factor y qué valor concreto se sorteó dentro de su horquilla.

---

### User Story 3 - Las horquillas se ajustan sin tocar código, y los parámetros explícitos siguen mandando (Priority: P3)

Quien ajusta el balance de complejidad de generación edita un archivo de configuración de datos para cambiar las horquillas de cada nivel de cada factor, sin tocar ni recompilar la lógica del generador. Además, cualquier llamada que siga especificando parámetros individuales explícitos (como hoy) sigue funcionando exactamente igual; si se combinan parámetros individuales explícitos con un `complexityScore`, el valor explícito manda para ese factor concreto, y `complexityScore` solo decide los factores no especificados.

**Why this priority**: Es un caso límite importante de compatibilidad y de mantenibilidad operativa, pero no bloquea el valor central ya entregado por la Historia 2.

**Independent Test**: Cambiar una horquilla en el archivo de configuración (por ejemplo, ampliar el rango de lanzamientos del nivel más alto) y comprobar que los niveles generados con ese nivel de complejidad reflejan el cambio sin recompilar ninguna lógica; por separado, generar un nivel con `complexityScore` y un parámetro individual explícito a la vez, y comprobar que el valor explícito se respeta mientras el resto sigue gobernado por `complexityScore`.

**Acceptance Scenarios**:

1. **Given** una horquilla modificada en el archivo de configuración, **When** se genera un nivel con el nivel de complejidad afectado, **Then** el valor concreto sorteado para ese factor cae dentro de la horquilla nueva, no la anterior.
2. **Given** una llamada que no especifica ni parámetros individuales de complejidad ni `complexityScore`, **When** se genera el nivel, **Then** el comportamiento es exactamente el mismo que antes de esta feature -- sin regresión.
3. **Given** una llamada que especifica tanto `complexityScore` como un valor explícito para uno de los factores (p. ej. `launchCount`), **When** se genera el nivel, **Then** ese factor usa el valor explícito dado, no uno derivado de `complexityScore`, mientras el resto de factores sí se deciden por `complexityScore`.

---

### Edge Cases

- ¿Qué ocurre si se pide un `complexityScore` fuera del rango válido `[mínimo, máximo]` derivado de la configuración? Se trata como un error de parámetros de entrada, igual que ya ocurre hoy con `launchCount < 1` -- no es un fallo de generación silencioso ni un intento descartado y reintentado.
- ¿Qué ocurre si un factor de la configuración solo define un nivel? Ese factor nunca participa en el reparto aleatorio -- su valor está fijo, y contribuye ese mismo número tanto al mínimo como al máximo del rango válido de `complexityScore`.
- ¿Qué ocurre con `availableColors`, que no es un rango numérico sino un conjunto? Se modela igual que cualquier otro factor -- cada uno de sus niveles (2 en este caso: 2 colores o 3 colores) define qué conjunto concreto de colores usar, no una horquilla numérica; el mecanismo de reparto no lo distingue especialmente.
- ¿Qué ocurre con `maxChainDepth`? Queda fuera de esta feature -- no se modela como factor de complejidad. Es un freno de seguridad interno del generador (evita una recursión sin fin cuando `chainOriginProbability` es muy alto), no un parámetro con intención de diseño de dificultad, según la discusión de diseño previa a esta especificación.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: El sistema DEBE renombrar el parámetro `difficultyProfile` (introducido en 013-generator-fragility-difficulty) a un nombre que refleje lo que realmente controla (heterogeneidad de fragilidad), sin dejar ninguna referencia visible a "difficulty"/"dificultad" asociada a ese control -- en los parámetros de entrada, en cualquier estructura interna que lo transporte, y en cualquier forma de invocarlo desde línea de comandos.
- **FR-002**: El rename de FR-001 NO DEBE cambiar ningún comportamiento observable -- el mismo seed, los mismos valores de parámetros (bajo su nuevo nombre) y el mismo resto de configuración DEBEN seguir produciendo exactamente el mismo nivel que antes del rename.
- **FR-003**: El sistema DEBE aceptar, como parámetro de generación adicional y opcional, un único número entero (`complexityScore`) que resuma cuánta complejidad de construcción se pide.
- **FR-004**: El sistema DEBE definir, para cada factor de generación con influencia demostrada en la forma del nivel resultante (número de lanzamientos, probabilidad de origen de cadena, probabilidad de continuación de defensor, cantidad de señuelos de mano, probabilidad de señuelo de tablero, colores disponibles, y heterogeneidad de fragilidad), un número de niveles propio -- no necesariamente igual entre factores, y no limitado a un máximo de 3.
- **FR-005**: Para cada nivel de cada factor, el sistema DEBE definir una horquilla de valores concretos del parámetro real subyacente que ese nivel representa (o, para factores no numéricos como los colores disponibles, el conjunto concreto de valores que ese nivel activa).
- **FR-006**: Los niveles de cada factor DEBEN numerarse empezando en 1 (nunca en 0), hasta el número de niveles que ese factor tenga definidos.
- **FR-007**: El sistema DEBE derivar el rango válido de `complexityScore` como `[suma de los niveles mínimos (1) de todos los factores, suma de los niveles máximos de todos los factores]` -- nunca un rango fijo hardcodeado, independiente de cuántos niveles tenga definidos cada factor.
- **FR-008**: Dado un `complexityScore` dentro de su rango válido, el sistema DEBE repartir ese número entre los factores mediante sorteo aleatorio determinista (usando la misma fuente de aleatoriedad ya inyectada en el resto del generador): todos los factores empiezan en su nivel 1, y se sube de uno en uno un factor elegido al azar (que no haya alcanzado ya su propio tope de niveles) hasta que la suma de los niveles asignados iguale exactamente el `complexityScore` pedido.
- **FR-009**: Una vez decidido el nivel de un factor, el sistema DEBE sortear un valor concreto dentro de la horquilla de ese nivel (uniformemente) para obtener el valor real del parámetro subyacente a usar en la construcción del nivel.
- **FR-010**: Las horquillas de cada nivel de cada factor NO DEBEN estar hardcodeadas en la lógica del generador -- DEBEN vivir en un artefacto de configuración de datos, externo a la lógica, editable sin recompilar.
- **FR-011**: Dada la misma semilla, los mismos parámetros y el mismo `complexityScore`, el sistema DEBE producir siempre el mismo nivel, incluyendo el mismo reparto de niveles por factor y los mismos valores concretos sorteados dentro de cada horquilla.
- **FR-012**: El sistema DEBE seguir aceptando cualquier llamada existente que especifique los parámetros individuales de siempre (número de lanzamientos, probabilidad de origen de cadena, etc.) directamente, sin usar `complexityScore` -- ese uso DEBE seguir produciendo exactamente el mismo resultado que antes de esta feature.
- **FR-013**: Si una llamada especifica tanto un `complexityScore` como un valor explícito para uno de los factores individuales, el sistema DEBE respetar el valor explícito para ese factor concreto, dejando que `complexityScore` solo decida los factores no especificados explícitamente.
- **FR-014**: El sistema NO DEBE requerir ningún cambio en el motor de simulación (`src/engine/`) -- toda la lógica de esta feature vive en el generador, igual que 011/012/013.
- **FR-015**: El sistema NO DEBE modelar `maxChainDepth` como un factor de complejidad -- sigue siendo un freno de seguridad interno del generador, no expuesto a través de `complexityScore` ni de sus horquillas.

### Key Entities

- **Factor de complejidad**: un parámetro de generación con influencia demostrada en la forma del nivel resultante (`launchCount`, `chainOriginProbability`, `defenderContinuationProbability`, `decoyCount`, `boardDecoyProbability`, `availableColors`, y el campo renombrado en la Historia 1). Cada uno define su propio número de niveles (no necesariamente 3) y, para cada nivel, una horquilla de valores concretos del parámetro real (o, para `availableColors`, el conjunto concreto que ese nivel activa).
- **Nivel de complejidad (por factor)**: entero, empezando en 1, hasta el número de niveles que ese factor defina. Cada nivel mapea a una horquilla `[mín, máx]` de valores del parámetro subyacente.
- **`complexityScore`**: parámetro de entrada opcional, entero, que resume la complejidad de construcción total pedida -- la suma de los niveles asignados a cada factor. Rango válido: `[suma de niveles mínimos de todos los factores, suma de niveles máximos de todos los factores]`, derivado de la configuración, no fijo.
- **Archivo de configuración de horquillas**: artefacto de datos externo a la lógica TypeScript del generador que define, para cada factor, su lista de horquillas por nivel -- editable sin tocar código.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: El 100% de las peticiones con la misma semilla, los mismos parámetros y el mismo `complexityScore` producen exactamente el mismo nivel, incluido el mismo reparto de niveles por factor.
- **SC-002**: El 100% de los números enteros dentro del rango válido de `complexityScore` son alcanzables por el mecanismo de reparto -- ningún hueco.
- **SC-003**: El 100% de las llamadas existentes que no usan `complexityScore` (con el parámetro de la Historia 1 ya bajo su nuevo nombre) producen exactamente el mismo nivel que producían antes de esta feature.
- **SC-004**: Modificar una horquilla en el archivo de configuración cambia los niveles generados con el nivel de complejidad afectado, sin necesitar ningún cambio en la lógica del generador ni recompilación de código de negocio.
- **SC-005**: Tras el rename de la Historia 1, cero referencias a "difficulty"/"dificultad" quedan asociadas al control de heterogeneidad de fragilidad en el código del generador, su CLI, o su documentación pública.

## Assumptions

- El futuro algoritmo de dificultad real (basado en analizar el nivel ya construido: mano, tablero inicial, ruta de solución) queda explícitamente fuera de alcance de esta feature -- se documenta como trabajo futuro, sin comprometer aquí ningún nombre ni mecanismo para él más allá de dejar libre la palabra "dificultad".
- Los siete factores enumerados en FR-004 son los que ya demostraron tener influencia directa sobre la forma del nivel, según la discusión de diseño previa a esta especificación; añadir factores nuevos en el futuro no debería requerir cambiar el mecanismo de reparto, solo añadir una entrada más a la configuración.
- El formato exacto del archivo de configuración (JSON u otro formato de datos declarativo) se decide en la fase de planificación -- JSON es la opción por defecto razonable, coherente con "niveles como datos declarativos" (Principio IV de la constitución).
- Igual que el resto del generador, esta feature no cambia qué colores o piezas están disponibles (sigue limitado a verde/naranja/marrón) ni introduce bloqueantes o la ficha roja -- fuera de alcance heredado de 011-level-generator-basic.
- Los nombres finales del campo renombrado (`fragilityProfile` u otro) y del nuevo parámetro (`complexityScore` u otro) se confirman en la fase de planificación si hiciera falta ajustarlos.
