# Feature Specification: Generador de Niveles por Construcción Inversa (verde/naranja/marrón)

**Feature Branch**: `011-level-generator-basic`

**Created**: 2026-08-25

**Status**: Draft

**Input**: User description: "Crear una herramienta de generación de niveles por construcción inversa, para las fichas verde, naranja y marrón únicamente (rojo y los bloqueantes quedan fuera de alcance de esta feature). El nivel se construye hacia atrás desde el objetivo: se decide qué ficha debe acabar en la casilla del goal, y se reconstruye, un paso cada vez, qué tuvo que pasar antes -- así el nivel es resoluble por construcción y la secuencia de lanzamientos de referencia se conoce desde el principio. Modelo de construcción: una cola de obligaciones abiertas ('esta casilla debe terminar con una ficha de este color'). Inversos: verde (retroceder 1 casilla, dirección aleatoria), naranja (retroceder 2 casillas, casilla intermedia irrelevante), marrón (conjunto de candidatos con camino despejado, respetando wrap-around). Cada obligación resuelta con un empuje genera además la obligación de construir el origen de quien golpea (mano, o parte de una cadena anterior, con probabilidad configurable). Validación: reproducir cada paso hacia delante con el motor real. Política de fallos: sin reintentos locales -- si la verificación falla, se descarta el nivel completo y se reintenta desde cero, hasta un máximo configurable. Salida: JSON con la misma forma que `createLevel()` más la secuencia de lanzamientos de referencia y los parámetros/semilla usados. Vive fuera de `src/`, en una carpeta de herramientas aparte, nunca alcanzable desde el cliente; solo consume la API pública ya existente de `src/engine/`, sin ningún cambio de motor."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Generar un nivel resoluble de un solo lanzamiento (Priority: P1)

Quien opera el generador le pide un nivel usando verde, naranja o marrón, con un único lanzamiento. El generador construye hacia atrás desde el objetivo -- decide qué ficha debe estar en la casilla del goal, reconstruye de dónde vino (mobiliario inicial del tablero, o un empuje desde una ficha de mano), y entrega el nivel junto con la secuencia de lanzamientos que lo resuelve.

**Why this priority**: Es el ciclo completo mínimo -- sin esto no hay generador. Ejercita la cola de obligaciones, los tres inversos, y la validación hacia delante en su forma más simple.

**Independent Test**: Pedir un nivel de 1 lanzamiento con verde disponible, y comprobar que (a) el nivel resultante tiene exactamente una ficha en mano, (b) la secuencia de lanzamientos entregada, reproducida con el motor real, resuelve el nivel (`result: 'won'`), y (c) la ficha en la casilla del objetivo, al final, coincide con el color y la casilla declarados en el goal del nivel.

**Acceptance Scenarios**:

1. **Given** se pide un nivel de 1 lanzamiento usando únicamente verde, **When** el generador construye el nivel, **Then** entrega un tablero inicial, una mano con 1 ficha verde, un objetivo, y una secuencia de 1 lanzamiento que, reproducida con el motor real, resuelve el nivel.
2. **Given** se pide un nivel usando marrón, **When** el generador elige una distancia/dirección para el inverso de marrón, **Then** verifica que el camino intermedio entre el origen elegido y el destino está despejado en el tablero que lleva construido hasta ese momento, antes de aceptar esa elección.
3. **Given** el generador termina de construir un nivel, **When** reproduce la secuencia de lanzamientos con el motor real, **Then** el resultado final coincide exactamente con lo esperado (mismo tablero, mismo estado de "resuelto") antes de entregar el nivel como válido.

---

### User Story 2 - Encadenar varios lanzamientos, con orígenes que a veces vienen de una cadena anterior (Priority: P2)

Quien opera el generador pide un nivel con varios lanzamientos. Al construir hacia atrás el origen de una ficha que golpea, el generador no siempre elige "viene de la mano" -- a veces decide que esa ficha es, a su vez, el resultado de un empuje anterior, y sigue construyendo hacia atrás ese origen también, hasta que todas las obligaciones abiertas quedan resueltas por mano o por mobiliario inicial.

**Why this priority**: Sin esto, todo nivel generado sería una única ficha por lanzamiento sin ninguna composición -- el generador nunca produciría las cascadas de varios eslabones que ya existen en los niveles hechos a mano del prototipo.

