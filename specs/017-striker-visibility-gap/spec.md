# Feature Specification: La Ficha Lanzadora Recién Asentada Debe Ser Visible Para el Desplazamiento de la Ficha Que Golpeó

**Feature Branch**: `017-striker-visibility-gap`

**Created**: 2026-09-01

**Status**: Draft

**Input**: User description: "Corregir un hueco de visibilidad detectado en applyImpact (src/engine/pieces/push.ts), consecuencia directa de 016-immediate-chain-placement pero no cubierto por esa feature: cuando una ficha golpeada (hitDefender) es desplazada mediante PUSH_STRATEGY (en particular la caminata de marrón, stepUntilBlocked), ese cálculo se hace contra el tablero `vacated` (la casilla de impacto vaciada, ANTES de que la ficha lanzadora se asiente), en vez de contra `boardWithStriker` (el tablero que ya incluye a la ficha lanzadora asentada en esa misma casilla). Esto significa que la ficha desplazada puede 'no ver' a la ficha lanzadora que acaba de asentarse en su propia cascada, y por tanto atravesarla en vez de chocar con ella -- incluyendo el caso de dar la vuelta completa al tablero (wrap-around) y no detectar el choque con su propio golpeador al volver a esa casilla. Caso real detectado por el usuario en nivel generado 49, 4º lanzamiento de la solución (marrón, S, lane 7): marrón golpea naranja en (4,7) (naranja pasa de 'new' a 'cracked', correcto, un solo golpe). Marrón se asienta en (4,7). El desplazamiento de naranja se calcula con stepUntilBlocked sobre el tablero SIN marrón asentado, así que naranja da la vuelta completa al tablero (por el cap de edge-crossings) y aterriza en (7,7) -- la casilla objetivo -- sin volver a colisionar con marrón. Verificado directamente: con el tablero `vacated` (sin marrón) el cálculo devuelve (7,7); con el tablero que sí incluye a marrón asentado en (4,7) devuelve (4,7) (colisión inmediata). Alcance: corregir exclusivamente esa fuente de tablero desactualizado dentro de applyImpact, sin tocar ninguna otra lógica de PUSH_STRATEGY, fragilidad, o resolución de ramas de rojo. Añadir test de regresión reproduciendo el caso del nivel 49. Regenerar/verificar el batch de niveles existente. Rama apilada sobre 016-immediate-chain-placement (aún no mergeada), no sobre develop, porque el bug vive en código introducido por esa feature."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Una ficha desplazada dentro de una cascada choca con la ficha lanzadora que la propia cascada ya asentó (Priority: P1)

Quien mantiene el motor ya no necesita preocuparse de que el cálculo de "hasta dónde llega la ficha que acabo de golpear" se haga contra una fotografía del tablero anterior a que la propia ficha lanzadora se asentara en su casilla de impacto. Ese cálculo pasa a hacerse contra el tablero que ya incluye a la ficha lanzadora asentada, así que si el desplazamiento de la ficha golpeada (en particular el paseo de marrón, que sí inspecciona el tablero celda a celda) la lleva de vuelta a esa misma casilla -- por ejemplo completando una vuelta al tablero -- encuentra ahí una ficha real y choca con ella, en vez de atravesarla como si estuviera vacía.

**Why this priority**: Es el bug en sí -- sin corregirlo, un nivel puede declararse resuelto (`'won'`) por una razón incorrecta: el motor "olvida" una colisión que debería ocurrir dentro de la propia cascada, cambiando el resultado real del nivel.

**Independent Test**: Reproducir el nivel 49 (o una cascada sintética equivalente: marrón golpea una ficha en una fila/columna despejada donde la única ficha capaz de bloquear el paseo de la ficha golpeada es la propia ficha lanzadora recién asentada) y comprobar que la ficha golpeada colisiona con la ficha lanzadora al completar su paseo, en vez de dar la vuelta completa al tablero y aterrizar más allá sin chocar.

**Acceptance Scenarios**:

1. **Given** una ficha lanzadora que golpea a una ficha defensora y se asienta en la casilla de impacto, **When** se calcula hasta dónde se desplaza la ficha defensora golpeada (`PUSH_STRATEGY`), **Then** ese cálculo ve el tablero que ya incluye a la ficha lanzadora asentada en su casilla, no una fotografía anterior sin ella.
2. **Given** una ficha defensora golpeada por marrón, cuyo paseo (`stepUntilBlocked`) recorrería una fila o columna despejada de cualquier otra ficha excepto la propia ficha lanzadora recién asentada, **When** el paseo vuelve a alcanzar esa casilla (incluido el caso de completar una vuelta entera al tablero), **Then** se detiene ahí -- golpe normal contra esa ficha real, con su propia regla de mismo color/distinto color -- en vez de continuar como si la casilla siguiera vacía.
3. **Given** el nivel 49 tal y como fue generado (motor pre-corrección), **When** se reproduce su secuencia de referencia con el motor ya corregido, **Then** el resultado puede diferir del `'won'` original -- si difiere, el nivel se regenera (Historia 2); si el nivel ya no es válido con la secuencia original, no se conserva sin volver a validarse.

---

### User Story 2 - El batch de niveles generados se reverifica contra el motor corregido (Priority: P2)

Quien opera el generador reproduce la secuencia de referencia de los 140 niveles ya generados con el motor corregido. Cualquier nivel cuyo resultado cambie (porque su solución dependía, sin saberlo, del hueco de visibilidad ahora corregido) se regenera; el resto se conserva sin cambios.

**Why this priority**: Es la consecuencia directa de la Historia 1 -- sin reverificar, podrían quedar en el repositorio niveles cuya validez se demostró contra un motor con un bug real.

**Independent Test**: Reproducir la secuencia de referencia de los 140 niveles existentes con el motor corregido; para cualquiera que ya no resuelva a `'won'`, regenerarlo (mismo `complexityScore` que tenía) contra el motor corregido y volver a verificar el 100% de éxito.

**Acceptance Scenarios**:

1. **Given** los 140 niveles ya generados en `levels/`, **When** se reproduce la secuencia de referencia de cada uno con el motor corregido, **Then** se identifica exactamente qué subconjunto (posiblemente vacío) deja de resolver a `'won'`.
2. **Given** un nivel identificado como afectado, **When** se regenera con el mismo `complexityScore` contra el motor corregido, **Then** su nueva secuencia de referencia resuelve a `'won'` con el motor corregido.
3. **Given** el batch completo tras la reverificación/regeneración, **When** se reproduce la secuencia de referencia de los 140 niveles, **Then** el 100% resuelve a `'won'` y se mantiene la misma distribución (10 niveles por cada uno de los 14 valores de `complexityScore`, 7 a 20).

---

### User Story 3 - El generador sigue pudiendo construir un asentamiento limpio de marrón (Priority: P2)

Durante la implementación se descubrió que la corrección de la Historia 1 tiene una consecuencia más amplia de lo previsto: con una ficha lanzadora REAL (no ya asentada más tarde, sino desde el primer instante en que se asienta), CUALQUIER empuje de marrón sobre un carril por lo demás totalmente despejado ahora completa una vuelta entera y choca con su propio golpeador -- para CUALQUIER distancia, no solo en el caso de vuelta-completa-al-borde-lejano que motivó la Historia 1. Esto hace que el "asentamiento limpio" de marrón (una ficha golpeada que llega a una casilla vacía sin ningún obstáculo real de por medio, el mecanismo que el tope de cruces de borde -- `MAX_EDGE_CROSSINGS`, spec.md 008 -- estaba pensado para acotar) deje de ser alcanzable con una ficha lanzadora real, para siempre, en cualquier construcción. Quien opera el generador (`tools/generator/`) necesita seguir pudiendo construir ese tipo de nivel (ya lo hacía antes de esta feature, y un nivel real del prototipo -- el 12 -- depende de ello para demostrar el tope de cruces de borde): el generador asigna, específicamente a ESE golpeador marrón, la fragilidad `'broken'` -- así golpea con normalidad pero nunca se asienta, dejando el carril genuinamente despejado para el resto del paseo, exactamente como antes de que existiera este bug.

**Why this priority**: Sin este ajuste, la Historia 1 no solo corrige el bug -- también elimina por completo una categoría de nivel que el generador ya sabía construir (y que un nivel real del prototipo ya usaba), lo cual sería una regresión de capacidad, no solo una corrección de comportamiento.

**Independent Test**: Reproducir la construcción del nivel 12 del prototipo (marrón empuja una ficha por un carril totalmente despejado hasta el borde lejano, vía el tope de cruces de borde) a través del generador, y comprobar que el golpeador marrón resultante tiene fragilidad `'broken'` y que la construcción sigue validando hacia delante con el motor real.