**Independent Test**: Pedir un nivel de 2+ lanzamientos con una probabilidad alta de "origen en cadena", y comprobar que al menos un lanzamiento de la secuencia de referencia desencadena una cascada de más de un evento al reproducirlo con el motor real.

**Acceptance Scenarios**:

1. **Given** el generador está construyendo el origen de una ficha que golpea, **When** decide (según la probabilidad configurada) que ese origen es parte de una cadena anterior en vez de la mano, **Then** encola una nueva obligación para ese origen y sigue construyendo hacia atrás antes de darlo por terminado.
2. **Given** un nivel generado con varios lanzamientos, **When** se reproduce su secuencia de referencia completa con el motor real, **Then** el resultado final es `'won'` y coincide con el nivel entregado.

---

### User Story 3 - Fichas señuelo en la mano final (Priority: P3)

Quien opera el generador pide un número de fichas señuelo (que no participan en la solución) añadidas a la mano del nivel generado, para variar la dificultad aparente sin afectar a si el nivel es resoluble.

**Why this priority**: Es un refinamiento sobre el generador ya funcional (Historias 1-2) -- añade textura al nivel sin cambiar su mecanismo de construcción ni de validación.

**Independent Test**: Pedir un nivel con N fichas señuelo, y comprobar que la mano final tiene N fichas más que las estrictamente necesarias para la secuencia de referencia, y que ninguna de ellas aparece en esa secuencia.

**Acceptance Scenarios**:

1. **Given** se pide un nivel con 2 fichas señuelo, **When** el generador termina de construir la solución real, **Then** añade 2 fichas más a la mano final que no forman parte de la secuencia de lanzamientos de referencia.
2. **Given** un nivel con fichas señuelo, **When** se reproduce únicamente la secuencia de referencia (ignorando las señuelo) con el motor real, **Then** el nivel sigue resolviéndose exactamente igual que sin ellas.

---

### Edge Cases

- ¿Qué ocurre si, al construir el inverso de marrón, no existe ningún candidato con camino despejado (todo el tablero construido hasta ese punto bloquea cualquier distancia posible)? El intento se descarta como cualquier otro fallo de construcción (ver política de fallos) -- no es un caso especial.
- ¿Qué ocurre si se alcanza el número máximo de intentos configurado sin producir un nivel válido? El generador informa de que no pudo generar un nivel con esos parámetros, sin devolver ningún nivel parcial o inválido.
- ¿Qué ocurre si se piden 0 lanzamientos? No hay nada que construir -- se trata como una petición inválida, no como un nivel trivial.
- ¿Qué ocurre si el color elegido para una obligación es naranja y se decide colocar una ficha decorativa en la casilla intermedia? Esa ficha decorativa se coloca como mobiliario inicial del tablero, sin generar ninguna obligación propia -- es puramente cosmética (naranja nunca comprueba esa casilla).

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: El sistema DEBE construir un nivel hacia atrás desde una obligación inicial derivada del objetivo (qué ficha, de qué color, debe estar en la casilla del goal), en vez de generar un tablero y comprobar después si tiene solución.
- **FR-002**: El sistema DEBE mantener una cola de obligaciones abiertas y resolverlas una a una hasta vaciarla, donde cada obligación es "esta casilla debe terminar con una ficha de este color".
- **FR-003**: Para verde y naranja, el sistema DEBE resolver una obligación mediante un único origen determinado matemáticamente (retroceder 1 o 2 casillas respectivamente, respetando wrap-around), eligiendo únicamente la dirección de impacto al azar.
- **FR-004**: Para marrón, el sistema DEBE resolver una obligación eligiendo, entre el conjunto de orígenes candidatos cuyo camino hacia el destino está despejado en el tablero construido hasta ese momento (respetando wrap-around), uno válido -- y DEBE verificar explícitamente que ese camino está despejado antes de aceptarlo.
- **FR-005**: Cada obligación resuelta mediante un empuje DEBE generar, además, la necesidad de determinar el origen de la propia ficha que golpea: bien como el inicio de una cadena (una ficha de mano), bien como el resultado de un empuje anterior (una nueva obligación encolada) -- decidido según una probabilidad configurable.
- **FR-006**: El sistema DEBE, tras cada paso de construcción, reproducir la traza construida hasta ese momento con el motor de simulación real y comprobar que coincide exactamente con lo esperado, antes de continuar.
- **FR-007**: Si la verificación de un paso falla, el sistema NO DEBE reintentar ni deshacer selectivamente ese paso -- DEBE descartar el nivel completo construido hasta ese momento y comenzar una nueva construcción desde cero, hasta un número máximo de intentos configurable.
- **FR-008**: El sistema DEBE aceptar como parámetros de entrada, como mínimo: el número de lanzamientos deseado, el subconjunto de colores disponibles (dentro de verde/naranja/marrón), la probabilidad de que el origen de quien golpea sea mano vs. cadena, el número de fichas señuelo, y una semilla aleatoria.
- **FR-009**: Dada la misma semilla y los mismos parámetros, el sistema DEBE producir siempre el mismo nivel (reproducibilidad).
- **FR-010**: El sistema DEBE entregar, como salida, el nivel generado en la misma forma que ya consume la función de creación de niveles del motor (posiciones iniciales, mano, objetivo), junto con la secuencia de lanzamientos de referencia que lo resuelve y los parámetros/semilla usados para generarlo.
- **FR-011**: El sistema NO DEBE requerir ningún cambio en el motor de simulación existente -- DEBE consumir exclusivamente su API pública ya existente.
- **FR-012**: El sistema NO DEBE ser alcanzable desde el punto de entrada de la aplicación cliente -- DEBE poder ejecutarse de forma completamente independiente de la app jugable.
- **FR-013**: Esta feature NO DEBE introducir ninguna capacidad de generación que involucre la ficha roja, bloqueantes (deliberados o emergentes), o más de un objetivo por nivel -- quedan fuera de alcance.