**Acceptance Scenarios**:

1. **Given** una obligación de tipo 'defender' que se resuelve eligiendo marrón como golpeador en contexto de asentamiento limpio ('settle'), **When** esa obligación de golpeador se resuelve, **Then** se fuerza un lanzamiento directo desde la mano (nunca explicado por una cadena anterior) con fragilidad `'broken'`, sin alterar el conteo de llamadas a `rng()` de ningún caso que no use este mecanismo.
2. **Given** el perfil de fragilidad `'easy'` (013-generator-fragility-difficulty, FR-006: todas las fichas lanzadas comparten un único estado), **When** una de las fichas lanzadas es la forzada a `'broken'` por esta feature, **Then** esa ficha queda excluida del grupo de uniformidad -- el resto de fichas lanzadas siguen compartiendo un único estado entre sí, y una ficha `'broken'` en el grupo lanzado se reconoce siempre como esta excepción estructural (nunca como una elección del perfil, que nunca asigna `'broken'` a fichas lanzadas).
3. **Given** el nivel 12 del prototipo (`src/levels/prototype-levels.ts`), **When** se reproduce con el motor corregido, **Then** sigue resolviendo (`'won'`) demostrando el mismo tope de cruces de borde de siempre, ahora con su golpeador marrón declarado `'broken'` en la mano.

---

### Edge Cases

- ¿Qué ocurre si la ficha golpeada, tras ver correctamente a la ficha lanzadora asentada, colisiona con ella siendo del MISMO color? Se aplica la regla ya existente de aniquilación por mismo color (003-same-color-collision) -- ningún caso especial de esta feature.
- ¿Qué ocurre con verde y naranja (distancia fija, no inspeccionan el tablero)? El cálculo de su destino no depende del contenido del tablero salvo por el propio `stepBy`, que nunca consulta ocupación -- así que este bug es observable en la práctica solo con marrón (`stepUntilBlocked`, la única estrategia que sí inspecciona el tablero celda a celda); el cambio de tablero pasado a `PUSH_STRATEGY` no altera el resultado de verde/naranja.
- ¿Qué ocurre si, tras corregir el hueco, la ficha golpeada choca de vuelta contra la ficha lanzadora y esa nueva colisión, a su vez, desencadena más eslabones de la cadena? Se resuelve con el mismo mecanismo de cola de fichas en tránsito ya establecido por 016-immediate-chain-placement -- ningún caso especial de esta feature.
- ¿Qué ocurre si una obligación de golpeador marrón marcada como "debe ser broken" solo podría explicarse por una cadena anterior (no por un lanzamiento directo), por ejemplo porque ya no quedan lanzamientos disponibles en esa posición del carril? Se fuerza igualmente el lanzamiento directo (nunca la recursión de cadena para este caso, Historia 3) -- si eso no es viable (sin lanzamientos disponibles, o sin camino despejado desde el borde), la obligación falla y el intento de construcción completo se descarta y reintenta, exactamente como cualquier otra combinación inviable (FR-007 de 011-level-generator-basic).

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: El cálculo de hasta dónde se desplaza una ficha defensora recién golpeada (`PUSH_STRATEGY`, dentro de `applyImpact`) DEBE hacerse contra el tablero que ya incluye a la ficha lanzadora asentada en su casilla de impacto, no contra una fotografía del tablero anterior a ese asentamiento.
- **FR-002**: Esta corrección DEBE aplicarse de forma idéntica a las tres estrategias de desplazamiento existentes (verde, naranja, marrón) -- ningún caso especial por color (Principio V) -- aunque el efecto observable solo sea detectable en la práctica con marrón, la única estrategia que inspecciona el contenido del tablero.
- **FR-003**: El sistema DEBE seguir garantizando que la ficha lanzadora se asiente de forma inmediata (016-immediate-chain-placement, FR-001) -- esta feature no cambia CUÁNDO se asienta, solo qué tablero ve el cálculo posterior de desplazamiento de la ficha que golpeó.
- **FR-004**: Ninguna otra semántica de interacción por color (fragilidad, aniquilación por mismo color, división de rojo, tope de cruces de borde de marrón) DEBE cambiar como consecuencia de esta feature.
- **FR-005**: Los 140 niveles en `levels/` DEBEN reverificarse reproduciendo su secuencia de referencia contra el motor corregido; cualquier nivel cuyo resultado deje de ser `'won'` DEBE regenerarse (mismo `complexityScore`) contra el motor corregido.
- **FR-006**: El generador (`tools/generator/`) DEBE seguir siendo capaz de construir un "asentamiento limpio" de marrón (una ficha golpeada que llega a una casilla vacía sin obstáculo real, vía el tope de cruces de borde) -- para ello, cuando elige marrón como golpeador en ese contexto concreto ('settle'), DEBE forzar que ese golpeador se resuelva por lanzamiento directo desde mano (nunca por cadena) con fragilidad `'broken'`.
- **FR-007**: El nivel 12 del prototipo (`src/levels/prototype-levels.ts`), que demuestra el tope de cruces de borde de marrón sobre un carril despejado, DEBE seguir resolviendo (`'won'`) tras esta feature -- ajustando su ficha marrón de mano a fragilidad `'broken'` si hace falta para preservar el mismo carril genuinamente despejado que su diseño siempre asumió.
- **FR-008**: La garantía de uniformidad de fragilidad para fichas lanzadas bajo el perfil `'easy'` (FR-006 de 013-generator-fragility-difficulty) DEBE seguir cumpliéndose entre las fichas lanzadas NO forzadas por FR-006 de esta feature -- una ficha forzada a `'broken'` es una excepción estructural reconocible sin ambigüedad (ninguna ficha lanzada recibe `'broken'` por elección del perfil, FR-009/FR-010 de 013), y no cuenta contra esa uniformidad.

### Key Entities

- **Ficha lanzadora asentada (`boardWithStriker`)**: la ficha que golpeó a la defensora, ya escrita en su casilla de impacto en el momento en que se calcula el desplazamiento de la defensora -- la fuente de verdad correcta para ese cálculo, en sustitución de la fotografía anterior (`vacated`) que no la incluye.
- **Golpeador forzado a `'broken'` (`mustBeBroken`)**: un golpeador marrón, elegido por el generador específicamente para un asentamiento limpio en contexto 'settle', que debe resolverse como un lanzamiento directo desde mano con fragilidad `'broken'` -- nunca por una cadena anterior -- para que el carril que recorre siga siendo genuinamente despejado bajo el motor corregido.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: El 100% de los tests de motor ya existentes (features 001-016) siguen pasando sin cambiar ningún valor esperado, salvo los que dependieran explícitamente del hueco de visibilidad ahora corregido.
- **SC-002**: Una cascada sintética que reproduce el caso del nivel 49 (marrón golpea una ficha en una fila/columna despejada salvo por la propia ficha lanzadora) colisiona con la ficha lanzadora en vez de completar una vuelta al tablero y aterrizar más allá.
- **SC-003**: El 100% de los 140 niveles del batch (tras reverificación y, si hace falta, regeneración) resuelven (`'won'`) al reproducir su secuencia de referencia con el motor corregido.
- **SC-004**: El generador sigue produciendo, cuando corresponde, un asentamiento limpio de marrón (golpeador forzado a `'broken'`), y el nivel 12 del prototipo sigue resolviendo (`'won'`) con esa misma construcción.

## Assumptions

- El hueco corregido es exclusivamente el tablero que ve `PUSH_STRATEGY` dentro de `applyImpact` -- ninguna otra fuente de tablero desactualizado se ha detectado ni se investiga en esta feature; si apareciera otra en el futuro, sería una feature separada.
- El número de niveles del batch afectados por este bug (que dejan de resolver a `'won'` con el motor corregido) no se conoce de antemano -- se determinó empíricamente durante la implementación (Historia 2): 11 de 140 (`40, 49, 71, 101, 107, 113, 132, 156, 165, 207, 251`).
- Esta feature depende de que 016-immediate-chain-placement ya esté aplicada (la rama se crea apilada sobre `016-immediate-chain-placement`, no sobre `develop`) porque el bug vive en código introducido por esa feature (`applyImpact`, `boardWithStriker`, `vacated`).
- El alcance original de esta feature (descrito en el Input de arriba) no anticipaba tocar `tools/generator/` -- la Historia 3 se descubrió durante la implementación, al comprobar que el asentamiento limpio de marrón (una categoría de nivel que el generador ya sabía construir, y que el nivel 12 del prototipo ya usaba) dejaba de ser alcanzable para CUALQUIER distancia con un golpeador real, no solo en el caso de vuelta-completa que motivó la Historia 1 -- ver research.md, Decisión 4, para el razonamiento completo verificado empíricamente antes de ampliar el alcance.