### Key Entities

- **Obligación**: una casilla del tablero en construcción que debe terminar ocupada por una ficha de un color concreto. Es la unidad de trabajo de la cola de construcción; se resuelve cerrándola (mobiliario inicial) o generando una o más obligaciones nuevas (origen de un empuje, origen de quien golpea).
- **Nivel generado**: el resultado final -- posiciones iniciales de fichas, mano, objetivo, secuencia de lanzamientos de referencia, y los parámetros/semilla que lo produjeron.
- **Parámetros de generación**: número de lanzamientos, colores disponibles, probabilidad mano-vs-cadena, número de fichas señuelo, semilla aleatoria.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: El 100% de los niveles entregados como válidos por el generador se resuelven (`resultado: 'won'`) al reproducir su secuencia de lanzamientos de referencia con el motor real.
- **SC-002**: El 100% de las peticiones con la misma semilla y los mismos parámetros producen exactamente el mismo nivel.
- **SC-003**: El generador nunca entrega un nivel parcial o sin verificar como si fuera válido -- todo nivel entregado ha pasado la reproducción completa hacia delante.
- **SC-004**: Para niveles de 1 a 4 lanzamientos con los parámetros por defecto, el generador produce un nivel válido dentro del número máximo de intentos configurado, en la gran mayoría de las peticiones.

## Assumptions

- El tablero sigue siendo 8×8 y cada nivel sigue teniendo un único objetivo (`Goal` sin cambios) -- multi-goal queda fuera de alcance (ver `documentation/level-generator-design.md`, sección 11).
- El número máximo de intentos por defecto, y el valor por defecto de la probabilidad mano-vs-cadena, son parámetros de configuración razonables a decidir en la fase de planificación -- no bloquean esta especificación.
- Las fichas señuelo (Historia 3) se añaden a la mano final sin ninguna garantía adicional más allá de "no aparecen en la secuencia de referencia" -- no se valida qué harían si se lanzaran, eso queda para el futuro solver de verificación (fuera de alcance aquí).
- Este generador es una herramienta de desarrollo/autoría, no una función del juego jugable -- no tiene interfaz gráfica; se opera mediante parámetros de entrada (p. ej. como script), con la salida en JSON.
- La ubicación exacta (`tools/generator/` u otro nombre) y el mecanismo de ejecución (script de Node vía `tsx` u otra herramienta) se deciden en la fase de planificación; el requisito de esta especificación es únicamente que quede fuera del árbol que empaqueta el cliente (FR-012).
